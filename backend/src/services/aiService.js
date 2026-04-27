const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

// Initialize Anthropic client
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  logger.warn('⚠️  ANTHROPIC_API_KEY not set - Claude API calls will fail');
}

const client = apiKey ? new Anthropic({ apiKey }) : null;
const MODEL = 'claude-3-5-haiku-20241022'; // Fast and cheap
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 30000;

/**
 * System prompt for concrete mix design assistant
 */
const SYSTEM_PROMPT = `You are Miksir, an expert AI assistant for concrete mix design. Help civil engineers design concrete mixes that comply with ACI 211, EN 206, TS 500, and BS 8500.

You help by:
1. Asking clarifying questions about the project (structure type, location, exposure class, strength requirements)
2. Explaining code requirements and practical considerations
3. Flagging potential design conflicts
4. Summarizing inputs before the user generates the final mix design

You do NOT perform full calculations — the backend handles that. Your job is to gather correct inputs and explain the design rationale.

Be concise and use engineering terminology. Default to:
- TS 500 for Turkey
- EN 206 for Europe
- ACI 211 for USA/Canada
- BS 8500 for UK`;

/**
 * Call Claude Haiku API with the full message history for a chat.
 * Returns the assistant's text response.
 *
 * @param {Array} messages - Array of { role, content } objects (full history)
 * @returns {Promise<{ content: string, thinkingTimeMs: number }>}
 */
const getAIResponse = async (messages) => {
  const start = Date.now();

  // Check if client is initialized
  if (!client) {
    logger.error('❌ Anthropic client not initialized - ANTHROPIC_API_KEY is missing');
    throw new Error('AI service not configured. Please set ANTHROPIC_API_KEY environment variable.');
  }

  // Format messages for Anthropic API
  const apiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    logger.info('🤖 Calling Claude Haiku API', { 
      model: MODEL,
      messageCount: apiMessages.length
    });

    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    }, { signal: controller.signal });

    clearTimeout(timer);

    const content = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const thinkingTimeMs = Date.now() - start;
    
    logger.info('✅ Claude Haiku response received', { 
      responseLength: content.length,
      thinkingTimeMs 
    });

    return {
      content,
      thinkingTimeMs,
    };
  } catch (err) {
    clearTimeout(timer);
    
    if (err.name === 'AbortError') {
      logger.error('⏱️  Claude API timeout', { timeoutMs: TIMEOUT_MS });
      throw new Error('AI response timed out. Please try again.');
    }
    
    if (err.status === 401 || err.status === 403) {
      logger.error('🔐 API authentication error', { status: err.status, message: err.message });
      throw new Error('Invalid API credentials. Check ANTHROPIC_API_KEY.');
    }
    
    if (err.status === 429) {
      logger.error('⚠️  Rate limited by Claude API', { message: err.message });
      throw new Error('API rate limit exceeded. Please try again in a moment.');
    }
    
    logger.error('❌ Claude API error', { 
      status: err.status,
      error: err.message,
      type: err.error?.type
    });
    
    throw new Error('AI service unavailable. Please try again shortly.');
  }
};

/**
 * Stream Claude response via Server-Sent Events.
 * Uses Haiku model for fast responses.
 *
 * @param {Array} messages - Full chat history
 * @param {import('express').Response} res - Express response object (SSE)
 */
const streamAIResponse = async (messages, res) => {
  if (!client) {
    logger.error('Anthropic client not initialized');
    throw new Error('AI service not configured.');
  }

  const apiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let fullContent = '';

  try {
    logger.info('🎬 Starting Claude Haiku stream', { 
      model: MODEL,
      messageCount: apiMessages.length
    });

    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: apiMessages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const chunk = event.delta.text;
        fullContent += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', text: chunk })}\n\n`);
      }
    }

    logger.info('✅ Stream completed successfully', { 
      fullLength: fullContent.length 
    });

    res.write(`data: ${JSON.stringify({ type: 'done', full_content: fullContent })}\n\n`);
    res.end();
    return fullContent;
  } catch (err) {
    logger.error('❌ Streaming error', { 
      error: err.message,
      status: err.status 
    });
    
    res.write(`data: ${JSON.stringify({ 
      type: 'error', 
      message: 'Streaming failed: ' + err.message 
    })}\n\n`);
    res.end();
    throw err;
  }
};

module.exports = { getAIResponse, streamAIResponse };