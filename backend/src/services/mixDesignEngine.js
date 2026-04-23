/**
 * Concrete Mix Design Calculation Engine
 * Implements the ACI 211.1 9-step procedure as described in the lecture PDF.
 * Also applies EN 206 / TS 500 durability limits when those standards are selected.
 */

const {
  ACI_WATER_NON_AIR,
  ACI_WATER_AIR,
  ACI_CA_VOLUME,
  EN_EXPOSURE_LIMITS,
  parseStrength,
  interpolateWC,
  slumpBucket,
  nearestAggSize,
  nearestFM,
} = require('../data/standards');

/**
 * Run the full ACI 211 9-step mix design calculation.
 *
 * @param {Object} input - Validated mix design input from generateDesignSchema
 * @returns {{ mixDesign, compliance, justification, qaNotes, fieldTips, warnings }}
 */
const calculateMixDesign = (input) => {
  const {
    project_context: { exposure_class, code_standard },
    strength_requirements: { target_strength, durability_rating },
    materials,
    workability: { slump },
  } = input;

  const {
    cement_type,
    cement_specific_gravity = 3.15,
    coarse_aggregate_size,
    coarse_aggregate_unit_weight = 1600,      // kg/m³ dry-rodded
    coarse_aggregate_bulk_sg_ssd = 2.68,
    coarse_aggregate_absorption = 0.5,        // %
    coarse_aggregate_moisture = 2.0,          // %
    fine_aggregate_fineness_modulus = 2.6,
    fine_aggregate_bulk_sg_ssd = 2.62,
    fine_aggregate_absorption = 1.0,          // %
    fine_aggregate_moisture = 5.0,            // %
    air_entrained = false,
  } = materials;

  const strengthMPa = parseStrength(target_strength);
  if (!strengthMPa) throw new Error(`Cannot parse strength value: ${target_strength}`);

  // ─── Step 1: Slump ───────────────────────────────────────────
  const slumpBucketKey = slumpBucket(slump);

  // ─── Step 2: Maximum aggregate size (given by user) ──────────
  const aggSizeKey = nearestAggSize(coarse_aggregate_size);

  // ─── Step 3: Water content & air content ─────────────────────
  const waterTable = air_entrained ? ACI_WATER_AIR : ACI_WATER_NON_AIR;
  const waterContent = waterTable[slumpBucketKey]?.[aggSizeKey];
  if (!waterContent) throw new Error('Cannot find water content for given slump/aggregate size combination');

  let airContentPct;
  if (!air_entrained) {
    airContentPct = ACI_WATER_NON_AIR.AIR_PCT[aggSizeKey] || 1.5;
  } else {
    const airKey = durability_rating === 'very_high' || durability_rating === 'high'
      ? 'SEVERE_AIR'
      : durability_rating === 'moderate'
        ? 'MODERATE_AIR'
        : 'MILD_AIR';
    airContentPct = ACI_WATER_AIR[airKey]?.[aggSizeKey] || 4.5;
  }

  // ─── Step 4: w/c ratio ───────────────────────────────────────
  let wcRatioStrength = interpolateWC(strengthMPa, air_entrained);

  // Apply durability w/c limit from EN 206 / TS 500
  let wcRatioLimit = null;
  const exposureLimits = EN_EXPOSURE_LIMITS[exposure_class.toUpperCase()];
  if (exposureLimits) {
    wcRatioLimit = exposureLimits.max_wc;
  }

  // Use the more restrictive (lower) of strength-based and durability-based w/c
  const wcRatio = wcRatioLimit
    ? Math.min(wcRatioStrength, wcRatioLimit)
    : wcRatioStrength;

  // ─── Step 5: Cement content ──────────────────────────────────
  const cementContent = Math.ceil(waterContent / wcRatio); // kg/m³

  // ─── Step 6: Coarse aggregate content ───────────────────────
  const fmKey = nearestFM(fine_aggregate_fineness_modulus);
  const caVolumePerM3 = ACI_CA_VOLUME[aggSizeKey]?.[fmKey];
  if (!caVolumePerM3) throw new Error('Cannot find coarse aggregate volume for given parameters');

  const caDryWeight = caVolumePerM3 * coarse_aggregate_unit_weight;          // kg/m³
  const caSsdWeight = caDryWeight * (1 + coarse_aggregate_absorption / 100); // SSD

  // ─── Step 7: Fine aggregate content ─────────────────────────
  const volCement  = cementContent / (cement_specific_gravity * 1000); // m³
  const volWater   = waterContent / 1000;                               // m³
  const volCA      = caSsdWeight / (coarse_aggregate_bulk_sg_ssd * 1000); // m³ SSD
  const volAir     = airContentPct / 100;                               // m³

  const volFA      = 1 - (volCement + volWater + volCA + volAir);       // m³
  if (volFA <= 0) throw new Error('Fine aggregate volume is negative — check material inputs');

  const faSsdWeight = volFA * fine_aggregate_bulk_sg_ssd * 1000;        // kg/m³ SSD
  const faDryWeight = faSsdWeight / (1 + fine_aggregate_absorption / 100);

  // ─── Step 8: Moisture adjustments ───────────────────────────
  const caCurrentWeight = caDryWeight * (1 + coarse_aggregate_moisture / 100);
  const faCurrentWeight = faDryWeight * (1 + fine_aggregate_moisture / 100);

  // Water added = design water - water contributed by aggregates above SSD
  const caExcessWater = caDryWeight * ((coarse_aggregate_moisture - coarse_aggregate_absorption) / 100);
  const faExcessWater = faDryWeight * ((fine_aggregate_moisture - fine_aggregate_absorption) / 100);
  const waterAdded    = waterContent - caExcessWater - faExcessWater;

  // ─── Round final quantities ──────────────────────────────────
  const r = (v, dp = 0) => parseFloat(v.toFixed(dp));

  const mixDesign = {
    // SSD basis (design quantities)
    cement:                r(cementContent),
    water:                 r(waterContent),
    fine_aggregate_ssd:    r(faSsdWeight),
    coarse_aggregate_ssd:  r(caSsdWeight),
    air_content_pct:       r(airContentPct, 1),
    w_c_ratio:             r(wcRatio, 3),
    target_mean_strength:  r(strengthMPa + 8, 0), // +8 MPa margin typical

    // Volumetric breakdown (m³/m³ concrete)
    volumes: {
      cement:           r(volCement, 4),
      water:            r(volWater, 4),
      coarse_aggregate: r(volCA, 4),
      fine_aggregate:   r(volFA, 4),
      air:              r(volAir, 4),
      total:            r(volCement + volWater + volCA + volFA + volAir, 4),
    },

    // Batching quantities (current moisture state)
    batching: {
      cement:           r(cementContent),     // doesn't change
      water_to_add:     r(Math.max(waterAdded, 0)),
      fine_aggregate:   r(faCurrentWeight),
      coarse_aggregate: r(caCurrentWeight),
    },

    // Unit weight of fresh concrete
    unit_weight: r(cementContent + waterContent + faSsdWeight + caSsdWeight),

    admixtures: buildAdmixtureOutput(materials.admixtures, cementContent),
  };

  // ─── Compliance checks ───────────────────────────────────────
  const compliance = buildComplianceChecks({
    exposure_class, code_standard, wcRatio, wcRatioLimit, wcRatioStrength,
    cementContent, slump, airContentPct, air_entrained, strengthMPa,
    exposureLimits,
  });

  // ─── Justification ───────────────────────────────────────────
  const justification = {
    cement_type:   `${cement_type} selected. Specific gravity: ${cement_specific_gravity}.`,
    w_c_ratio:     wcRatioLimit && wcRatioLimit < wcRatioStrength
      ? `w/c limited to ${wcRatio} by ${exposure_class} durability requirement (strength alone would permit ${wcRatioStrength}).`
      : `w/c = ${wcRatio} per ACI Table 14.8 for ${strengthMPa} MPa target strength.`,
    water_content: `${waterContent} kg/m³ based on ${slump} mm slump and ${aggSizeKey} mm aggregate (ACI Table ${air_entrained ? '14.7' : '14.6'}).`,
    cement_content:`${cementContent} kg/m³ = ${waterContent} / ${wcRatio} (water ÷ w/c).`,
    coarse_agg:    `Volume factor ${caVolumePerM3} from ACI Table 14.10 (CA size ${aggSizeKey} mm, FA fineness modulus ${fmKey}). SSD weight: ${r(caSsdWeight)} kg/m³.`,
    fine_agg:      `Fine aggregate fills remaining volume (1 - ${r(volCement + volWater + volCA + volAir, 3)} m³ = ${r(volFA, 3)} m³). SSD weight: ${r(faSsdWeight)} kg/m³.`,
    air:           `${r(airContentPct, 1)}% ${air_entrained ? 'entrained' : 'entrapped'} air for ${aggSizeKey} mm aggregate.`,
    moisture:      `Batching quantities adjusted for CA moisture ${coarse_aggregate_moisture}% (absorption ${coarse_aggregate_absorption}%) and FA moisture ${fine_aggregate_moisture}% (absorption ${fine_aggregate_absorption}%).`,
  };

  // ─── QA notes ────────────────────────────────────────────────
  const qaNotes = [
    `Expected 28-day compressive strength: ~${strengthMPa} MPa ± 4 MPa (design target mean: ${mixDesign.target_mean_strength} MPa).`,
    `Unit weight of fresh concrete: ~${mixDesign.unit_weight} kg/m³.`,
    `Verify sieve analysis of both aggregates falls within limits before batching.`,
    wcRatioLimit && wcRatio === wcRatioLimit
      ? `w/c ratio was governed by durability (${exposure_class}), not strength. Actual strength will exceed ${strengthMPa} MPa.`
      : null,
  ].filter(Boolean).join(' ');

  const fieldTips = buildFieldTips(input, mixDesign);

  const warnings = buildWarnings(input, mixDesign, exposureLimits);

  return { mixDesign, compliance, justification, qaNotes, fieldTips, warnings };
};

