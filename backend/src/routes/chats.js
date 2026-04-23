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
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .eq('id', chatId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .single();
  if (error || !data) return null;
  return data;
};

// ─── POST /api/chats ─────────────────────────────────────────────
router.post('/', validate(createChatSchema), async (req, res) => {
  try {
    const title = req.body.title || `Concrete Design ${new Date().toLocaleDateString('en-GB')}`;

    const { data, error } = await supabase
      .from('chats')
      .insert({ id: uuidv4(), user_id: req.user.id, title })
      .select()
      .single();

    if (error) {
      logger.error('Create chat error', { error: error.message });
      return serverError(res);
    }

    return created(res, { ...data, messages: [] }, 'Chat created');
  } catch (err) {
    logger.error('Create chat handler error', { error: err.message });
    return serverError(res);
  }
});

// ─── GET /api/chats ──────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;
    const sort   = ['created_at', 'updated_at', 'title'].includes(req.query.sort) ? req.query.sort : 'created_at';
    const order  = req.query.order === 'asc' ? true : false;

    const { data, error, count } = await supabase
      .from('chats')
      .select('id, title, created_at, updated_at', { count: 'exact' })
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .order(sort, { ascending: order })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Get chats error', { error: error.message });
      return serverError(res);
    }

    // Fetch message counts
    const chatIds = (data || []).map((c) => c.id);
    let messageCounts = {};
    if (chatIds.length) {
      const { data: msgs } = await supabase
        .from('messages')
        .select('chat_id')
        .in('chat_id', chatIds)
        .is('deleted_at', null);
      (msgs || []).forEach((m) => {
        messageCounts[m.chat_id] = (messageCounts[m.chat_id] || 0) + 1;
      });
    }

    const chats = (data || []).map((c) => ({ ...c, message_count: messageCounts[c.id] || 0 }));

    return success(res, { chats, pagination: { total: count || 0, limit, offset } });
  } catch (err) {
    logger.error('Get chats handler error', { error: err.message });
    return serverError(res);
  }
});

// ─── GET /api/chats/:chat_id ─────────────────────────────────────
router.get('/:chat_id', async (req, res) => {
  try {
    const chat = await getOwnedChat(req.params.chat_id, req.user.id);
    if (!chat) return notFound(res, 'Chat');

    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('id, role, content, created_at')
      .eq('chat_id', chat.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (msgErr) {
      logger.error('Get messages error', { error: msgErr.message });
      return serverError(res);
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

    return success(res, { ...chat, messages: messages || [], design_output: design || null });
  } catch (err) {
    logger.error('Get chat handler error', { error: err.message });
    return serverError(res);
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

    if (error) return serverError(res);
    return success(res, data, 'Chat updated');
  } catch (err) {
    logger.error('Update chat handler error', { error: err.message });
    return serverError(res);
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
    return serverError(res);
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
      return serverError(res);
    }

    // Update chat timestamp
    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id);

    return created(res, { ...data, status: 'delivered' });
  } catch (err) {
    logger.error('Post message handler error', { error: err.message });
    return serverError(res);
  }
});

// ─── POST /api/chats/:chat_id/ai-response ────────────────────────
router.post('/:chat_id/ai-response', async (req, res) => {
  try {
    const chat = await getOwnedChat(req.params.chat_id, req.user.id);
    if (!chat) return notFound(res, 'Chat');

    // Fetch full message history
    const { data: messages, error: msgErr } = await supabase
      .from('messages')
      .select('role, content')
      .eq('chat_id', chat.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });

    if (msgErr || !messages?.length) {
      return res.status(400).json({ success: false, error: { code: 'EMPTY_CHAT', message: 'No messages to respond to' } });
    }

    // Call Claude
    const { content, thinkingTimeMs } = await getAIResponse(messages);

    // Persist AI message
    const { data: aiMsg, error: saveErr } = await supabase
      .from('messages')
      .insert({ id: uuidv4(), chat_id: chat.id, role: 'assistant', content })
      .select()
      .single();

    if (saveErr) {
      logger.error('Save AI message error', { error: saveErr.message });
      return serverError(res);
    }

    await supabase.from('chats').update({ updated_at: new Date().toISOString() }).eq('id', chat.id);

    return created(res, { ...aiMsg, status: 'delivered', thinking_time_ms: thinkingTimeMs });
  } catch (err) {
    if (err.message.includes('timed out') || err.message.includes('unavailable')) {
      return res.status(503).json({ success: false, error: { code: 'AI_UNAVAILABLE', message: err.message } });
    }
    logger.error('AI response handler error', { error: err.message });
    return serverError(res);
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
    if (!res.headersSent) return serverError(res);
  }
});

module.exports = router;
