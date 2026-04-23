/**
 * Code standards reference data for concrete mix design.
 * Based on ACI 211.1, EN 206, TS 500, and BS 8500.
 *
 * ACI 211 tables are sourced from the lecture PDF provided:
 *   - Table 14.5: Slump ranges
 *   - Table 14.6: Mixing water (non-air-entrained)
 *   - Table 14.7: Mixing water (air-entrained)
 *   - Table 14.8: w/c ratio vs. compressive strength
 *   - Table 14.9: Max w/c for severe exposure
 *   - Table 14.10: Volume of coarse aggregate per unit volume
 */

// ─── Standards list ──────────────────────────────────────────────

const STANDARDS = [
  { id: 'ACI_211', name: 'ACI 211.1', region: 'USA', active: true },
  { id: 'BS_8500', name: 'BS 8500', region: 'UK', active: true },
  { id: 'EN_206',  name: 'Eurocode EN 206', region: 'EU', active: true },
  { id: 'TS_500',  name: 'TS 500', region: 'Turkey', active: true },
];

// ─── Exposure classes ────────────────────────────────────────────

const EXPOSURE_CLASSES = {
  ACI_211: [
    { code: 'MILD',     name: 'Mild',     description: 'Concrete not exposed to freezing, thawing or sulfates' },
    { code: 'MODERATE', name: 'Moderate', description: 'Moderate sulfate exposure or mild freeze-thaw with air entrainment' },
    { code: 'SEVERE',   name: 'Severe',   description: 'Severe freeze-thaw, deicers, seawater, or sulfate exposure' },
  ],
  EN_206: [
    { code: 'X0',  name: 'No risk',             description: 'No risk of corrosion or attack' },
    { code: 'XC1', name: 'Dry/Perm wet',         description: 'Concrete inside buildings with low air humidity' },
    { code: 'XC2', name: 'Wet, rarely dry',      description: 'Long-term water contact, many foundations' },
    { code: 'XC3', name: 'Moderate humidity',    description: 'Concrete inside buildings with moderate humidity, external concrete sheltered from rain' },
    { code: 'XC4', name: 'Cyclic wet/dry',       description: 'Concrete surfaces subject to water contact, not in XC2' },
    { code: 'XD1', name: 'Moderate humidity (Cl)', description: 'Concrete surfaces exposed to airborne chlorides' },
    { code: 'XD2', name: 'Wet/rarely dry (Cl)',  description: 'Swimming pools, exposure to industrial chloride waters' },
    { code: 'XD3', name: 'Cyclic wet/dry (Cl)',  description: 'Parts of bridges, pavements, parking slabs' },
    { code: 'XS1', name: 'Airborne salt',        description: 'Structures near/on coast' },
    { code: 'XS2', name: 'Permanently submerged', description: 'Parts of marine structures' },
    { code: 'XS3', name: 'Tidal/splash zone',    description: 'Parts of marine structures in tidal, splash and spray zones' },
    { code: 'XF1', name: 'Moderate saturation (no deicers)', description: 'Vertical concrete surfaces exposed to rain and freezing' },
    { code: 'XF2', name: 'Moderate saturation + deicers',    description: 'Vertical concrete surfaces of road structures exposed to freezing and airborne deicers' },
    { code: 'XF3', name: 'High saturation (no deicers)',     description: 'Horizontal concrete surfaces exposed to rain and freezing' },
    { code: 'XF4', name: 'High saturation + deicers',        description: 'Road and bridge decks exposed to deicers, splash zone of marine structures in freezing conditions' },
    { code: 'XA1', name: 'Slightly aggressive chemical',     description: 'Natural soils and ground water of slightly aggressive chemical environment' },
    { code: 'XA2', name: 'Moderately aggressive chemical',   description: 'Natural soils and ground water of moderately aggressive chemical environment' },
    { code: 'XA3', name: 'Highly aggressive chemical',       description: 'Natural soils and ground water of highly aggressive chemical environment' },
  ],
  TS_500: [
    { code: 'XC1', name: 'Dry or permanently wet',    description: 'Interior elements not exposed to moisture' },
    { code: 'XC2', name: 'Wet, rarely dry',           description: 'Foundations, buried elements' },
    { code: 'XC3', name: 'Moderate humidity',         description: 'Sheltered external elements, interior with moderate humidity' },
    { code: 'XC4', name: 'Cyclic wet/dry',            description: 'External elements exposed to precipitation' },
    { code: 'XD1', name: 'Moderate humidity (chloride)', description: 'Road structures, parking' },
    { code: 'XS1', name: 'Airborne salt from sea',    description: 'Structures near coast' },
    { code: 'XS3', name: 'Tidal, splash and spray',   description: 'Marine structures' },
    { code: 'XF1', name: 'Moderate saturation (no deicers)', description: 'Vertical surfaces exposed to rain & freezing' },
    { code: 'XF2', name: 'Moderate saturation + deicers',    description: 'Vertical road surfaces with deicers' },
    { code: 'XF3', name: 'High saturation (no deicers)',     description: 'Horizontal surfaces exposed to rain & freezing' },
    { code: 'XF4', name: 'High saturation + deicers',        description: 'Road decks with deicers, marine splash zone' },
  ],
  BS_8500: [
    { code: 'AC-1', name: 'Aggressive chemical class 1', description: 'Lowest aggressive chemical class' },
    { code: 'AC-2', name: 'Aggressive chemical class 2', description: 'Moderate aggressive chemical class' },
    { code: 'AC-3', name: 'Aggressive chemical class 3', description: 'High aggressive chemical class' },
    { code: 'AC-4', name: 'Aggressive chemical class 4', description: 'Very high aggressive chemical class' },
    { code: 'AC-5', name: 'Aggressive chemical class 5', description: 'Extreme aggressive chemical class' },
  ],
};

