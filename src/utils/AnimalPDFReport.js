/**
 * AnimalPDFReport.js
 * 
 * Generates a professional per-animal economic viability PDF report.
 * Covers: identity, weight tracking, full cost breakdown, revenue,
 * margin analysis, and a highlighted VERDICT section.
 */
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import db from '../db';

// ── Color Palette ──────────────────────────────────────────
const CLR = {
  primary:    [99, 102, 241],   // indigo
  dark:       [15, 23, 42],     // slate-900
  surface:    [30, 41, 59],     // slate-800
  text:       [241, 245, 249],  // slate-100
  muted:      [148, 163, 184],  // slate-400
  win:        [74, 222, 128],   // green
  winBg:      [22, 101, 52],    // green-900
  lose:       [248, 113, 113],  // red-400
  loseBg:     [127, 29, 29],    // red-900
  gold:       [250, 204, 21],   // amber
  row1:       [30, 41, 59],     // odd row
  row2:       [15, 23, 42],     // even row
  border:     [51, 65, 85],     // slate-700
  white:      [255, 255, 255],
};

/**
 * Generate and download a PDF economic report for a single animal
 * @param {object} animal - The enriched animal object from getAnimalsWithPL()
 * @param {object} settings - App settings (currency, farmName, marketPricePerKg)
 */
