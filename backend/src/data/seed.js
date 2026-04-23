require('dotenv').config();
const supabase = require('../utils/supabase');
const { STANDARDS, EXPOSURE_CLASSES, EN_EXPOSURE_LIMITS } = require('../data/standards');
const logger = require('../utils/logger');

async function seed() {
  logger.info('🌱 Starting seed...');

  // ─── Standards ──────────────────────────────────────────────
  logger.info('Seeding standards...');
  const { error: stdErr } = await supabase
    .from('standards')
    .upsert(STANDARDS, { onConflict: 'id' });
  if (stdErr) { logger.error('Standards seed error', { error: stdErr.message }); process.exit(1); }
  logger.info(`  ✓ ${STANDARDS.length} standards`);

  // ─── Exposure classes ────────────────────────────────────────
  logger.info('Seeding exposure classes...');
  const allClasses = [];
  for (const [stdId, classes] of Object.entries(EXPOSURE_CLASSES)) {
    for (const cls of classes) {
      allClasses.push({ standard_id: stdId, code: cls.code, name: cls.name, description: cls.description });
    }
  }
  const { error: clsErr } = await supabase
    .from('exposure_classes')
    .upsert(allClasses, { onConflict: 'standard_id,code' });
  if (clsErr) { logger.error('Exposure classes seed error', { error: clsErr.message }); process.exit(1); }
  logger.info(`  ✓ ${allClasses.length} exposure classes`);

  // ─── Code limits (EN 206 / TS 500 shared) ───────────────────
  logger.info('Seeding code limits...');
  const limits = [];
  for (const [expCode, vals] of Object.entries(EN_EXPOSURE_LIMITS)) {
    for (const stdId of ['EN_206', 'TS_500', 'BS_8500', 'ACI_211']) {
      limits.push({
        standard_id:    stdId,
        exposure_class: expCode,
        max_wc_ratio:   vals.max_wc,
        min_cement:     vals.min_cement,
        min_strength:   vals.min_strength,
        reference:      `${stdId} — ${expCode} durability requirements`,
      });
    }
  }
  const { error: limErr } = await supabase
    .from('code_limits')
    .upsert(limits, { onConflict: 'standard_id,exposure_class' });
  if (limErr) { logger.error('Code limits seed error', { error: limErr.message }); process.exit(1); }
  logger.info(`  ✓ ${limits.length} code limit entries`);

  logger.info('✅ Seed complete!');
  process.exit(0);
}

seed().catch((err) => {
  logger.error('Seed failed', { error: err.message });
  process.exit(1);
});