// ─── ACI 211 Water content table (Table 14.6 non-air-entrained) ─

// Key: slump range, Value: water content by max aggregate size (kg/m³)
// Aggregate sizes: 9.5, 12.5, 19, 25, 37.5, 50, 75 mm
const ACI_WATER_NON_AIR = {
  '25-50':   { 9.5: 207, 12.5: 199, 19: 190, 25: 179, 37.5: 166, 50: 154, 75: 130 },
  '75-100':  { 9.5: 228, 12.5: 216, 19: 205, 25: 193, 37.5: 181, 50: 169, 75: 145 },
  '150-175': { 9.5: 243, 12.5: 228, 19: 216, 25: 202, 37.5: 190, 50: 178, 75: 160 },
  AIR_PCT:   { 9.5: 3.0, 12.5: 2.5, 19: 2.0, 25: 1.5, 37.5: 1.0, 50: 0.5, 75: 0.3 },
};

// Table 14.7 air-entrained
const ACI_WATER_AIR = {
  '25-50':   { 9.5: 181, 12.5: 175, 19: 168, 25: 160, 37.5: 150, 50: 142, 75: 122 },
  '75-100':  { 9.5: 202, 12.5: 193, 19: 184, 25: 175, 37.5: 165, 50: 157, 75: 133 },
  '150-175': { 9.5: 216, 12.5: 205, 19: 197, 25: 184, 37.5: 174, 50: 166, 75: 154 },
  // Recommended total air content (%)
  MILD_AIR:     { 9.5: 4.5, 12.5: 4.0, 19: 3.5, 25: 3.0, 37.5: 2.5, 50: 2.0, 75: 1.5 },
  MODERATE_AIR: { 9.5: 6.0, 12.5: 5.5, 19: 5.0, 25: 4.5, 37.5: 4.5, 50: 4.0, 75: 3.5 },
  SEVERE_AIR:   { 9.5: 7.5, 12.5: 7.0, 19: 6.0, 25: 6.0, 37.5: 5.5, 50: 5.0, 75: 4.5 },
};

// Table 14.8 — w/c ratio vs. 28-day compressive strength
const ACI_WC_RATIO = {
  // strength (MPa): { non_air, air }
  40: { non_air: 0.42, air: null },
  35: { non_air: 0.47, air: 0.39 },
  30: { non_air: 0.54, air: 0.45 },
  25: { non_air: 0.61, air: 0.52 },
  20: { non_air: 0.69, air: 0.60 },
  15: { non_air: 0.79, air: 0.70 },
};

// Table 14.9 — max w/c for severe exposure
const ACI_SEVERE_WC = {
  thin_sections_and_low_cover: { wet_freeze_thaw: 0.45, seawater_sulfate: 0.40 },
  all_other:                   { wet_freeze_thaw: 0.50, seawater_sulfate: 0.45 },
};

// Table 14.10 — volume of coarse aggregate per unit volume of concrete
// Key: max agg size (mm), Value: object by fineness modulus of FA
const ACI_CA_VOLUME = {
  9.5:  { 2.40: 0.50, 2.60: 0.48, 2.80: 0.46, 3.00: 0.44 },
  12.5: { 2.40: 0.59, 2.60: 0.57, 2.80: 0.55, 3.00: 0.53 },
  19.0: { 2.40: 0.66, 2.60: 0.64, 2.80: 0.62, 3.00: 0.60 },
  25.0: { 2.40: 0.71, 2.60: 0.69, 2.80: 0.67, 3.00: 0.65 },
  37.5: { 2.40: 0.75, 2.60: 0.73, 2.80: 0.71, 3.00: 0.69 },
  50.0: { 2.40: 0.78, 2.60: 0.76, 2.80: 0.74, 3.00: 0.72 },
  75.0: { 2.40: 0.82, 2.60: 0.80, 2.80: 0.78, 3.00: 0.76 },
};