// ─── Helpers ─────────────────────────────────────────────────────

const buildAdmixtureOutput = (admixtures = [], cementContent) => {
  const result = {};
  if (admixtures.includes('superplasticizer'))
    result.superplasticizer = parseFloat((cementContent * 0.015).toFixed(1));  // 1.5% by cement mass
  if (admixtures.includes('plasticizer'))
    result.plasticizer = parseFloat((cementContent * 0.008).toFixed(1));
  if (admixtures.includes('retarder'))
    result.retarder = parseFloat((cementContent * 0.003).toFixed(1));
  if (admixtures.includes('accelerator'))
    result.accelerator = parseFloat((cementContent * 0.020).toFixed(1));
  if (admixtures.includes('air_entraining'))
    result.air_entraining = parseFloat((cementContent * 0.0005).toFixed(2));
  return result;
};

const buildComplianceChecks = ({
  exposure_class, code_standard, wcRatio, wcRatioLimit, wcRatioStrength,
  cementContent, slump, airContentPct, air_entrained, strengthMPa, exposureLimits,
}) => {
  const checks = [];

  if (exposureLimits) {
    checks.push({
      rule: `minimum_cement_${exposure_class}`,
      description: `Minimum cement content for exposure class ${exposure_class}`,
      status: cementContent >= exposureLimits.min_cement ? 'PASS' : 'FAIL',
      required: exposureLimits.min_cement,
      actual: cementContent,
      unit: 'kg/m³',
      reference: `${code_standard} exposure class ${exposure_class}`,
    });

    if (wcRatioLimit) {
      checks.push({
        rule: `max_wc_ratio_${exposure_class}`,
        description: `Maximum w/c ratio for exposure class ${exposure_class}`,
        status: wcRatio <= wcRatioLimit ? 'PASS' : 'FAIL',
        limit: wcRatioLimit,
        actual: wcRatio,
        reference: `${code_standard} exposure class ${exposure_class}`,
      });
    }

    if (exposureLimits.min_strength) {
      checks.push({
        rule: `minimum_strength_${exposure_class}`,
        description: `Minimum characteristic strength for exposure class ${exposure_class}`,
        status: strengthMPa >= exposureLimits.min_strength ? 'PASS' : 'FAIL',
        required: exposureLimits.min_strength,
        actual: strengthMPa,
        unit: 'MPa',
        reference: `${code_standard} Table — minimum strength class`,
      });
    }
  }

  checks.push({
    rule: 'slump_range',
    description: 'Slump within acceptable range',
    status: slump >= 25 && slump <= 200 ? 'PASS' : 'FAIL',
    min: 25,
    max: 200,
    actual: slump,
    unit: 'mm',
  });

  if (air_entrained) {
    checks.push({
      rule: 'air_content_check',
      description: 'Air content in recommended range for durability',
      status: airContentPct >= 2 && airContentPct <= 8 ? 'PASS' : 'WARNING',
      actual: airContentPct,
      unit: '%',
    });
  }

  return {
    code: code_standard,
    overall: checks.every((c) => c.status === 'PASS') ? 'PASS' : 'FAIL',
    checks,
  };
};