export async function generateAnimalPDF(animal, settings) {
  const cur = settings.currency || 'EGP';
  const farm = settings.farmName || 'Shash Farm';
  const marketPrice = settings.marketPricePerKg || 240;
  const tag = animal.tag;

  // Fetch detailed records for this animal
  const [weights, medicines, vaccines, feedCosts, revenues, allExpenses] = await Promise.all([
    db.weightRecords.where('animal_tag').equals(tag).sortBy('weigh_date'),
    db.medicineRecords.where('animal_tag').equals(tag).sortBy('date'),
    db.vaccineRecords.where('animal_tag').equals(tag).sortBy('date'),
    db.dailyFeedCosts.where('animal_tag').equals(tag).sortBy('date'),
    db.revenueRecords.where('animal_tag').equals(tag).sortBy('date'),
    db.expenses.where('animal_tag').equals(tag).sortBy('date'),
  ]);

  const doc = new jsPDF('p', 'mm', 'a4');
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  let y = 0;

  // ── Helper Functions ──────────────────────────────────────
  const fmt = (v) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const fmtDec = (v, d = 2) => (v || 0).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pageCheck = (need = 30) => { if (y + need > H - 20) { addFooter(); doc.addPage(); y = 15; } };

  function addFooter() {
    doc.setFillColor(...CLR.dark);
    doc.rect(0, H - 12, W, 12, 'F');
    doc.setFontSize(7);
    doc.setTextColor(...CLR.muted);
    doc.text(`Cowculator — ${farm}  |  Generated ${new Date().toLocaleDateString('en-GB')}  |  Animal #${tag}`, W / 2, H - 5, { align: 'center' });
    doc.text(`Page ${doc.internal.getNumberOfPages()}`, W - 14, H - 5);
  }

  function sectionTitle(title, emoji = '') {
    pageCheck(22);
    y += 4;
    doc.setFillColor(...CLR.surface);
    doc.roundedRect(10, y, W - 20, 10, 2, 2, 'F');
    doc.setFontSize(11);
    doc.setTextColor(...CLR.white);
    doc.setFont('helvetica', 'bold');
    doc.text(`${emoji}  ${title}`, 15, y + 7);
    y += 14;
    doc.setFont('helvetica', 'normal');
  }

  function metricRow(label, value, options = {}) {
    pageCheck(8);
    const { color, bold, indent } = options;
    const x = indent ? 18 : 14;
    doc.setFontSize(9);
    doc.setTextColor(...CLR.muted);
    doc.text(label, x, y);
    doc.setTextColor(...(color || CLR.white));
    if (bold) doc.setFont('helvetica', 'bold');
    doc.text(String(value), W - 14, y, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    y += 6;
  }

  function divider() {
    pageCheck(6);
    doc.setDrawColor(...CLR.border);
    doc.setLineWidth(0.3);
    doc.line(14, y, W - 14, y);
    y += 4;
  }

  // ══════════════════════════════════════════════════════════
  // PAGE 1: HEADER + IDENTITY + VERDICT
  // ══════════════════════════════════════════════════════════

  // Full-page dark background
  doc.setFillColor(...CLR.dark);
  doc.rect(0, 0, W, H, 'F');

  // ── Header Banner ──
  const isWin = animal.unrealizedPL >= 0;
  doc.setFillColor(...(isWin ? CLR.win : CLR.lose));
  doc.rect(0, 0, W, 44, 'F');

  doc.setFontSize(26);
  doc.setTextColor(...CLR.dark);
  doc.setFont('helvetica', 'bold');
  doc.text(`ANIMAL #${tag}`, 14, 18);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Economic Viability Report`, 14, 27);
  doc.setFontSize(9);
  doc.text(`${farm}  •  ${new Date().toLocaleDateString('en-GB')}  •  Market @ ${fmt(marketPrice)} ${cur}/kg`, 14, 36);

  // Verdict badge on right of header
  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.text(isWin ? 'WIN' : 'LOSE', W - 14, 24, { align: 'right' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(isWin ? 'ECONOMICALLY VIABLE' : 'OPERATING AT LOSS', W - 14, 36, { align: 'right' });

  y = 52;

  // ── Section 1: Animal Identity ──
  sectionTitle('Animal Identity', '🐄');
  metricRow('Tag Number', `#${tag}`);
  metricRow('Species', (animal.species || 'heifer').charAt(0).toUpperCase() + (animal.species || 'heifer').slice(1));
  metricRow('Pen / Housing', animal.pen_id || 'Unassigned');
  metricRow('Lifecycle Stage', (animal.lifecycle_stage || 'fattening').charAt(0).toUpperCase() + (animal.lifecycle_stage || 'fattening').slice(1));
  metricRow('Entry Date', animal.entry_date || '—');
  metricRow('Days on Farm', `${animal.daysOnFarm || 0} days`);
  if (animal.fattening_days) metricRow('Target Fattening', `${animal.fattening_days} days`);

  divider();

  // ── Section 2: Weight Tracking ──
  sectionTitle('Weight Performance', '⚖️');
  metricRow('Entry Weight', `${fmt(animal.entry_weight)} kg`);
  metricRow('Current Weight', `${fmt(animal.currentWeight)} kg`);
  metricRow('Weight Gained', `+${fmtDec(animal.weightGain, 1)} kg`, { color: CLR.win });
  metricRow('Daily Weight Gain', `${fmtDec(animal.dailyGain)} kg/day`);
  metricRow('Price/kg at Entry', `${fmt(animal.price_per_kg_entry || Math.round((animal.purchase_price || 0) / (animal.entry_weight || 1)))} ${cur}`);
  metricRow('Current Market Price/kg', `${fmt(marketPrice)} ${cur}`);

  if (weights.length > 0) {
    pageCheck(20 + weights.length * 7);
    y += 2;
    doc.setFontSize(9);
    doc.setTextColor(...CLR.muted);
    doc.text('Weight History:', 14, y);
    y += 5;
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Date', 'Weight (kg)', 'Change']],
      body: weights.map((w, i) => {
        const prev = i > 0 ? weights[i - 1].weight_kg : animal.entry_weight;
        const change = w.weight_kg - prev;
        return [w.weigh_date, `${fmtDec(w.weight_kg, 1)}`, change >= 0 ? `+${fmtDec(change, 1)}` : fmtDec(change, 1)];
      }),
      theme: 'plain',
      styles: { fontSize: 8, textColor: CLR.white, cellPadding: 2 },
      headStyles: { fillColor: CLR.surface, textColor: CLR.gold, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CLR.row2 },
      bodyStyles: { fillColor: CLR.row1 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  divider();

  // ── Section 3: Full Cost Breakdown ──
  sectionTitle('Cost Breakdown', '💰');

  const costItems = [
    { label: 'Purchase Price (رأس المال)', value: animal.purchase_price || 0, pct: 0 },
    { label: 'Feed Costs (علف)', value: animal.totalFeed || 0 },
    { label: 'Vaccine Costs (تحصينات)', value: animal.totalVaccines || 0 },
    { label: 'Medicine Costs (أدوية)', value: animal.totalMedicine || 0 },
    { label: 'Admin / Other (إدارية)', value: (animal.totalAdmin || 0) + (animal.totalOther || 0) },
  ];
  const totalCost = animal.totalCost || 0;
  costItems.forEach(c => { c.pct = totalCost > 0 ? (c.value / totalCost * 100) : 0; });

  // Draw cost table with percentage bars
  costItems.forEach(item => {
    pageCheck(10);
    doc.setFontSize(9);
    doc.setTextColor(...CLR.muted);
    doc.text(item.label, 14, y);
    doc.setTextColor(...CLR.white);
    doc.text(`${fmt(item.value)} ${cur}`, W - 45, y, { align: 'right' });
    doc.setTextColor(...CLR.muted);
    doc.text(`${fmtDec(item.pct, 1)}%`, W - 14, y, { align: 'right' });
    // Mini bar
    const barW = 30;
    const barX = W - 44;
    doc.setFillColor(...CLR.surface);
    doc.roundedRect(barX, y + 1, barW, 2.5, 1, 1, 'F');
    doc.setFillColor(...CLR.primary);
    doc.roundedRect(barX, y + 1, Math.max(barW * item.pct / 100, 0.5), 2.5, 1, 1, 'F');
    y += 8;
  });

  divider();

  metricRow('TOTAL COST (التكلفة الإجمالية)', `${fmt(totalCost)} ${cur}`, { bold: true });
  metricRow('Cost per kg Gained', totalCost > 0 && animal.weightGain > 0 ? `${fmtDec(totalCost / animal.weightGain)} ${cur}/kg` : '—');
  metricRow('Cost per Day', animal.daysOnFarm > 0 ? `${fmtDec(totalCost / animal.daysOnFarm)} ${cur}/day` : '—');

  // ── Section 4: Detailed Expense Records ──
  if (allExpenses.length > 0) {
    pageCheck(30);
    sectionTitle('Expense Ledger (Details)', '📋');
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Date', 'Category', 'Description', `Amount (${cur})`]],
      body: allExpenses.slice(0, 60).map(e => [
        e.date || '—',
        (e.category || 'other').charAt(0).toUpperCase() + (e.category || '').slice(1),
        e.description || '—',
        fmt(e.amount),
      ]),
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: CLR.white, cellPadding: 2 },
      headStyles: { fillColor: CLR.surface, textColor: CLR.gold, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CLR.row2 },
      bodyStyles: { fillColor: CLR.row1 },
      columnStyles: { 3: { halign: 'right', fontStyle: 'bold' } },
      didDrawPage: () => {
        doc.setFillColor(...CLR.dark);
        // Don't override the auto-drawn table
      },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── Section 5: Medicine Records ──
  if (medicines.length > 0) {
    pageCheck(24);
    sectionTitle('Medicine Records (أدوية)', '💊');
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Date', 'Medicine', 'Dose', `Cost (${cur})`]],
      body: medicines.map(m => [
        m.date, m.medicine_name || '—', m.dose || '1',
        fmt((parseFloat(m.dose) || 1) * (parseFloat(m.dose_price) || 0)),
      ]),
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: CLR.white, cellPadding: 2 },
      headStyles: { fillColor: CLR.surface, textColor: CLR.gold, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CLR.row2 },
      bodyStyles: { fillColor: CLR.row1 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── Section 6: Vaccine Records ──
  if (vaccines.length > 0) {
    pageCheck(24);
    sectionTitle('Vaccine Records (تحصينات)', '💉');
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Date', 'Vaccine', 'Doses', `Cost (${cur})`]],
      body: vaccines.map(v => [
        v.date, v.vaccine_name || '—', v.dose_count || '1',
        fmt((parseFloat(v.dose_count) || 1) * (parseFloat(v.dose_price) || 0)),
      ]),
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: CLR.white, cellPadding: 2 },
      headStyles: { fillColor: CLR.surface, textColor: CLR.gold, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CLR.row2 },
      bodyStyles: { fillColor: CLR.row1 },
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  // ── Section 7: Revenue & Sales ──
  sectionTitle('Revenue & Sales (الإيرادات)', '💵');
  const totalRevenue = revenues.reduce((s, r) => s + (parseFloat(r.total_amount) || parseFloat(r.amount) || 0), 0);

  if (revenues.length > 0) {
    autoTable(doc, {
      startY: y,
      margin: { left: 14, right: 14 },
      head: [['Date', 'Type', 'Weight (kg)', `Price/kg`, `Total (${cur})`, 'Buyer']],
      body: revenues.map(r => [
        r.date, r.type || '—', fmtDec(r.sale_weight, 0) || '—',
        fmt(r.sale_price_per_kg) || '—',
        fmt(parseFloat(r.total_amount) || parseFloat(r.amount) || 0),
        r.buyer || '—',
      ]),
      theme: 'plain',
      styles: { fontSize: 7.5, textColor: CLR.white, cellPadding: 2 },
      headStyles: { fillColor: CLR.surface, textColor: CLR.gold, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: CLR.row2 },
      bodyStyles: { fillColor: CLR.row1 },
      columnStyles: { 4: { halign: 'right', fontStyle: 'bold', textColor: CLR.win } },
    });
    y = doc.lastAutoTable.finalY + 4;
  } else {
    doc.setFontSize(9);
    doc.setTextColor(...CLR.muted);
    doc.text('No revenue recorded for this animal yet.', 14, y);
    y += 6;
  }
  metricRow('Total Revenue (إجمالي الإيرادات)', `${fmt(totalRevenue)} ${cur}`, { color: totalRevenue > 0 ? CLR.win : CLR.muted, bold: true });

  // ══════════════════════════════════════════════════════════
  // FINAL VERDICT SECTION — The key highlight
  // ══════════════════════════════════════════════════════════
  pageCheck(65);
  y += 4;
  sectionTitle('ECONOMIC VERDICT — هل هذا الرأس مربح؟', '⚖️');

  const estimatedValue = animal.estimatedValue || 0;
  const unrealizedPL = animal.unrealizedPL || 0;
  const realizedPL = totalRevenue - totalCost;
  const hasSold = totalRevenue > 0;
  const margin = totalCost > 0 ? ((hasSold ? realizedPL : unrealizedPL) / totalCost * 100) : 0;
  const roi = totalCost > 0 ? (((hasSold ? totalRevenue : estimatedValue) - totalCost) / totalCost * 100) : 0;
  const finalVerdict = hasSold ? realizedPL >= 0 : unrealizedPL >= 0;

  // Big verdict box
  const boxH = 50;
  const verdictColor = finalVerdict ? CLR.win : CLR.lose;
  const verdictBg = finalVerdict ? CLR.winBg : CLR.loseBg;

  doc.setFillColor(...verdictBg);
  doc.roundedRect(14, y, W - 28, boxH, 4, 4, 'F');
  doc.setDrawColor(...verdictColor);
  doc.setLineWidth(1);
  doc.roundedRect(14, y, W - 28, boxH, 4, 4, 'S');

  // Verdict label
  doc.setFontSize(32);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...verdictColor);
  doc.text(finalVerdict ? '✓ WIN' : '✗ LOSE', 24, y + 20);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text(
    finalVerdict
      ? 'This animal IS economically viable for the farm.'
      : 'This animal is NOT economically viable — consider action.',
    24, y + 30
  );

  // Key metrics on the right side of verdict box
  doc.setFontSize(9);
  doc.setTextColor(...CLR.white);
  doc.text(`Total Cost:`, W - 80, y + 12);
  doc.setFont('helvetica', 'bold');
  doc.text(`${fmt(totalCost)} ${cur}`, W - 22, y + 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.text(hasSold ? `Total Revenue:` : `Est. Value:`, W - 80, y + 20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...(finalVerdict ? CLR.win : CLR.lose));
  doc.text(`${fmt(hasSold ? totalRevenue : estimatedValue)} ${cur}`, W - 22, y + 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CLR.white);
  doc.text(hasSold ? `Realized P/L:` : `Unrealized P/L:`, W - 80, y + 28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...verdictColor);
  const plVal = hasSold ? realizedPL : unrealizedPL;
  doc.text(`${plVal >= 0 ? '+' : ''}${fmt(plVal)} ${cur}`, W - 22, y + 28, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CLR.white);
  doc.text(`ROI:`, W - 80, y + 36);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...verdictColor);
  doc.text(`${roi >= 0 ? '+' : ''}${fmtDec(roi, 1)}%`, W - 22, y + 36, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...CLR.white);
  doc.text(`Margin:`, W - 80, y + 44);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...verdictColor);
  doc.text(`${margin >= 0 ? '+' : ''}${fmtDec(margin, 1)}%`, W - 22, y + 44, { align: 'right' });

  y += boxH + 8;

  // Recommendation
  pageCheck(20);
  doc.setFontSize(9);
  doc.setTextColor(...CLR.muted);
  doc.setFont('helvetica', 'italic');
  if (finalVerdict) {
    doc.text('Recommendation: Continue current management. Monitor daily gain to maximize returns.', 14, y);
  } else {
    doc.text('Recommendation: Review feed efficiency, reduce costs, or consider early sale to minimize losses.', 14, y);
  }
  y += 5;
  if (animal.costPerKg > marketPrice && !hasSold) {
    doc.setTextColor(...CLR.lose);
    doc.text(`⚠ Warning: Cost per kg gained (${fmtDec(animal.costPerKg)} ${cur}) exceeds market price (${fmt(marketPrice)} ${cur}/kg).`, 14, y);
  }

  // Footer on all pages
  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    // Dark page backgrounds for pages 2+
    if (p > 1) {
      doc.setFillColor(...CLR.dark);
      doc.rect(0, 0, W, H, 'F');
      // Re-draw table on page (autoTable handles this, but ensure bg)
    }
    addFooter();
  }

  // Download
  doc.save(`Animal-${tag}-Report-${new Date().toISOString().split('T')[0]}.pdf`);
  return true;
}