// ─── EN 206 / TS 500 limits ──────────────────────────────────────

// Minimum requirements per exposure class (EN 206 / TS 500 aligned)
// { max_wc, min_cement (kg/m³), min_strength_class }
const EN_EXPOSURE_LIMITS = {
  X0:  { max_wc: 0.75, min_cement: 200, min_strength: 12 },
  XC1: { max_wc: 0.65, min_cement: 260, min_strength: 20 },
  XC2: { max_wc: 0.60, min_cement: 280, min_strength: 25 },
  XC3: { max_wc: 0.55, min_cement: 300, min_strength: 30 },
  XC4: { max_wc: 0.50, min_cement: 320, min_strength: 35 },
  XD1: { max_wc: 0.55, min_cement: 300, min_strength: 30 },
  XD2: { max_wc: 0.50, min_cement: 320, min_strength: 35 },
  XD3: { max_wc: 0.45, min_cement: 340, min_strength: 40 },
  XS1: { max_wc: 0.50, min_cement: 320, min_strength: 35 },
  XS2: { max_wc: 0.45, min_cement: 340, min_strength: 40 },
  XS3: { max_wc: 0.45, min_cement: 360, min_strength: 40 },
  XF1: { max_wc: 0.55, min_cement: 300, min_strength: 30 },
  XF2: { max_wc: 0.55, min_cement: 300, min_strength: 30 },
  XF3: { max_wc: 0.50, min_cement: 320, min_strength: 35 },
  XF4: { max_wc: 0.45, min_cement: 340, min_strength: 40 },
  XA1: { max_wc: 0.55, min_cement: 300, min_strength: 30 },
  XA2: { max_wc: 0.50, min_cement: 320, min_strength: 35 },
  XA3: { max_wc: 0.45, min_cement: 360, min_strength: 40 },
  // ACI exposure classes
  MILD:     { max_wc: 0.70, min_cement: 250, min_strength: 20 },
  MODERATE: { max_wc: 0.55, min_cement: 300, min_strength: 30 },
  SEVERE:   { max_wc: 0.45, min_cement: 330, min_strength: 35 },
};

// ─── Strength class parser ───────────────────────────────────────

/**
 * Parse a strength string like "C35", "35 MPa", or "35" into an integer MPa value.
 */
const parseStrength = (str) => {
  const num = parseInt(String(str).replace(/[^0-9]/g, ''), 10);
  return isNaN(num) ? null : num;
};

/**
 * Interpolate w/c ratio for a given strength (MPa) from ACI table.
 * Uses linear interpolation between tabulated values.
 */
const interpolateWC = (strengthMPa, airEntrained = false) => {
  const key = airEntrained ? 'air' : 'non_air';
  const entries = Object.entries(ACI_WC_RATIO)
    .map(([k, v]) => ({ s: parseInt(k), wc: v[key] }))
    .filter((e) => e.wc !== null)
    .sort((a, b) => a.s - b.s);

  // Exact match
  const exact = entries.find((e) => e.s === strengthMPa);
  if (exact) return exact.wc;

  // Clamp
  if (strengthMPa <= entries[0].s) return entries[0].wc;
  if (strengthMPa >= entries[entries.length - 1].s) return entries[entries.length - 1].wc;

  // Interpolate
  for (let i = 0; i < entries.length - 1; i++) {
    if (strengthMPa > entries[i].s && strengthMPa < entries[i + 1].s) {
      const t = (strengthMPa - entries[i].s) / (entries[i + 1].s - entries[i].s);
      return +(entries[i].wc + t * (entries[i + 1].wc - entries[i].wc)).toFixed(3);
    }
  }
  return null;
};

/**
 * Determine slump range bucket from slump value (mm).
 */
const slumpBucket = (slump) => {
  if (slump <= 50) return '25-50';
  if (slump <= 100) return '75-100';
  return '150-175';
};

/**
 * Round to nearest available aggregate size key.
 */
const nearestAggSize = (size) => {
  const keys = [9.5, 12.5, 19, 25, 37.5, 50, 75];
  return keys.reduce((a, b) => (Math.abs(b - size) < Math.abs(a - size) ? b : a));
};

/**
 * Round to nearest available fineness modulus key.
 */
const nearestFM = (fm) => {
  const keys = [2.40, 2.60, 2.80, 3.00];
  return keys.reduce((a, b) => (Math.abs(b - fm) < Math.abs(a - fm) ? b : a));
};

module.exports = {
  STANDARDS,
  EXPOSURE_CLASSES,
  ACI_WATER_NON_AIR,
  ACI_WATER_AIR,
  ACI_WC_RATIO,
  ACI_SEVERE_WC,
  ACI_CA_VOLUME,
  EN_EXPOSURE_LIMITS,
  parseStrength,
  interpolateWC,
  slumpBucket,
  nearestAggSize,
  nearestFM,
};