const buildFieldTips = (input, mixDesign) => {
  const tips = [];
  const { coarse_aggregate_moisture, fine_aggregate_moisture } = input.materials;

  tips.push(`Batch adjustment: Water added to mixer = ${mixDesign.batching.water_to_add} kg/m³ (after accounting for aggregate free moisture).`);
  tips.push(`If aggregate moisture changes, recalculate: water_added = ${mixDesign.water} - (CA_dry × (CA_moisture% - CA_absorption%)/100) - (FA_dry × (FA_moisture% - FA_absorption%)/100).`);
  tips.push(`Moist-cure for minimum 7 days to achieve design strength. Use wet burlap or curing compound immediately after finishing.`);

  if (input.workability.placement_method === 'pump') {
    tips.push(`Pump-placed mix: verify slump at pump outlet (not just at truck). Pump pressure may change effective workability.`);
  }

  if ((input.materials.admixtures || []).includes('superplasticizer')) {
    tips.push(`Add superplasticizer after initial water addition. Do not exceed manufacturer recommended dosage.`);
  }

  if (input.project_context.exposure_class.startsWith('XF') || input.project_context.exposure_class === 'SEVERE') {
    tips.push(`Freeze-thaw exposure: use air-entrained concrete and ensure placement at temperature > 5°C. Protect from freezing for first 7 days.`);
  }

  return tips;
};

