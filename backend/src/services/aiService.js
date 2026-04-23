const Anthropic = require('@anthropic-ai/sdk');
const logger = require('../utils/logger');

const client = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';
const MAX_TOKENS = parseInt(process.env.CLAUDE_MAX_TOKENS) || 4096;
const TIMEOUT_MS = 30000;

/**
 * System prompt that turns Claude into an expert concrete mix design assistant.
 */
const SYSTEM_PROMPT = `You are Miksir, an expert AI assistant for concrete mix design. You help civil engineers and construction professionals design concrete mixes that comply with international standards (ACI 211, EN 206, TS 500, BS 8500).

Your role is to:
1. Ask clarifying questions to gather all required parameters for a mix design
2. Guide users through exposure class selection, strength requirements, material properties, and workability
3. Explain code requirements and why they matter
4. Flag potential conflicts (e.g., exposure class incompatible with requested strength)
5. Provide practical field advice

When gathering mix design information, you need:
- Structure type and location
- Exposure class (use the relevant code standard for the region)
- Required characteristic strength (e.g., C30, C35, C40)
- Aggregate properties: max size, fineness modulus of FA, specific gravities, absorption, moisture
- Cement type and specific gravity
- Workability (slump range, placement method)
- Any admixtures needed

Once you have all necessary information, summarize the inputs and confirm with the user before they proceed to generate the final mix design.

Be concise but thorough. Use engineering terminology appropriately. When users are in Turkey, default to TS 500. When in Europe, use EN 206. When in USA/Canada, use ACI 211. When in UK, use BS 8500.

Do NOT perform full calculations yourself — that is done by the backend calculation engine. Your job is to collect correct inputs and explain the design rationale.`;

/**
 * Call Claude API with the full message history for a chat.
 * Returns the assistant's text response.
 *
 * @param {Array} messages - Array of { role, content } objects (full history)
 * @returns {Promise<{ content: string, thinkingTimeMs: number }>}
 */
const getAIResponse = async (messages) => {
  const start = Date.now();

  // Format messages for Anthropic API
  const apiMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
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

    return {
      content,
      thinkingTimeMs: Date.now() - start,
    };
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      logger.error('Claude API timeout');
      throw new Error('AI response timed out. Please try again.');
    }
    logger.error('Claude API error', { error: err.message, status: err.status });
    throw new Error('AI service unavailable. Please try again shortly.');
  }
};

/**
 * Stream Claude response via Server-Sent Events.
 *
 * @param {Array} messages - Full chat history
 * @param {import('express').Response} res - Express response object (SSE)
 */
const streamAIResponse = async (messages, res) => {
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

    res.write(`data: ${JSON.stringify({ type: 'done', full_content: fullContent })}\n\n`);
    res.end();
    return fullContent;
  } catch (err) {
    logger.error('Streaming error', { error: err.message });
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Streaming failed' })}\n\n`);
    res.end();
    throw err;
  }
};

module.exports = { getAIResponse, streamAIResponse };
