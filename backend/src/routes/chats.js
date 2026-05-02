const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../utils/supabase');
const { authenticate } = require('../middleware/auth');
const { validate, createChatSchema, updateChatSchema, postMessageSchema } = require('../middleware/validation');
const { success, created, serverError, notFound, forbidden } = require('../utils/response');
const { getAIResponse, streamAIResponse } = require('../services/aiService');
const logger = require('../utils/logger');

router.use(authenticate);

// ─── Helper: verify chat ownership ───────────────────────────────
const getOwnedChat = async (chatId, userId) => {
  try {
    const { data, error } = await supabase
      .from('chats')
      .select('*')
      .eq('id', chatId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    
    if (error) {
      logger.error('getOwnedChat error', { error: error.message, chatId, userId });
      return null;
    }
    
    return data;
  } catch (err) {
    logger.error('getOwnedChat exception', { error: err.message });
    return null;
  }
};

// ─── POST /api/chats ─────────────────────────────────────────────
router.post('/', validate(createChatSchema), async (req, res) => {
  try {
    const title = req.body.title || `Concrete Design ${new Date().toLocaleDateString('en-GB')}`;

    logger.info('Creating chat', { userId: req.user.id, title });

    const { data, error } = await supabase
      .from('chats')
      .insert({ 
        id: uuidv4(), 
        user_id: req.user.id, 
        title,
        code_standard: req.body.code_standard || 'EN206'
      })
      .select()
      .single();

    if (error) {
      logger.error('Create chat Supabase error', { 
        error: error.message, 
        code: error.code,
        userId: req.user.id 
      });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DB_ERROR',
          message: 'Failed to create chat',
          details: error.message
        }
      });
    }

    return created(res, { ...data, messages: [] }, 'Chat created');
  } catch (err) {
    logger.error('Create chat handler error', { 
      error: err.message,
      stack: err.stack,
      userId: req.user.id 
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err.message
      }
    });
  }
});

// ─── GET /api/chats ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    logger.info('GET /api/chats', { userId: req.user?.id });

    // Verify auth succeeded
    if (!req.user || !req.user.id) {
      logger.error('Auth middleware failed - no user', { headers: req.headers.authorization ? 'present' : 'missing' });
      return res.status(401).json({
        success: false,
        error: {
          code: 'NOT_AUTHENTICATED',
          message: 'User not authenticated'
        }
      });
    }

    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const sort   = ['created_at', 'updated_at', 'title'].includes(req.query.sort) ? req.query.sort : 'created_at';
    const order  = req.query.order === 'asc' ? true : false;

    logger.info('Query params', { limit, offset, sort, order });

    // Test Supabase connection
    logger.info('Supabase connection check', {
      hasUrl: !!process.env.SUPABASE_URL,
      hasKey: !!process.env.SUPABASE_ANON_KEY,
      urlLength: process.env.SUPABASE_URL?.length || 0
    });

    const { data, error, count } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at', { count: 'exact' })
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .order(sort, { ascending: order })
      .range(offset, offset + limit - 1);

    logger.info('Supabase query result', {
      hasError: !!error,
      errorMessage: error?.message,
      errorCode: error?.code,
      dataCount: data?.length || 0,
      total: count
    });

    if (error) {
      logger.error('Get chats Supabase error', { 
        error: error.message,
        code: error.code,
        details: JSON.stringify(error)
      });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DB_ERROR',
          message: error.message,
          details: error.code
        }
      });
    }

    // Fetch message counts
    const chatIds = (data || []).map((c) => c.id);
    let messageCounts = {};
    
    if (chatIds.length) {
      logger.info('Fetching message counts', { chatCount: chatIds.length });
      
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('chat_id')
        .in('chat_id', chatIds)
        .is('deleted_at', null);
      
      if (msgErr) {
        logger.error('Message count query error', { error: msgErr.message });
      }
      
      (msgs || []).forEach((m) => {
        messageCounts[m.chat_id] = (messageCounts[m.chat_id] || 0) + 1;
      });
    }

    const chats = (data || []).map((c) => ({ ...c, message_count: messageCounts[c.id] || 0 }));

    logger.info('GET /api/chats - SUCCESS', { chatCount: chats.length });
    return success(res, { chats, pagination: { total: count || 0, limit, offset } });
    
  } catch (err) {
    logger.error('Get chats handler error', { 
      error: err.message,
      stack: err.stack,
      userId: req.user?.id
    });
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err.message
      }
    });
  }
});

// ─── GET /api/chats/:chat_id ─────────────────────────────────────
router.get('/:chat_id', async (req, res) => {
  try {
    logger.info('GET /api/chats/:chat_id', { chatId: req.params.chat_id, userId: req.user.id });
    
    const chat = await getOwnedChat(req.params.chat_id, req.user.id);
    if (!chat) {
      logger.warn('Chat not found or access denied', { chatId: req.params.chat_id, userId: req.user.id });
      return notFound(res, 'Chat');
    }

    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('chat_id', chat.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (msgErr) {
      logger.error('Get messages error', { error: msgErr.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DB_ERROR',
          message: msgErr.message
        }
      });
    }

    // Attach latest design if present
    const { data: design } = await supabase
      .from('designs')
      .select('id, mix_design, compliance, created_at')
      .eq('chat_id', chat.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    logger.info('GET /api/chats/:chat_id - SUCCESS', { chatId: chat.id, messageCount: messages?.length || 0 });
    return success(res, { ...chat, messages: messages || [], design_output: design || null });
    
  } catch (err) {
    logger.error('Get chat handler error', { error: err.message, stack: err.stack });
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err.message
      }
    });
  }
});

