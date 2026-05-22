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

    const lastMsg = formattedMessages[formattedMessages.length - 1];
    if (lastMsg && lastMsg.role === 'user') {
      lastMsg.content += '\n\nCRITICAL SYSTEM REQUIREMENT: You must end your response with the <pdf_data> JSON block containing the mix_design and compliance data. Do not forget this.';
    }

    const startTime = Date.now();

    logger.info('🤖 Calling Claude API', { messageCount: formattedMessages.length, codeStandard });

    // ← UPDATE SYSTEM PROMPT
    // Replace your current systemPrompt with this:
    const systemPrompt = `You are Miksir, an AI assistant for concrete mix design.
    You help civil engineers design concrete mixes that comply with ${codeStandard} standard.

    When a user describes their concrete project, you:
    1. Clarify their requirements
    2. Recommend a mix design (materials in kg/m³)
    3. Verify compliance with ${codeStandard}
    4. Suggest special considerations

    CRITICAL INSTRUCTIONS:
    At the very end of your response, you MUST include a raw JSON block enclosed in <pdf_data> tags. This data will be used to generate a PDF report. Ensure all quantities are numbers. 
    Follow this EXACT JSON structure inside the tags:

    <pdf_data>
    {
      "mix_design": {
        "cement": 340,
        "water": 170,
        "fine_aggregate": 650,
        "coarse_aggregate": 1050,
        "w_c_ratio": 0.50,
        "target_mean_strength": 38,
        "admixtures": { "Superplasticizer": 2.5, "Air-entraining": 0.5 },
        "batching": { "cement": 340, "water_to_add": 165, "fine_aggregate": 660, "coarse_aggregate": 1055 }
      },
      "compliance": {
        "code": "${codeStandard}",
        "checks": [
          { "status": "PASS", "description": "Max W/C Ratio", "limit": 0.55, "actual": 0.50 },
          { "status": "WARNING", "description": "Min Cement Content", "limit": 300, "actual": 340, "unit": "kg" }
        ]
      },
      "qa_notes": "A brief paragraph explaining the main quality assurance concerns for this specific mix.",
      "field_tips": [
        "Ensure continuous curing for at least 7 days.",
        "Vibrate adequately to remove entrapped air."
      ],
      "justification": {
        "material_choice": "Selected CEM I for rapid strength development.",
        "durability": "W/C ratio kept low to resist freeze-thaw cycles."
      },
      "location": "City Name if mentioned, otherwise null"
    }
    </pdf_data>
    [After the tags, proceed with your conversational response...]
    `;

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

    // 🟢 RUN THE PARSER HERE
    const parsedData = parseMixDesignResponse(content);

    logger.info('✅ Claude API success', {
      responseLength: content.length,
      thinkingTimeMs
    });

    // 🟢 RETURN THE CLEAN TEXT AND THE PDF DATA SEPARATELY
    return { 
      content: parsedData.clean_text,  // The UI and Database get the clean text
      pdfData: parsedData,             // The PDF service gets the extracted JSON
      thinkingTimeMs 
    };
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