const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Get a response from Claude using the Anthropic API
 */
async function getAIResponse(messages) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }

    // Format messages for Claude API
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const startTime = Date.now();

    logger.info('🤖 Calling Claude API', {
      messageCount: formattedMessages.length,
      model: 'claude-3-5-haiku-20241022'
    });

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: `You are Miksir, an AI assistant for concrete mix design. You help civil engineers design concrete mixes that comply with ACI 211, EN 206, BS 8500, and TS 500 standards.

When a user describes their concrete project, you:
1. Clarify their requirements (strength, exposure class, workability, etc.)
2. Recommend a mix design with specific cement, aggregate, water, and admixture quantities
3. Explain why you chose those materials
4. Verify compliance with relevant codes
5. Suggest any special considerations

Always be technical but clear. Provide specific quantities in kg/m³. Ask follow-up questions if needed.`,
        messages: formattedMessages
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 30000
      }
    );

    const thinkingTimeMs = Date.now() - startTime;

    // Extract text from response
    const content = response.data.content[0]?.text || '';

    if (!content) {
      throw new Error('Claude returned empty response');
    }

    logger.info('✅ Claude API success', {
      responseLength: content.length,
      thinkingTimeMs
    });

    return { content, thinkingTimeMs };
  } catch (err) {
    logger.error('❌ Claude API error', {
      error: err.message,
      status: err.response?.status,
      data: err.response?.data
    });

    throw new Error(`AI service unavailable. Please try again shortly.`);
  }
}

/**
 * Stream a response from Claude (for real-time updates)
 */
async function streamAIResponse(messages, res) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    logger.info('🤖 Starting Claude API stream');

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 1024,
        system: `You are Miksir, an AI assistant for concrete mix design. You help civil engineers design concrete mixes that comply with ACI 211, EN 206, BS 8500, and TS 500 standards.

When a user describes their concrete project, you:
1. Clarify their requirements (strength, exposure class, workability, etc.)
2. Recommend a mix design with specific cement, aggregate, water, and admixture quantities
3. Explain why you chose those materials
4. Verify compliance with relevant codes
5. Suggest any special considerations

Always be technical but clear. Provide specific quantities in kg/m³. Ask follow-up questions if needed.`,
        messages: formattedMessages
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        timeout: 30000
      }
    );

    const content = response.data.content[0]?.text || '';

    if (!content) {
      throw new Error('Claude returned empty response');
    }

    // Set response headers for streaming
    res.setHeader('Content-Type', 'application/json');
    res.write(JSON.stringify({
      success: true,
      data: { content },
      message: 'AI response generated'
    }));
    res.end();

    logger.info('✅ Claude API stream completed');

    return content;
  } catch (err) {
    logger.error('❌ Claude streaming error', {
      error: err.message
    });

    if (!res.headersSent) {
      res.status(503).json({
        success: false,
        error: {
          code: 'AI_SERVICE_ERROR',
          message: 'AI service unavailable'
        }
      });
    }

    throw err;
  }
}

module.exports = { getAIResponse, streamAIResponse };