// ─── PUT /api/chats/:chat_id ─────────────────────────────────────
router.put('/:chat_id', validate(updateChatSchema), async (req, res) => {
  try {
    const chat = await getOwnedChat(req.params.chat_id, req.user.id);
    if (!chat) return notFound(res, 'Chat');

    const { data, error } = await supabase
      .from('chats')
      .update({ title: req.body.title, updated_at: new Date().toISOString() })
      .eq('id', chat.id)
      .select()
      .single();

    if (error) {
      logger.error('Update chat error', { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DB_ERROR',
          message: error.message
        }
      });
    }
    
    return success(res, data, 'Chat updated');
  } catch (err) {
    logger.error('Update chat handler error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err.message
      }
    });
  }
});

// ─── DELETE /api/chats/:chat_id ──────────────────────────────────
router.delete('/:chat_id', async (req, res) => {
  try {
    const chat = await getOwnedChat(req.params.chat_id, req.user.id);
    if (!chat) return notFound(res, 'Chat');

    await supabase.from('chats').update({ deleted_at: new Date().toISOString() }).eq('id', chat.id);

    return success(res, {}, 'Chat deleted');
  } catch (err) {
    logger.error('Delete chat handler error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err.message
      }
    });
  }
});

// ─── POST /api/chats/:chat_id/messages ───────────────────────────
router.post('/:chat_id/messages', validate(postMessageSchema), async (req, res) => {
  try {
    const chat = await getOwnedChat(req.params.chat_id, req.user.id);
    if (!chat) return notFound(res, 'Chat');

    const { data, error } = await supabase
      .from('messages')
      .insert({
        id: uuidv4(),
        chat_id: chat.id,
        role: 'user',
        content: req.body.content,
      })
      .select()
      .single();

    if (error) {
      logger.error('Post message error', { error: error.message });
      return res.status(500).json({
        success: false,
        error: {
          code: 'DB_ERROR',
          message: error.message
        }
      });
    }

    // Update chat timestamp
    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id);

    return created(res, { ...data, status: 'delivered' });
  } catch (err) {
    logger.error('Post message handler error', { error: err.message });
    return res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: err.message
      }
    });
  }
});

// ─── POST /api/chats/:chat_id/ai-response ────────────────────────
const { parseMixDesignResponse } = require('../services/responseParser');

router.post('/:chat_id/ai-response', async (req, res) => {
  try {
    const chat = await getOwnedChat(req.params.chat_id, req.user.id);
    if (!chat) return notFound(res, 'Chat');

    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('chat_id', chat.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!messages?.length) {
      return res.status(400).json({ success: false, error: { code: 'EMPTY_CHAT', message: 'No messages to respond to' } });
    }

    // CHANGE: Pass selected code standard to Claude
    const { content, thinkingTimeMs } = await getAIResponse(
      messages,
      req.body.code_standard || selectedCodeStandard  // ← ADD THIS
    );

    // Parse the response
    const parsedDesign = parseMixDesignResponse(content);  // ← ADD THIS

    const { data: aiMsg } = await supabase
      .from('messages')
      .insert({ id: uuidv4(), chat_id: chat.id, role: 'assistant', content })
      .select()
      .single();

    // OPTIONAL: Save the parsed design
    if (Object.keys(parsedDesign.materials).length > 0) {
      await supabase
        .from('designs')
        .insert({
          id: uuidv4(),
          user_id: req.user.id,
          chat_id: chat.id,
          mix_design: parsedDesign.materials,
          compliance: { code: chat.code_standard || 'EN206' },
          input_params: { code_standard: chat.code_standard || 'EN206' }
        });
    }

    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id);

    return created(res, { ...aiMsg, status: 'delivered', design: parsedDesign });
  } catch (err) {
    logger.error('AI response error', { error: err.message });
    return res.status(503).json({ success: false, error: { code: 'AI_UNAVAILABLE', message: err.message } });
  }
});

// ─── POST /api/chats/:chat_id/ai-response-stream ─────────────────
router.post('/:chat_id/ai-response-stream', async (req, res) => {
  try {
    const chat = await getOwnedChat(req.params.chat_id, req.user.id);
    if (!chat) return notFound(res, 'Chat');

    const { data: messages } = await supabase
      .from('messages')
      .select('role, content')
      .eq('chat_id', chat.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (!messages?.length) {
      return res.status(400).json({ success: false, error: { code: 'EMPTY_CHAT', message: 'No messages to respond to' } });
    }

    const fullContent = await streamAIResponse(messages, res);

    // Persist after streaming completes
    if (fullContent) {
      await supabase.from('messages').insert({ id: uuidv4(), chat_id: chat.id, role: 'assistant', content: fullContent });
      await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id);
    }
  } catch (err) {
    logger.error('Streaming handler error', { error: err.message });
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        error: {
          code: 'SERVER_ERROR',
          message: err.message
        }
      });
    }
  }
});

module.exports = router;