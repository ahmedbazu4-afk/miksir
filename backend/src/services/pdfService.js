const PDFDocument = require('pdfkit');
const logger = require('../utils/logger');

/**
 * 🛡️ BULLETPROOF PDF SERVICE
 * Handles all edge cases with safe fallbacks
 */

/**
 * Generate premium PDF report
 * @param {Object} design - Design record from database
 * @param {Object} options - Additional options
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateMixDesignPDF = (design, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: 'A4', 
        margins: { top: 50, left: 50, right: 50, bottom: 20 },
        bufferPages: true,
        info: {
          Title: `Miksir Mix Design Report`,
          Author: 'Miksir AI Engineering',
          Subject: 'Concrete Mix Design',
          CreationDate: new Date()
        }
      });
      
      const chunks = [];

      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => {
        logger.error('PDFKit error', { error: err.message });
        reject(err);
      });

      // ═══════════════════════════════════════════════════════════
      // SAFE DATA EXTRACTION
      // ═══════════════════════════════════════════════════════════
      
      const safeDesign = design || {};
      const mix_design = safeDesign.mix_design || {};
      const compliance = safeDesign.compliance || {};
      const justification = safeDesign.justification || {};
      const qa_notes = safeDesign.qa_notes || '';
      const field_tips = Array.isArray(safeDesign.field_tips) ? safeDesign.field_tips : [];
      const created_at = safeDesign.created_at || new Date().toISOString();
      const input_params = safeDesign.input_params || {};
      const id = safeDesign.id || 'N/A';

      // Color palette
      const colors = {
        primary: '#1A472A',
        secondary: '#2C5F2D',
        accent: '#FF6B35',
        slate: '#2C3E50',
        lightGray: '#ECF0F1',
        mediumGray: '#95A5A6',
        white: '#FFFFFF',
        success: '#27AE60',
        warning: '#F39C12',
        danger: '#E74C3C',
        info: '#3498DB'
      };

      // ═══════════════════════════════════════════════════════════
      // PAGE 1: COVER PAGE
      // ═══════════════════════════════════════════════════════════
      
      try {
        drawCoverPage(doc, colors, {
          mix_design,
          compliance,
          created_at,
          id,
          input_params
        });
      } catch (coverErr) {
        logger.error('Cover page error', { error: coverErr.message });
        // Continue anyway with basic header
        doc.fontSize(24).font('Helvetica-Bold').text('MIKSIR', 50, 50);
        doc.fontSize(14).text('Concrete Mix Design Report', 50, 80);
      }

      // ═══════════════════════════════════════════════════════════
      // PAGE 2: MIX DESIGN DETAILS
      // ═══════════════════════════════════════════════════════════
      
      doc.addPage();
      
      try {
        drawPageHeader(doc, colors, 'Mix Design Specification', 2);
        drawMixProportionsSection(doc, colors, mix_design, input_params);
      } catch (mixErr) {
        logger.error('Mix design section error', { error: mixErr.message });
        doc.text('Mix design data unavailable', 50, 100);
      }

      // ═══════════════════════════════════════════════════════════
      // PAGE 3: COMPLIANCE
      // ═══════════════════════════════════════════════════════════
      
      doc.addPage();
      
      try {
        drawPageHeader(doc, colors, 'Compliance Analysis', 3);
        drawComplianceSection(doc, colors, compliance);
      } catch (compErr) {
        logger.error('Compliance section error', { error: compErr.message });
        doc.text('Compliance data unavailable', 50, 100);
      }

      // ═══════════════════════════════════════════════════════════
      // PAGE 4: QA & RECOMMENDATIONS
      // ═══════════════════════════════════════════════════════════
      
      doc.addPage();
      
      try {
        drawPageHeader(doc, colors, 'Quality Assurance', 4);
        drawQASection(doc, colors, qa_notes, field_tips, justification);
      } catch (qaErr) {
        logger.error('QA section error', { error: qaErr.message });
        doc.text('QA data unavailable', 50, 100);
      }

      // ═══════════════════════════════════════════════════════════
      // FOOTER ON ALL PAGES
      // ═══════════════════════════════════════════════════════════
      
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        try {
          drawPageFooter(doc, colors, i + 1);
        } catch (footerErr) {
          // Silently continue if footer fails
        }
      }

      doc.end();
      
    } catch (err) {
      logger.error('PDF generation failed', { error: err.message, stack: err.stack });
      reject(err);
    }
  });
};

// ═══════════════════════════════════════════════════════════════
// DRAWING FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function drawCoverPage(doc, colors, data) {
  const { mix_design, compliance, created_at, id, input_params } = data;
  
  // Header bar
  doc.rect(0, 0, doc.page.width, 150).fill(colors.primary);
  
  doc.fontSize(48)
     .font('Helvetica-Bold')
     .fillColor(colors.white)
     .text('MIKSIR', 60, 40);
  
  doc.fontSize(14)
     .font('Helvetica')
     .fillColor(colors.lightGray)
     .text('AI-Powered Concrete Mix Design', 60, 95);
  
  // Report badge
  doc.roundedRect(doc.page.width - 200, 50, 140, 35, 5).fill(colors.accent);
  doc.fontSize(11)
     .font('Helvetica-Bold')
     .fillColor(colors.white)
     .text('PREMIUM', doc.page.width - 195, 62, { width: 130, align: 'center' });
  
  // Design ID
  doc.fontSize(9)
     .fillColor(colors.white)
     .text(`ID: ${String(id).slice(0, 13).toUpperCase()}`, 60, 125);
  
  // Date
  const dateStr = formatDate(created_at);
  doc.text(`Generated: ${dateStr}`, 60, 140);
  
  // Summary section
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('EXECUTIVE SUMMARY', 60, 200);
  
  // Key metrics boxes
  const boxY = 240;
  const boxWidth = (doc.page.width - 160) / 3;
  
  drawMetricBox(doc, colors, {
    x: 60,
    y: boxY,
    width: boxWidth,
    title: 'Target Strength',
    value: safeGet(mix_design, 'target_mean_strength', 'N/A') + (mix_design.target_mean_strength ? ' MPa' : ''),
    color: colors.info
  });
  
  drawMetricBox(doc, colors, {
    x: 60 + boxWidth + 20,
    y: boxY,
    width: boxWidth,
    title: 'W/C Ratio',
    value: safeGet(mix_design, 'w_c_ratio', 'N/A'),
    color: colors.warning
  });
  
  drawMetricBox(doc, colors, {
    x: 60 + (boxWidth + 20) * 2,
    y: boxY,
    width: boxWidth,
    title: 'Compliance',
    value: safeGet(compliance, 'code', 'EN206'),
    color: colors.success
  });
  
  // Key highlights
  const highlightY = boxY + 120;
  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('KEY HIGHLIGHTS', 60, highlightY);
  
  const highlights = [
    `• Cement: ${safeGet(mix_design, 'cement', '-')} kg/m³`,
    `• Water: ${safeGet(mix_design, 'water', '-')} kg/m³`,
    `• Slump: ${safeGet(input_params, 'workability.slump', 'Standard')} mm`,
    `• Code: ${safeGet(compliance, 'code', 'EN206')}`
  ];
  
  doc.fontSize(11).font('Helvetica').fillColor(colors.slate);
  highlights.forEach((h, i) => {
    doc.text(h, 60, highlightY + 30 + (i * 22));
  });
}

function drawPageHeader(doc, colors, title, pageNum) {
  doc.rect(0, 0, doc.page.width, 50).fill(colors.lightGray);
  
  doc.fontSize(16)
     .font('Helvetica-Bold')
     .fillColor(colors.primary)
     .text('MIKSIR', 40, 18);
  
  doc.fontSize(11)
     .font('Helvetica')
     .fillColor(colors.slate)
     .text(title, 150, 20);
  
  doc.fontSize(9)
     .fillColor(colors.mediumGray)
     .text(`Page ${pageNum}`, doc.page.width - 100, 21);
}

function drawMixProportionsSection(doc, colors, mix_design, input_params) {
  const startY = 80;
  
  doc.fontSize(13)
     .font('Helvetica-Bold')
     .fillColor(colors.primary)
     .text('Mix Proportions (per m³ of concrete)', 50, startY);
  
  doc.moveTo(50, startY + 20)
     .lineTo(doc.page.width - 50, startY + 20)
     .strokeColor(colors.accent)
     .lineWidth(2)
     .stroke();
  
  // Materials table
  const tableY = startY + 35;
  const materials = [
    { 
      name: 'Cement', 
      value: safeGet(mix_design, 'cement', '-'),
      unit: 'kg/m³',
      detail: safeGet(input_params, 'materials.cement_type', 'CEM I')
    },
    { 
      name: 'Water', 
      value: safeGet(mix_design, 'water', '-'),
      unit: 'kg/m³',
      detail: 'Potable'
    },
    { 
      name: 'Fine Aggregate', 
      value: safeGet(mix_design, 'fine_aggregate_ssd', safeGet(mix_design, 'fine_aggregate', '-')),
      unit: 'kg/m³',
      detail: 'SSD condition'
    },
    { 
      name: 'Coarse Aggregate', 
      value: safeGet(mix_design, 'coarse_aggregate_ssd', safeGet(mix_design, 'coarse_aggregate', '-')),
      unit: 'kg/m³',
      detail: `${safeGet(input_params, 'materials.coarse_aggregate_size', 19)}mm max`
    }
  ];
  
  // Add admixtures if present
  if (mix_design.admixtures && typeof mix_design.admixtures === 'object') {
    Object.entries(mix_design.admixtures).forEach(([name, value]) => {
      materials.push({
        name: `Admixture: ${name}`,
        value: value,
        unit: 'kg/m³',
        detail: 'Chemical'
      });
    });
  }
  
  drawTable(doc, colors, materials, tableY);
  
  // Key ratios
  const ratioY = tableY + materials.length * 30 + 30;
  doc.fontSize(12)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text('Key Performance Ratios', 50, ratioY);
  
  const ratios = [
    ['W/C Ratio', safeGet(mix_design, 'w_c_ratio', 'N/A')],
    ['Air Content', (safeGet(mix_design, 'air_content_pct', '-')) + (mix_design.air_content_pct ? '%' : '')],
    ['Unit Weight', (safeGet(mix_design, 'unit_weight', '-')) + (mix_design.unit_weight ? ' kg/m³' : '')]
  ];
  
  doc.fontSize(10).font('Helvetica').fillColor(colors.slate);
  ratios.forEach(([label, value], i) => {
    doc.text(`${label}: `, 50, ratioY + 25 + (i * 20), { continued: true })
       .font('Helvetica-Bold')
       .fillColor(colors.primary)
       .text(String(value));
    doc.font('Helvetica').fillColor(colors.slate);
  });
  
  // Batching section if available
  if (mix_design.batching && typeof mix_design.batching === 'object') {
    const batchY = ratioY + 100;
    doc.fontSize(12)
       .font('Helvetica-Bold')
       .fillColor(colors.slate)
       .text('Batching Adjustments (Current Moisture)', 50, batchY);
    
    const batchMaterials = [
      { name: 'Cement', value: safeGet(mix_design.batching, 'cement', '-'), unit: 'kg', detail: 'As-is' },
      { name: 'Water to Add', value: safeGet(mix_design.batching, 'water_to_add', '-'), unit: 'kg', detail: 'Adjusted' },
      { name: 'Fine Aggregate', value: safeGet(mix_design.batching, 'fine_aggregate', '-'), unit: 'kg', detail: 'Current moisture' },
      { name: 'Coarse Aggregate', value: safeGet(mix_design.batching, 'coarse_aggregate', '-'), unit: 'kg', detail: 'Current moisture' }
    ];
    
    drawTable(doc, colors, batchMaterials, batchY + 25);
  }
}

function drawComplianceSection(doc, colors, compliance) {
  const startY = 80;
  
  doc.fontSize(13)
     .font('Helvetica-Bold')
     .fillColor(colors.primary)
     .text(`Code Compliance - ${safeGet(compliance, 'code', 'EN206')}`, 50, startY);
  
  doc.moveTo(50, startY + 20)
     .lineTo(doc.page.width - 50, startY + 20)
     .strokeColor(colors.accent)
     .lineWidth(2)
     .stroke();
  
  const tableY = startY + 40;
  
  if (!compliance.checks || !Array.isArray(compliance.checks) || compliance.checks.length === 0) {
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(colors.mediumGray)
       .text('No compliance checks available', 50, tableY);
    return;
  }
  
  let currentY = tableY;
  
  // Table header
  doc.rect(50, currentY, doc.page.width - 100, 25).fill(colors.primary);
  doc.fontSize(9)
     .font('Helvetica-Bold')
     .fillColor(colors.white)
     .text('Status', 60, currentY + 8)
     .text('Requirement', 140, currentY + 8)
     .text('Target', 380, currentY + 8)
     .text('Actual', 470, currentY + 8);
  
  currentY += 25;
  
  // Rows
  for (const [i, check] of compliance.checks.entries()) {
    const bgColor = i % 2 === 0 ? colors.white : colors.lightGray;
    const statusColor = 
      check.status === 'PASS' ? colors.success :
      check.status === 'WARNING' ? colors.warning : colors.danger;
    
    doc.rect(50, currentY, doc.page.width - 100, 30).fill(bgColor);
    
    // Status badge
    doc.roundedRect(60, currentY + 7, 45, 16, 3).fill(statusColor);
    doc.fontSize(7)
       .font('Helvetica-Bold')
       .fillColor(colors.white)
       .text(check.status || 'N/A', 60, currentY + 11, { width: 45, align: 'center' });
    
    // Description
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(check.description || '', 140, currentY + 10, { width: 230 });
    
    // Target and actual
    doc.text(check.limit !== undefined ? String(check.limit) : check.required || '-', 380, currentY + 10)
       .text(check.actual !== undefined ? `${check.actual}${check.unit || ''}` : '-', 470, currentY + 10);
    
    currentY += 30;
    
    if (currentY > doc.page.height - 100) break; // Prevent overflow
  }
}

function drawQASection(doc, colors, qa_notes, field_tips, justification) {
  let currentY = 80;
  
  // QA Notes
  if (qa_notes && qa_notes.length > 0) {
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor(colors.primary)
       .text('Quality Assurance Notes', 50, currentY);
    
    currentY += 30;
    
    doc.roundedRect(50, currentY, doc.page.width - 100, 60, 5)
       .fillAndStroke(colors.lightGray, colors.mediumGray);
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(qa_notes, 60, currentY + 10, { width: doc.page.width - 120 });
    
    currentY += 80;
  }
  
  // Field Tips
  if (field_tips && field_tips.length > 0) {
    doc.fontSize(13)
       .font('Helvetica-Bold')
       .fillColor(colors.primary)
       .text('Field Implementation Tips', 50, currentY);
    
    currentY += 30;
    
    const tipsToDraw = field_tips.slice(0, 8);
    for (let i = 0; i < tipsToDraw.length; i++) {
      const tip = tipsToDraw[i];
      doc.circle(60, currentY + 6, 8).fillAndStroke(colors.accent, colors.accent);
      doc.fontSize(9)
         .font('Helvetica-Bold')
         .fillColor(colors.white)
         .text(String(i + 1), 56, currentY + 3);
      
      doc.fontSize(10)
         .font('Helvetica')
         .fillColor(colors.slate)
         .text(tip, 80, currentY, { width: doc.page.width - 130 });
      
      currentY = doc.y + 10;
      
      if (currentY > doc.page.height - 100) break;
    }
  }
  
  // Justification
  if (justification && typeof justification === 'object' && Object.keys(justification).length > 0) {
    if (currentY < doc.page.height - 150) {
      currentY += 20;
      
      doc.fontSize(13)
         .font('Helvetica-Bold')
         .fillColor(colors.primary)
         .text('Design Justification', 50, currentY);
      
      currentY += 30;
      
      const entries = Object.entries(justification).slice(0, 5);
      for (const [key, value] of entries) {
        doc.fontSize(10)
           .font('Helvetica-Bold')
           .fillColor(colors.accent)
           .text(key.replace(/_/g, ' ').toUpperCase() + ':', 50, currentY, { continued: true });
        
        doc.font('Helvetica')
           .fillColor(colors.slate)
           .text(' ' + value, { width: doc.page.width - 100 });
        
        currentY = doc.y + 10;
        
        if (currentY > doc.page.height - 100) break;
      }
    }
  }
}

function drawTable(doc, colors, rows, startY) {
  let currentY = startY;
  
  // Header
  doc.rect(50, currentY, doc.page.width - 100, 25).fill(colors.primary);
  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor(colors.white)
     .text('Material', 60, currentY + 8)
     .text('Quantity', 250, currentY + 8)
     .text('Notes', 380, currentY + 8);
  
  currentY += 25;
  
  // Rows
  rows.forEach((row, i) => {
    const bgColor = i % 2 === 0 ? colors.white : colors.lightGray;
    
    doc.rect(50, currentY, doc.page.width - 100, 25).fill(bgColor);
    
    doc.fontSize(10)
       .font('Helvetica')
       .fillColor(colors.slate)
       .text(row.name, 60, currentY + 8);
    
    doc.fontSize(11)
       .font('Helvetica-Bold')
       .fillColor(colors.primary)
       .text(`${row.value} ${row.unit}`, 250, currentY + 8);
    
    doc.fontSize(9)
       .font('Helvetica')
       .fillColor(colors.mediumGray)
       .text(row.detail || '', 380, currentY + 8);
    
    currentY += 25;
  });
}

function drawMetricBox(doc, colors, options) {
  const { x, y, width, title, value, color } = options;
  
  doc.roundedRect(x, y, width, 90, 8).fillAndStroke(colors.white, colors.lightGray);
  doc.roundedRect(x, y, width, 6, 8).fill(color);
  
  doc.fontSize(9)
     .font('Helvetica')
     .fillColor(colors.mediumGray)
     .text(title, x + 10, y + 20, { width: width - 20, align: 'center' });
  
  doc.fontSize(18)
     .font('Helvetica-Bold')
     .fillColor(colors.slate)
     .text(String(value), x + 10, y + 40, { width: width - 20, align: 'center' });
}

function drawPageFooter(doc, colors, pageNum) {
  const y = doc.page.height - 40;
  
  doc.moveTo(50, y).lineTo(doc.page.width - 50, y)
     .strokeColor(colors.lightGray)
     .lineWidth(1)
     .stroke();
  
  doc.fontSize(8)
     .font('Helvetica')
     .fillColor(colors.mediumGray)
     .text('Generated by Miksir AI | For engineering review only', 
           50, y + 8, 
           { width: doc.page.width - 100, align: 'center' });
  
  doc.text(`Page ${pageNum}`, 
           50, y + 20, 
           { width: doc.page.width - 100, align: 'center' });
}

// ═══════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════

function safeGet(obj, path, defaultValue = '-') {
  try {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result && typeof result === 'object' && key in result) {
        result = result[key];
      } else {
        return defaultValue;
      }
    }
    
    return result !== null && result !== undefined ? result : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}

function formatDate(dateStr) {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  } catch (err) {
    return new Date().toLocaleDateString('en-GB');
  }
}

module.exports = { generateMixDesignPDF };