const buildWarnings = (input, mixDesign, exposureLimits) => {
  const warnings = [];
  const { admixtures = [], air_entrained } = input.materials;
  const expClass = input.project_context.exposure_class.toUpperCase();

  if ((expClass.startsWith('XF') || expClass === 'SEVERE') && !air_entrained) {
    warnings.push('Freeze-thaw exposure typically requires air entrainment. Consider enabling air entrainment.');
  }

  if (expClass.startsWith('XS') && !admixtures.includes('superplasticizer')) {
    warnings.push('Marine/chloride exposure: consider using a superplasticizer to reduce w/c ratio further without sacrificing workability.');
  }

  if (mixDesign.batching.water_to_add < 0) {
    warnings.push('Aggregate free moisture exceeds design water requirement. Mix may be too wet; check aggregate moisture measurements.');
  }

  return warnings;
};

/**
 * Pre-validate mix design inputs for conflicts before full calculation.
 * Returns { valid, conflicts, warnings }
 */
const validateMixDesignInputs = (input) => {
  const conflicts = [];
  const warnings = [];

  const {
    project_context: { exposure_class, code_standard },
    strength_requirements: { target_strength },
    materials: { air_entrained = false, admixtures = [] },
  } = input;

  const strengthMPa = parseStrength(target_strength);
  const exposureLimits = EN_EXPOSURE_LIMITS[exposure_class?.toUpperCase()];

  if (!strengthMPa) {
    conflicts.push({ field: 'strength_requirements.target_strength', message: `Cannot parse strength: "${target_strength}". Use format like "C35", "35 MPa", or "35".` });
  }

  if (exposureLimits && strengthMPa) {
    if (strengthMPa < exposureLimits.min_strength) {
      conflicts.push({
        field: 'strength_requirements.target_strength',
        message: `Exposure class ${exposure_class} requires minimum C${exposureLimits.min_strength} strength. Your target C${strengthMPa} is below this. Recommend increasing to at least C${exposureLimits.min_strength}.`,
      });
    }
  }

  const expUpper = exposure_class?.toUpperCase();
  if ((expUpper?.startsWith('XF') || expUpper === 'SEVERE') && !air_entrained) {
    warnings.push(`Freeze-thaw exposure class ${exposure_class} typically requires air entrainment. You have not selected it.`);
  }

  if ((expUpper?.startsWith('XS') || expUpper?.startsWith('XD')) && !admixtures.includes('superplasticizer')) {
    warnings.push(`Chloride/marine exposure class ${exposure_class}: using a superplasticizer is strongly recommended to reduce w/c ratio.`);
  }

  return { valid: conflicts.length === 0, conflicts, warnings };
};

module.exports = { calculateMixDesign, validateMixDesignInputs };
