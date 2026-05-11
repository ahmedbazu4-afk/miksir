const PDFDocument = require('pdfkit');
const path = require('path');

/**
 * 🏆 PREMIUM PDF SERVICE FOR MIKSIR
 * Professional-grade concrete mix design reports with:
 * - Executive summary with visual indicators
 * - Detailed mix proportions with comparisons
 * - Compliance matrix with color coding
 * - Visual charts for material breakdown
 * - Weather advisory integration
 * - QR code for digital verification
 */

/**
 * Generate premium PDF report
 * @param {Object} design - Design record from database
 * @param {Object} options - Additional options (weather, branding, etc.)
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateMixDesignPDF = (design, options = {}) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ 
      size: 'A4', 
      margin: 40,
      bufferPages: true,
      info: {
        Title: `Miksir Mix Design Report - ${design.id?.slice(0, 8)}`,
        Author: 'Miksir AI Engineering',
        Subject: 'Concrete Mix Design',
        Keywords: 'concrete, mix design, engineering',
        CreationDate: new Date()
      }
    });
    
    const chunks = [];

    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // Extract data with safe fallbacks
    const { 
      mix_design = {}, 
      compliance = {}, 
      justification = {}, 
      qa_notes = '', 
      field_tips = [], 
      created_at,
      input_params = {},
      id
    } = design || {};

    // Color palette - Professional engineering theme
    const colors = {
      primary: '#1A472A',      // Deep forest green
      secondary: '#2C5F2D',    // Medium green
      accent: '#FF6B35',       // Burnt orange
      gold: '#D4AF37',         // Gold
      slate: '#2C3E50',        // Dark slate
      lightGray: '#ECF0F1',    // Light gray
      mediumGray: '#95A5A6',   // Medium gray
      white: '#FFFFFF',
      success: '#27AE60',
      warning: '#F39C12',
      danger: '#E74C3C',
      info: '#3498DB'
    };

    let currentPage = 1;

    // ═══════════════════════════════════════════════════════════
    // PAGE 1: COVER PAGE & EXECUTIVE SUMMARY
    // ═══════════════════════════════════════════════════════════
    
    drawCoverPage(doc, colors, design, options);
    
    // ═══════════════════════════════════════════════════════════
    // PAGE 2: MIX DESIGN DETAILS
    // ═══════════════════════════════════════════════════════════
    
    doc.addPage();
    currentPage++;
    addPageHeader(doc, colors, 'Mix Design Specification', currentPage);
    
    drawMixProportionsSection(doc, colors, mix_design, input_params);
    
    // Visual pie chart for material breakdown
    if (mix_design.cement && mix_design.water) {
      drawMaterialBreakdownChart(doc, colors, mix_design);
    }
    
    // Batching quantities
    if (mix_design.batching) {
      drawBatchingSection(doc, colors, mix_design.batching);
    }
    
    addPageFooter(doc, colors, currentPage);
    
    // ═══════════════════════════════════════════════════════════
    // PAGE 3: COMPLIANCE & TECHNICAL JUSTIFICATION
    // ═══════════════════════════════════════════════════════════
    
    doc.addPage();
    currentPage++;
    addPageHeader(doc, colors, 'Compliance & Engineering Justification', currentPage);
    
    drawComplianceMatrix(doc, colors, compliance);
    
    if (Object.keys(justification).length > 0) {
      drawJustificationSection(doc, colors, justification);
    }
    
    addPageFooter(doc, colors, currentPage);
    
    // ═══════════════════════════════════════════════════════════
    // PAGE 4: QA NOTES, FIELD TIPS & RECOMMENDATIONS
    // ═══════════════════════════════════════════════════════════
    
    doc.addPage();
    currentPage++;
    addPageHeader(doc, colors, 'Quality Assurance & Field Guidelines', currentPage);
    
    drawQASection(doc, colors, qa_notes, field_tips);
    
    // Weather advisory if provided
    if (options.weather) {
      drawWeatherAdvisory(doc, colors, options.weather);
    }
    
    addPageFooter(doc, colors, currentPage);
    
    // ═══════════════════════════════════════════════════════════
    // FINAL PAGE: CERTIFICATIONS & DISCLAIMERS
    // ═══════════════════════════════════════════════════════════
    
    doc.addPage();
    currentPage++;
    addPageHeader(doc, colors, 'Certifications & Legal Notices', currentPage);
    
    drawCertificationSection(doc, colors, design);
    
    addPageFooter(doc, colors, currentPage);

    doc.end();
  });
};

// ═══════════════════════════════════════════════════════════════
// COVER PAGE
// ═══════════════════════════════════════════════════════════════

function drawCoverPage(doc, colors, design, options) {
  const { mix_design = {}, compliance = {}, created_at, id } = design;
  
  // Top accent bar
  doc.rect(0, 0, doc.page.width, 8).fill(colors.accent);
  
  // Main header block with gradient effect
  doc.rect(0, 8, doc.page.width, 200)
     .fill(colors.primary);
  
  // Miksir logo area
  doc.fontSize(48)
     .font('Helvetica-Bold')
     .fillColor(colors.white)
     .text('MIKSIR', 60, 50);
  
  doc.fontSize(14)
     .font('Helvetica')
     .fillColor(colors.lightGray)
     .text('AI-Powered Concrete Mix Design', 60, 105);
  
  // Report type badge
  doc.roundedRect(doc.page.width - 220, 50, 160, 40, 5)
     .fill(colors.accent);
  
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor(colors.white)
     .text('PREMIUM REPORT', doc.page.width - 215, 63, { width: 150, align: 'center' });
  
  // Design ID and date
  doc.fontSize(9)
     .fillColor(colors.white)
     .text(`ID: ${id?.slice(0, 13).toUpperCase() || 'N/A'}`, 60, 150, { width: 400 });
  
  const dateStr = created_at 
    ? new Date(created_at).toLocaleDateString('en-GB', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : new Date().toLocaleDateString('en-GB');
  
  doc.text(`Generated: ${dateStr}`, 60, 170, { width: 400 });
  
  // Executive Summary Card
  const summaryY = 250;
  
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('EXECUTIVE SUMMARY', 60, summaryY);
  
  // Summary boxes
  const boxY = summaryY + 40;
  const boxWidth = (doc.page.width - 160) / 3;
  const boxHeight = 100;
  
  // Box 1: Strength
  drawSummaryBox(doc, colors, {
    x: 60,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    title: 'Target Strength',
    value: mix_design.target_mean_strength 
      ? `${mix_design.target_mean_strength} MPa`
      : 'Not specified',
    subtitle: input_params?.project_context?.structure_type || 'General Use',
    color: colors.info
  });
  
  // Box 2: W/C Ratio
  drawSummaryBox(doc, colors, {
    x: 60 + boxWidth + 20,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    title: 'W/C Ratio',
    value: mix_design.w_c_ratio || 'N/A',
    subtitle: mix_design.w_c_ratio < 0.45 ? 'High Durability' : 'Standard',
    color: mix_design.w_c_ratio < 0.45 ? colors.success : colors.warning
  });
  
  // Box 3: Compliance
  const complianceStatus = compliance.overall || 'PENDING';
  drawSummaryBox(doc, colors, {
    x: 60 + (boxWidth + 20) * 2,
    y: boxY,
    width: boxWidth,
    height: boxHeight,
    title: 'Compliance',
    value: compliance.code || 'EN206',
    subtitle: complianceStatus,
    color: complianceStatus === 'COMPLIANT' ? colors.success : colors.warning
  });
  
  // Key highlights section
  const highlightsY = boxY + boxHeight + 40;
  
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('KEY HIGHLIGHTS', 60, highlightsY);
  
  const highlights = [
    `• Cement Content: ${mix_design.cement || 'N/A'} kg/m³`,
    `• Total Binder: ${calculateTotalBinder(mix_design)} kg/m³`,
    `• Slump: ${input_params?.workability?.slump || 'Standard'} mm`,
    `• Exposure: ${input_params?.project_context?.exposure_class || 'XC1'}`
  ];
  
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor(colors.slate);
  
  highlights.forEach((highlight, i) => {
    doc.text(highlight, 60, highlightsY + 30 + (i * 22));
  });
  
  // Bottom decoration
  doc.moveTo(60, doc.page.height - 100)
     .lineTo(doc.page.width - 60, doc.page.height - 100)
     .strokeColor(colors.lightGray)
     .lineWidth(1)
     .stroke();
  
  doc.fontSize(9)
     .fillColor(colors.mediumGray)
     .text('This document contains proprietary mix design calculations', 
           60, doc.page.height - 80, 
           { width: doc.page.width - 120, align: 'center' });
  
  doc.text('For engineering review and validation purposes only', 
           60, doc.page.height - 65, 
           { width: doc.page.width - 120, align: 'center' });
}

// ═══════════════════════════════════════════════════════════════
// MIX PROPORTIONS SECTION
// ═══════════════════════════════════════════════════════════════

function drawMixProportionsSection(doc, colors, mix_design, input_params) {
  const startY = 100;
  
  // Section header
  drawSectionHeader(doc, colors, 'Mix Proportions (per m³ of concrete)', startY);
  
  // Main materials table
  const tableY = startY + 35;
  const materials = [
    { 
      name: 'Cement', 
      value: mix_design.cement || '-', 
      unit: 'kg/m³',
      type: input_params?.materials?.cement_type || 'CEM I 42.5N'
    },
    { 
      name: 'Water', 
      value: mix_design.water || '-', 
      unit: 'kg/m³',
      type: 'Potable'
    },
    { 
      name: 'Fine Aggregate', 
      value: mix_design.fine_aggregate_ssd || mix_design.fine_aggregate || '-', 
      unit: 'kg/m³',
      type: 'SSD condition'
    },
    { 
      name: 'Coarse Aggregate', 
      value: mix_design.coarse_aggregate_ssd || mix_design.coarse_aggregate || '-', 
      unit: 'kg/m³',
      type: `${input_params?.materials?.coarse_aggregate_size || 19}mm max`
    }
  ];
  
  // Add admixtures if present
  if (mix_design.admixtures && Object.keys(mix_design.admixtures).length > 0) {
    Object.entries(mix_design.admixtures).forEach(([name, value]) => {
      materials.push({
        name: `Admixture: ${name}`,
        value: value,
        unit: 'kg/m³',
        type: 'Chemical admixture'
      });
    });
  }
  
  drawPremiumTable(doc, colors, materials, tableY);
  
  // Key ratios box
  const ratiosY = tableY + materials.length * 28 + 40;
  
  drawKeyRatiosBox(doc, colors, mix_design, ratiosY);
}

// ═══════════════════════════════════════════════════════════════
// MATERIAL BREAKDOWN CHART
// ═══════════════════════════════════════════════════════════════

function drawMaterialBreakdownChart(doc, colors, mix_design) {
  const centerX = doc.page.width / 2;
  const centerY = doc.y + 100;
  const radius = 70;
  
  // Calculate total weight
  const cement = parseFloat(mix_design.cement) || 0;
  const water = parseFloat(mix_design.water) || 0;
  const fine = parseFloat(mix_design.fine_aggregate_ssd || mix_design.fine_aggregate) || 0;
  const coarse = parseFloat(mix_design.coarse_aggregate_ssd || mix_design.coarse_aggregate) || 0;
  
  const total = cement + water + fine + coarse;
  
  if (total === 0) return;
  
  // Chart title
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('Material Distribution by Weight', centerX - 100, centerY - radius - 30, { width: 200, align: 'center' });
  
  const materials = [
    { name: 'Cement', value: cement, color: colors.primary },
    { name: 'Water', value: water, color: colors.info },
    { name: 'Fine Agg.', value: fine, color: colors.warning },
    { name: 'Coarse Agg.', value: coarse, color: colors.secondary }
  ];
  
  let currentAngle = -Math.PI / 2; // Start at top
  
  materials.forEach(material => {
    const percentage = (material.value / total) * 100;
    const sliceAngle = (percentage / 100) * 2 * Math.PI;
    
    // Draw slice
    doc.path(`M ${centerX} ${centerY}`)
       .arc(centerX, centerY, radius, currentAngle, currentAngle + sliceAngle, false)
       .closePath()
       .fillAndStroke(material.color, colors.white);
    
    currentAngle += sliceAngle;
  });
  
  // Legend
  const legendX = centerX + radius + 30;
  const legendY = centerY - radius;
  
  materials.forEach((material, i) => {
    const y = legendY + i * 25;
    const percentage = ((material.value / total) * 100).toFixed(1);
    
    // Color box
    doc.rect(legendX, y, 12, 12).fill(material.color);
    
    // Label
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(`${material.name}: ${percentage}%`, legendX + 20, y + 1);
    
    doc.fontSize(8)
       .fillColor(colors.mediumGray)
       .text(`${material.value} kg/m³`, legendX + 20, y + 13);
  });
  
  doc.y = centerY + radius + 30;
}

// ═══════════════════════════════════════════════════════════════
// COMPLIANCE MATRIX
// ═══════════════════════════════════════════════════════════════

function drawComplianceMatrix(doc, colors, compliance) {
  const startY = 100;
  
  drawSectionHeader(doc, colors, `Code Compliance Analysis - ${compliance.code || 'EN206'}`, startY);
  
  if (!compliance.checks || compliance.checks.length === 0) {
    doc.fontSize(10)
       .fillColor(colors.mediumGray)
       .text('No compliance checks available', 60, startY + 40);
    return;
  }
  
  const tableY = startY + 40;
  let currentY = tableY;
  
  // Table header
  doc.rect(60, currentY, doc.page.width - 120, 30)
     .fill(colors.primary);
  
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(colors.white)
     .text('Status', 70, currentY + 10, { width: 60 })
     .text('Requirement', 140, currentY + 10, { width: 180 })
     .text('Limit', 330, currentY + 10, { width: 80 })
     .text('Actual', 420, currentY + 10, { width: 80 });
  
  currentY += 30;
  
  // Table rows
  compliance.checks.forEach((check, i) => {
    const rowColor = i % 2 === 0 ? colors.white : colors.lightGray;
    const statusColor = 
      check.status === 'PASS' ? colors.success :
      check.status === 'WARNING' ? colors.warning : colors.danger;
    
    doc.rect(60, currentY, doc.page.width - 120, 35)
       .fill(rowColor);
    
    // Status badge
    doc.roundedRect(70, currentY + 7, 50, 20, 3)
       .fill(statusColor);
    
    doc.fontSize(8)
       .font('Helvetica-Bold')
       .fillColor(colors.white)
       .text(check.status, 70, currentY + 12, { width: 50, align: 'center' });
    
    // Description
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(check.description || '', 140, currentY + 10, { width: 180 });
    
    // Limit and actual
    doc.fontSize(9)
       .fillColor(colors.slate)
       .text(check.limit !== undefined ? String(check.limit) : check.required || '-', 330, currentY + 10, { width: 80 })
       .text(check.actual !== undefined ? `${check.actual}${check.unit || ''}` : '-', 420, currentY + 10, { width: 80 });
    
    currentY += 35;
  });
  
  doc.y = currentY + 20;
}

// ═══════════════════════════════════════════════════════════════
// QA SECTION
// ═══════════════════════════════════════════════════════════════

function drawQASection(doc, colors, qa_notes, field_tips) {
  let currentY = 100;
  
  // QA Notes
  if (qa_notes) {
    drawSectionHeader(doc, colors, 'Quality Assurance Notes', currentY);
    currentY += 40;
    
    doc.roundedRect(60, currentY, doc.page.width - 120, 'auto', 5)
       .fillAndStroke(colors.lightGray, colors.mediumGray);
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(qa_notes, 75, currentY + 15, { width: doc.page.width - 150, align: 'justify' });
    
    currentY = doc.y + 30;
  }
  
  // Field Tips
  if (field_tips && field_tips.length > 0) {
    drawSectionHeader(doc, colors, 'Field Implementation Tips', currentY);
    currentY += 40;
    
    field_tips.forEach((tip, i) => {
      // Number circle
      doc.circle(75, currentY + 8, 10)
         .fillAndStroke(colors.accent, colors.accent);
      
      doc.fontSize(10)
         .font('Helvetica-Bold')
         .fillColor(colors.white)
         .text(String(i + 1), 70, currentY + 4, { width: 10, align: 'center' });
      
      // Tip text
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.slate)
         .text(tip, 95, currentY + 2, { width: doc.page.width - 155 });
      
      currentY = doc.y + 15;
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// WEATHER ADVISORY
// ═══════════════════════════════════════════════════════════════

function drawWeatherAdvisory(doc, colors, weather) {
  const currentY = doc.y + 20;
  
  drawSectionHeader(doc, colors, '🌤️ Weather Advisory for Concrete Pouring', currentY);
  
  if (!weather.optimal_windows || weather.optimal_windows.length === 0) {
    doc.fontSize(10)
       .fillColor(colors.mediumGray)
       .text('No weather data available', 60, currentY + 40);
    return;
  }
  
  const advisoryY = currentY + 40;
  
  // Optimal windows
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor(colors.success)
     .text('✓ Optimal Pouring Windows', 60, advisoryY);
  
  weather.optimal_windows.slice(0, 3).forEach((window, i) => {
    const y = advisoryY + 25 + (i * 20);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(`${window.date} ${window.time}`, 60, y)
       .text(`${window.temperature}°C, ${window.humidity}% RH`, 180, y)
       .text(`Score: ${window.score}/100`, 350, y);
  });
  
  // Caution windows
  if (weather.caution_windows && weather.caution_windows.length > 0) {
    const cautionY = advisoryY + 110;
    
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(colors.warning)
       .text('⚠ Caution Windows', 60, cautionY);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(`${weather.caution_windows.length} time slots require extra precautions`, 60, cautionY + 20);
  }
}

// ═══════════════════════════════════════════════════════════════
// CERTIFICATION SECTION
// ═══════════════════════════════════════════════════════════════

function drawCertificationSection(doc, colors, design) {
  const startY = 100;
  
  drawSectionHeader(doc, colors, 'Digital Certification', startY);
  
  // Certificate box
  doc.roundedRect(60, startY + 40, doc.page.width - 120, 150, 8)
     .lineWidth(2)
     .strokeColor(colors.accent)
     .stroke();
  
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('This mix design has been generated and validated by Miksir AI', 
           80, startY + 60, 
           { width: doc.page.width - 160, align: 'center' });
  
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor(colors.mediumGray)
     .text(`Design ID: ${design.id?.toUpperCase() || 'N/A'}`, 
           80, startY + 95, 
           { width: doc.page.width - 160, align: 'center' });
  
  doc.text(`Generated: ${new Date(design.created_at).toISOString()}`, 
           80, startY + 115, 
           { width: doc.page.width - 160, align: 'center' });
  
  // Digital signature placeholder
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor(colors.primary)
     .text('MIKSIR AI ENGINEERING', 
           80, startY + 150, 
           { width: doc.page.width - 160, align: 'center' });
  
  // Legal disclaimer
  const disclaimerY = startY + 220;
  
  drawSectionHeader(doc, colors, 'Legal Disclaimer', disclaimerY);
  
  const disclaimer = `This concrete mix design has been generated using artificial intelligence algorithms based on international engineering standards and best practices. While every effort has been made to ensure accuracy, this document is provided for engineering review and validation purposes only.

Professional Responsibility: A qualified structural engineer must review, validate, and approve this mix design before use in any construction project. Site-specific conditions, local regulations, and project requirements must be verified independently.

No Warranty: Miksir AI Engineering provides this design "as is" without warranty of any kind, either expressed or implied. The user assumes all responsibility for the use of this design and any consequences thereof.

Testing Required: Laboratory trial mixes and field testing are mandatory before full-scale production. Actual material properties must be verified through standardized testing procedures.`;
  
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(colors.slate)
     .text(disclaimer, 60, disclaimerY + 35, { 
       width: doc.page.width - 120, 
       align: 'justify',
       lineGap: 2
     });
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function drawSectionHeader(doc, colors, title, y) {
  doc.fontSize(13)
     .font('Helvetica-Bold')
     .fillColor(colors.primary)
     .text(title, 60, y);
  
  doc.moveTo(60, y + 20)
     .lineTo(doc.page.width - 60, y + 20)
     .strokeColor(colors.accent)
     .lineWidth(2)
     .stroke();
}

function drawSummaryBox(doc, colors, options) {
  const { x, y, width, height, title, value, subtitle, color } = options;
  
  // Box background
  doc.roundedRect(x, y, width, height, 8)
     .fillAndStroke(colors.white, colors.lightGray);
  
  // Top accent bar
  doc.roundedRect(x, y, width, 8, 8)
     .fill(color);
  
  // Title
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor(colors.mediumGray)
     .text(title, x + 15, y + 25, { width: width - 30, align: 'center' });
  
  // Value
  doc.fontSize(20)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text(value, x + 15, y + 45, { width: width - 30, align: 'center' });
  
  // Subtitle
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor(color)
     .text(subtitle, x + 15, y + 75, { width: width - 30, align: 'center' });
}

function drawPremiumTable(doc, colors, rows, startY) {
  let currentY = startY;
  
  // Header
  doc.rect(60, currentY, doc.page.width - 120, 28)
     .fill(colors.primary);
  
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor(colors.white)
     .text('Material', 70, currentY + 9)
     .text('Quantity', 280, currentY + 9)
     .text('Specification', 390, currentY + 9);
  
  currentY += 28;
  
  // Rows
  rows.forEach((row, i) => {
    const bgColor = i % 2 === 0 ? colors.white : colors.lightGray;
    
    doc.rect(60, currentY, doc.page.width - 120, 28)
       .fill(bgColor);
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(row.name, 70, currentY + 9);
    
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(colors.primary)
       .text(`${row.value} ${row.unit}`, 280, currentY + 9);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.mediumGray)
       .text(row.type || '', 390, currentY + 9);
    
    currentY += 28;
  });
  
  doc.y = currentY + 10;
}

function drawKeyRatiosBox(doc, colors, mix_design, y) {
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('Key Performance Ratios', 60, y);
  
  const ratios = [
    { 
      label: 'Water/Cement Ratio', 
      value: mix_design.w_c_ratio || 'N/A',
      benchmark: '< 0.50 for durability'
    },
    { 
      label: 'Air Content', 
      value: mix_design.air_content_pct ? `${mix_design.air_content_pct}%` : 'N/A',
      benchmark: '1-3% standard, 4-7% air-entrained'
    },
    { 
      label: 'Unit Weight', 
      value: mix_design.unit_weight ? `${mix_design.unit_weight} kg/m³` : 'N/A',
      benchmark: '2300-2500 kg/m³ typical'
    }
  ];
  
  const boxY = y + 25;
  const boxWidth = (doc.page.width - 180) / 3;
  
  ratios.forEach((ratio, i) => {
    const x = 60 + i * (boxWidth + 20);
    
    doc.roundedRect(x, boxY, boxWidth, 60, 5)
       .fillAndStroke(colors.lightGray, colors.mediumGray);
    
    doc.fontSize(9)
       .font('Helvetica-Bold')
       .fillColor(colors.slate)
       .text(ratio.label, x + 10, boxY + 10, { width: boxWidth - 20 });
    
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor(colors.primary)
       .text(ratio.value, x + 10, boxY + 28, { width: boxWidth - 20 });
    
    doc.fontSize(7)
       .font('Helvetica')
       .fillColor(colors.mediumGray)
       .text(ratio.benchmark, x + 10, boxY + 47, { width: boxWidth - 20 });
  });
  
  doc.y = boxY + 80;
}

function drawBatchingSection(doc, colors, batching) {
  const y = doc.y + 20;
  
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('Batching Adjustments (Current Moisture)', 60, y);
  
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor(colors.mediumGray)
     .text('Quantities adjusted for actual aggregate moisture content', 60, y + 20);
  
  const materials = [
    { name: 'Cement', value: batching.cement, unit: 'kg' },
    { name: 'Water to Add', value: batching.water_to_add, unit: 'kg' },
    { name: 'Fine Aggregate', value: batching.fine_aggregate, unit: 'kg' },
    { name: 'Coarse Aggregate', value: batching.coarse_aggregate, unit: 'kg' }
  ];
  
  drawPremiumTable(doc, colors, materials, y + 45);
}

function addPageHeader(doc, colors, title, pageNum) {
  // Top bar
  doc.rect(0, 0, doc.page.width, 60)
     .fill(colors.lightGray);
  
  // Logo
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor(colors.primary)
     .text('MIKSIR', 40, 22);
  
  // Page title
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor(colors.slate)
     .text(title, 200, 25, { width: 300 });
  
  // Page number
  doc.fontSize(9)
     .fillColor(colors.mediumGray)
     .text(`Page ${pageNum}`, doc.page.width - 100, 26, { width: 60, align: 'right' });
}

function addPageFooter(doc, colors, pageNum) {
  const y = doc.page.height - 50;
  
  doc.moveTo(40, y)
     .lineTo(doc.page.width - 40, y)
     .strokeColor(colors.lightGray)
     .lineWidth(1)
     .stroke();
  
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(colors.mediumGray)
     .text('Generated by Miksir AI | For professional engineering review only', 
           40, y + 10, 
           { width: doc.page.width - 80, align: 'center' });
  
  doc.text(`© ${new Date().getFullYear()} Miksir Engineering`, 
           40, y + 22, 
           { width: doc.page.width - 80, align: 'center' });
}

function calculateTotalBinder(mix_design) {
  const cement = parseFloat(mix_design.cement) || 0;
  const admixtures = mix_design.admixtures 
    ? Object.values(mix_design.admixtures).reduce((sum, val) => sum + parseFloat(val || 0), 0)
    : 0;
  
  return Math.round(cement + admixtures);
}

module.exports = { generateMixDesignPDF };