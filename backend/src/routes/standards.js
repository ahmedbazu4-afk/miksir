const express = require('express');
const router = express.Router();
const { STANDARDS, EXPOSURE_CLASSES, EN_EXPOSURE_LIMITS } = require('../data/standards');
const { success, notFound } = require('../utils/response');

// GET /api/standards
router.get('/', (req, res) => {
  success(res, { standards: STANDARDS });
});

// GET /api/standards/:standard_id/exposure-classes
router.get('/:standard_id/exposure-classes', (req, res) => {
  const id = req.params.standard_id.toUpperCase();
  const classes = EXPOSURE_CLASSES[id];
  if (!classes) return notFound(res, 'Standard');
  const standard = STANDARDS.find((s) => s.id === id);
  success(res, { standard: standard?.name || id, exposure_classes: classes });
});

// GET /api/standards/:standard_id/w-c-limits?exposure_class=XC3&strength=C35
router.get('/:standard_id/w-c-limits', (req, res) => {
  const id = req.params.standard_id.toUpperCase();
  const exposureClass = (req.query.exposure_class || '').toUpperCase();
  const strength = req.query.strength || '';

  const limits = EN_EXPOSURE_LIMITS[exposureClass];
  if (!limits) return notFound(res, 'Exposure class');

  const standard = STANDARDS.find((s) => s.id === id);

  success(res, {
    standard: standard?.name || id,
    exposure_class: exposureClass,
    strength: strength || 'any',
    w_c_ratio_limit: limits.max_wc,
    min_cement: limits.min_cement,
    min_strength_class: `C${limits.min_strength}`,
    reference: `${standard?.name || id} — ${exposureClass} exposure limits`,
  });
});

module.exports = router;
