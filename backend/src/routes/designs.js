const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const supabase = require('../utils/supabase');
const { authenticate } = require('../middleware/auth');
const { validate, generateDesignSchema } = require('../middleware/validation');
const { success, created, serverError, notFound, error: apiError } = require('../utils/response');
const { calculateMixDesign, validateMixDesignInputs } = require('../services/mixDesignEngine');
const { generateMixDesignPDF } = require('../services/pdfService');
const logger = require('../utils/logger');

router.use(authenticate);

// ─── POST /api/designs/validate ──────────────────────────────────
router.post('/validate', validate(generateDesignSchema), async (req, res) => {
  try {
    const result = validateMixDesignInputs(req.body);
    return success(res, result);
  } catch (err) {
    logger.error('Validate design error', { error: err.message });
    return serverError(res);
  }
});

// ─── POST /api/designs/generate ──────────────────────────────────
router.post('/generate', validate(generateDesignSchema), async (req, res) => {
  try {
    const input = req.body;

    // Pre-check for conflicts
    const preCheck = validateMixDesignInputs(input);
    if (!preCheck.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MIX_DESIGN_CONFLICT',
          message: 'Mix design inputs have conflicts that must be resolved first',
          details: preCheck.conflicts,
        },
        warnings: preCheck.warnings,
      });
    }

    // Verify chat ownership if chat_id provided
    if (input.chat_id) {
      const { data: chat } = await supabase
        .from('chats')
        .select('id')
        .eq('id', input.chat_id)
        .eq('user_id', req.user.id)
        .is('deleted_at', null)
        .single();

      if (!chat) {
        return apiError(res, 'Chat not found or access denied', 'FORBIDDEN', null, 403);
      }
    }

    // Run calculation engine
    let calcResult;
    try {
      calcResult = calculateMixDesign(input);
    } catch (calcErr) {
      logger.warn('Calculation error', { error: calcErr.message, userId: req.user.id });
      return apiError(res, calcErr.message, 'CALCULATION_ERROR', null, 400);
    }

    const { mixDesign, compliance, justification, qaNotes, fieldTips, warnings } = calcResult;

    // Persist design
    const designId = uuidv4();
    const { data: savedDesign, error: saveErr } = await supabase
      .from('designs')
      .insert({
        id: designId,
        user_id: req.user.id,
        chat_id: input.chat_id || null,
        mix_design: mixDesign,
        compliance,
        justification,
        qa_notes: qaNotes,
        field_tips: fieldTips,
        input_params: input,           // store full input for reproducibility
      })
      .select()
      .single();

    if (saveErr) {
      logger.error('Save design error', { error: saveErr.message });
      return serverError(res);
    }

    return created(res, {
      design_id: savedDesign.id,
      chat_id: input.chat_id || null,
      mix_design: mixDesign,
      compliance,
      justification,
      qa_notes: qaNotes,
      field_tips: fieldTips,
      warnings,
      created_at: savedDesign.created_at,
    }, 'Mix design generated successfully');
  } catch (err) {
    logger.error('Generate design handler error', { error: err.message, stack: err.stack });
    return serverError(res);
  }
});

// ─── GET /api/designs ────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const limit  = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = parseInt(req.query.offset) || 0;

    const { data, error, count } = await supabase
      .from('designs')
      .select('id, chat_id, created_at, mix_design, compliance', { count: 'exact' })
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Get designs error', { error: error.message });
      return serverError(res);
    }

    const designs = (data || []).map((d) => ({
      id: d.id,
      chat_id: d.chat_id,
      created_at: d.created_at,
      summary: buildSummary(d),
    }));

    return success(res, { designs, pagination: { total: count || 0, limit, offset } });
  } catch (err) {
    logger.error('Get designs handler error', { error: err.message });
    return serverError(res);
  }
});

// ─── GET /api/designs/:design_id ─────────────────────────────────
router.get('/:design_id', async (req, res) => {
  const { data, error } = await supabase
    .from('designs')
    .select(`
      *,
      chats(id, title, code_standard)
    `)
    .eq('id', req.params.design_id)
    .eq('user_id', req.user.id)
    .is('deleted_at', null)
    .single();

  if (error || !data) return notFound(res, 'Design');
  return success(res, data);
});

// ─── GET /api/designs/:design_id/export/pdf ──────────────────────
router.get('/:design_id/export/pdf', authenticate, async (req, res) => {
  try {
    const designId = req.params.design_id;

    // 1. Fetch the design
    const { data: design, error } = await supabase
      .from('designs')
      .select('*')
      .eq('id', designId)
      .single();

    if (error || !design) {
      return res.status(404).json({ error: 'Design not found' });
    }

    // 2. Generate the PDF Buffer
    const pdfBuffer = await generateMixDesignPDF(design);

    // 3. Send back to frontend as a downloadable file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Miksir-Mix-Design.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

  } catch (error) {
    console.error('PDF Generation Error', error);
    res.status(500).json({ error: 'Failed to generate PDF document' });
  }
});

// ─── GET /api/designs/:design_id/export/json ─────────────────────
router.get('/:design_id/export/json', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('designs')
      .select('*')
      .eq('id', req.params.design_id)
      .eq('user_id', req.user.id)
      .is('deleted_at', null)
      .single();

    if (error || !data) return notFound(res, 'Design');

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="miksir-design-${data.id.slice(0, 8)}.json"`);
    res.send(JSON.stringify(data, null, 2));
  } catch (err) {
    logger.error('JSON export error', { error: err.message });
    return serverError(res);
  }
});

// ─── Helper ──────────────────────────────────────────────────────
const buildSummary = (d) => {
  const md = d.mix_design;
  const cc = d.compliance;
  return [
    md?.w_c_ratio ? `w/c ${md.w_c_ratio}` : null,
    cc?.code || null,
    md?.target_mean_strength ? `Target ${md.target_mean_strength - 8} MPa` : null,
  ].filter(Boolean).join(', ');
};

module.exports = router;
