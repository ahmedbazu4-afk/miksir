const axios = require('axios');
const logger = require('../utils/logger');

/**
 * Get a response from Claude using the Anthropic API
 */
async function getAIResponse(messages, codeStandard = 'EN206') {  // ← ADD PARAMETER
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;

    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    const startTime = Date.now();

    logger.info('🤖 Calling Claude API', { messageCount: formattedMessages.length, codeStandard });

    // ← UPDATE SYSTEM PROMPT
    const systemPrompt = `You are Miksir, an AI assistant for concrete mix design.
You help civil engineers design concrete mixes that comply with ${codeStandard} standard.

When a user describes their concrete project, you:
1. Clarify their requirements (strength, exposure class, workability)
2. Recommend a mix design with specific cement, aggregate, water quantities (in kg/m³)
3. Explain why you chose those materials
4. Verify compliance with ${codeStandard} codes
5. Suggest any special considerations

ALWAYS format the mix design as a markdown table:
| Material | kg/m³ |
|----------|-------|
| Cement | 310 |
| Water | 185 |
| Fine Aggregate | 650 |
| Coarse Aggregate | 1050 |
CRITICAL: At the very end of your response, ALWAYS include a section titled "### 🛡️ Confidence & Compliance". 
In this section, provide:
- A "Confidence Score" (e.g., 95%) based on how standard the request is.
- A brief comparative context (e.g., "This W/C ratio of 0.45 is strictly below the ACI 211 maximum of 0.50 for severe exposure, ensuring long-term durability.
CRITICAL: If the user mentions a project location or city in their message, you MUST output a line exactly like this at the bottom of your response:
Location: [City Name]
If no location is mentioned, do not include this line.
If the user asks for a pouring schedule, weather conditions, or slump loss predictions, check if real-time weather data was provided in a [SYSTEM NOTE] at the end of their message. If the data is there, USE IT to generate an accurate daily schedule and slump loss warning. Do not say it is outside your scope if you have the data

Include W/C Ratio and Air Content.`;

    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-6', 
        max_tokens: 4096,
        system: systemPrompt, 
        messages: formattedMessages
      },
      {
        // THIS IS THE MISSING PIECE 👇
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        }
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
        model: 'claude-sonnet-4-6',
        max_tokens: 4096,
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