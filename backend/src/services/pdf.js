const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const CATEGORY_LABELS = {
  travel: 'Rejse', food: 'Mad & drikke', hotel: 'Hotel',
  transport: 'Transport', other: 'Andet',
};

function fmtDKK(amount) {
  return new Intl.NumberFormat('da-DK', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  }).format(amount) + ' DKK';
}

function fmtDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
}

function fmtShortDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('da-DK', { day: 'numeric', month: 'short' });
}

async function generateReportPDF(report, expenses, outputStream) {
  const uploadDir = process.env.UPLOAD_DIR || './uploads';
  const total = expenses.reduce((s, e) => s + parseFloat(e.amount_dkk || 0), 0);

  const doc = new PDFDocument({ size: 'A4', margin: 50,
    info: { Title: report.name, Author: 'Kvitto', Subject: 'Udgiftsrapport' } });
  doc.pipe(outputStream);

  // ── HEADER ───────────────────────────────────────────────────────────────
  doc.fontSize(22).font('Helvetica-Bold').fillColor('#111').text('Udgiftsrapport', 50, 50);
  doc.fontSize(14).font('Helvetica').fillColor('#555').text(report.name, 50, 80);
  if (report.description) {
    doc.fontSize(10).fillColor('#888').text(report.description, 50, 100);
  }
  doc.fontSize(9).fillColor('#aaa').text(`Genereret: ${fmtDate(new Date())}`, 400, 50, { align: 'right', width: 145 });
  doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#ddd').lineWidth(1).stroke();

  // ── SUMMARY ───────────────────────────────────────────────────────────────
  const sy = 132;
  const summaryItems = [
    { label: 'Antal udgifter', value: String(expenses.length) },
    { label: 'Total (DKK)',    value: fmtDKK(total) },
    { label: 'Status',         value: report.status === 'approved' ? 'Godkendt'
                                    : report.status === 'submitted' ? 'Til godkendelse'
                                    : 'Igangværende' },
  ];
  const colW = 160;
  summaryItems.forEach((item, i) => {
    const x = 50 + i * colW;
    doc.roundedRect(x, sy, colW - 8, 52, 4).fillColor('#f5f4f0').fill();
    doc.fillColor('#999').fontSize(8).font('Helvetica').text(item.label, x + 10, sy + 9, { width: colW - 20 });
    doc.fillColor('#111').fontSize(12).font('Helvetica-Bold').text(item.value, x + 10, sy + 23, { width: colW - 20 });
  });

  // ── EXPENSE TABLE ─────────────────────────────────────────────────────────
  let y = sy + 68;
  doc.fillColor('#111').fontSize(12).font('Helvetica-Bold').text('Udgifter', 50, y);
  y += 18;

  // Header row
  doc.fillColor('#f0ede8').rect(50, y, 495, 20).fill();
  doc.fillColor('#666').fontSize(8).font('Helvetica-Bold');
  doc.text('Dato',        56, y + 6);
  doc.text('Beskrivelse', 110, y + 6);
  doc.text('Kategori',    280, y + 6);
  doc.text('Orig. beløb', 355, y + 6);
  doc.text('Kurs',        425, y + 6);
  doc.text('DKK',         475, y + 6);
  y += 20;

  for (let i = 0; i < expenses.length; i++) {
    const exp = expenses[i];
    if (y > 720) { doc.addPage(); y = 50; }
    if (i % 2 === 0) { doc.fillColor('#fafaf8').rect(50, y, 495, 24).fill(); }

    const rate = exp.exchange_rate ? parseFloat(exp.exchange_rate) : null;

    doc.fillColor('#111').fontSize(8).font('Helvetica');
    doc.text(fmtShortDate(exp.expense_date), 56, y + 8, { width: 52, ellipsis: true });
    doc.text(exp.description, 110, y + 8, { width: 164, ellipsis: true });
    doc.text(CATEGORY_LABELS[exp.category] || exp.category, 280, y + 8, { width: 70 });

    if (exp.currency !== 'DKK') {
      doc.text(`${parseFloat(exp.amount).toLocaleString('da-DK')} ${exp.currency}`, 355, y + 8, { width: 66 });
      doc.fillColor('#888').text(rate ? rate.toFixed(4) : '—', 425, y + 8, { width: 46 });
    } else {
      doc.text('—', 355, y + 8, { width: 66 });
      doc.fillColor('#888').text('—', 425, y + 8, { width: 46 });
    }

    doc.fillColor('#111').font('Helvetica-Bold').text(fmtDKK(exp.amount_dkk), 475, y + 8, { width: 68 });
    doc.moveTo(50, y + 24).lineTo(545, y + 24).strokeColor('#ececec').lineWidth(0.4).stroke();
    y += 24;
  }

  // Total row
  doc.fillColor('#534AB7').rect(50, y, 495, 26).fill();
  doc.fillColor('#fff').fontSize(9).font('Helvetica-Bold');
  doc.text('Total', 56, y + 9);
  doc.text(fmtDKK(total), 475, y + 9, { width: 68 });

  // ── RECEIPTS — én udgift pr. side ─────────────────────────────────────────
  const withReceipts = expenses.filter(e => e.receipt_path);
  if (withReceipts.length === 0) { doc.end(); return; }

  for (const exp of withReceipts) {
    const filePath = path.join(uploadDir, exp.receipt_path);
    const ext = path.extname(exp.receipt_path).toLowerCase();

    doc.addPage();

    // Side-header
    doc.fillColor('#111').fontSize(13).font('Helvetica-Bold')
      .text(exp.description, 50, 50, { width: 445 });

    const rateStr = exp.exchange_rate && exp.currency !== 'DKK'
      ? ` · Kurs: ${parseFloat(exp.exchange_rate).toFixed(4)}`
      : '';
    doc.fillColor('#888').fontSize(9).font('Helvetica').text(
      `${fmtDate(exp.expense_date)}` +
      `${exp.currency !== 'DKK' ? ` · ${parseFloat(exp.amount).toLocaleString('da-DK')} ${exp.currency}${rateStr}` : ''}` +
      ` · ${fmtDKK(exp.amount_dkk)}`,
      50, 70, { width: 495 }
    );

    doc.moveTo(50, 88).lineTo(545, 88).strokeColor('#ddd').lineWidth(1).stroke();

    try {
      if (fs.existsSync(filePath)) {
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
          doc.image(filePath, 50, 100, { fit: [495, 650], align: 'center' });
        } else if (ext === '.pdf') {
          doc.fillColor('#555').fontSize(10).font('Helvetica')
            .text('[PDF kvittering — se original fil]', 50, 110);
        }
      } else {
        doc.fillColor('#c00').fontSize(10).text('[Filen kunne ikke findes]', 50, 110);
      }
    } catch {
      doc.fillColor('#c00').fontSize(10).text('[Billedet kunne ikke indlæses]', 50, 110);
    }
  }

  doc.end();
}

module.exports = { generateReportPDF };
