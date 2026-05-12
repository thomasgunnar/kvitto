const nodemailer = require('nodemailer');

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;

  _transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true = port 465, false = STARTTLS
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });

  return _transporter;
}

async function sendInviteEmail({ to, inviterName, inviteUrl, expiresHours = 48 }) {
  const from = process.env.SMTP_FROM || `Kvitto <${process.env.SMTP_USER}>`;

  const html = `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eeecea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd8">

        <!-- Header -->
        <tr><td style="background:#534AB7;padding:28px 32px;text-align:center">
          <div style="display:inline-block;width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:10px;line-height:44px;font-size:22px;font-weight:700;color:#fff">K</div>
          <div style="color:#fff;font-size:20px;font-weight:700;margin-top:10px">Kvitto</div>
          <div style="color:rgba(255,255,255,0.7);font-size:13px;margin-top:4px">Udgiftsstyring</div>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1a1a18">
            Du er blevet inviteret
          </h1>
          <p style="margin:0 0 20px;font-size:14px;color:#5c5b57;line-height:1.6">
            <strong>${inviterName}</strong> har inviteret dig til at oprette en konto i Kvitto.
          </p>

          <div style="text-align:center;margin:28px 0">
            <a href="${inviteUrl}"
              style="display:inline-block;background:#534AB7;color:#fff;text-decoration:none;
                     padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600">
              Opret konto →
            </a>
          </div>

          <p style="margin:0 0 8px;font-size:13px;color:#9c9a92;text-align:center">
            Linket er gyldigt i ${expiresHours} timer.
          </p>
          <p style="margin:0;font-size:12px;color:#c0bdb6;text-align:center;word-break:break-all">
            ${inviteUrl}
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f5f4f0;padding:16px 32px;text-align:center;border-top:1px solid #eeecea">
          <p style="margin:0;font-size:12px;color:#9c9a92">
            Har du ikke bedt om denne invitation? Du kan bare ignorere denne e-mail.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Du er blevet inviteret til Kvitto af ${inviterName}.\n\nOpret din konto her:\n${inviteUrl}\n\nLinket er gyldigt i ${expiresHours} timer.`;

  await getTransporter().sendMail({ from, to, subject: 'Invitation til Kvitto', html, text });
}

async function verifySmtp() {
  try {
    await getTransporter().verify();
    console.log('✓ SMTP forbundet');
  } catch (err) {
    console.warn('⚠ SMTP ikke tilgængelig:', err.message);
  }
}

async function sendResetEmail({ to, userName, resetUrl }) {
  const from = process.env.SMTP_FROM || `Kvitto <${process.env.SMTP_USER}>`;

  const html = `
<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eeecea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd8">
        <tr><td style="background:#534AB7;padding:28px 32px;text-align:center">
          <div style="display:inline-block;width:44px;height:44px;background:rgba(255,255,255,0.2);border-radius:10px;line-height:44px;font-size:22px;font-weight:700;color:#fff">K</div>
          <div style="color:#fff;font-size:20px;font-weight:700;margin-top:10px">Kvitto</div>
        </td></tr>
        <tr><td style="padding:32px">
          <h1 style="margin:0 0 12px;font-size:20px;font-weight:600;color:#1a1a18">Nulstil adgangskode</h1>
          <p style="margin:0 0 20px;font-size:14px;color:#5c5b57;line-height:1.6">
            Hej ${userName},<br><br>
            Vi har modtaget en anmodning om at nulstille adgangskoden til din Kvitto-konto.
            Klik på knappen nedenfor for at vælge en ny adgangskode.
          </p>
          <div style="text-align:center;margin:28px 0">
            <a href="${resetUrl}"
              style="display:inline-block;background:#534AB7;color:#fff;text-decoration:none;
                     padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600">
              Nulstil adgangskode →
            </a>
          </div>
          <p style="margin:0 0 8px;font-size:13px;color:#9c9a92;text-align:center">
            Linket er gyldigt i 1 time.
          </p>
          <p style="margin:0;font-size:13px;color:#9c9a92;text-align:center">
            Har du ikke bedt om dette? Du kan ignorere denne e-mail — din adgangskode forbliver uændret.
          </p>
        </td></tr>
        <tr><td style="background:#f5f4f0;padding:16px 32px;text-align:center;border-top:1px solid #eeecea">
          <p style="margin:0;font-size:12px;color:#9c9a92;word-break:break-all">${resetUrl}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = `Nulstil din Kvitto-adgangskode\n\nHej ${userName},\n\nKlik her for at vælge en ny adgangskode:\n${resetUrl}\n\nLinket er gyldigt i 1 time.\n\nHar du ikke bedt om dette? Ignorer denne e-mail.`;

  await getTransporter().sendMail({
    from, to,
    subject: 'Nulstil din adgangskode – Kvitto',
    html, text,
  });
}

async function sendExpenseEmail({ to, expense, isUpdate, receiptPath }) {
  const from = process.env.SMTP_FROM || `Kvitto <${process.env.SMTP_USER}>`;

  const CAT_LABELS = {
    travel: 'Rejse', food: 'Mad & drikke', hotel: 'Hotel',
    transport: 'Transport', other: 'Andet',
  };

  function fmtDKK(n) {
    return Number(n).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DKK';
  }

  function fmtDate(d) {
    return new Date(d).toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const action   = isUpdate ? 'Udgift opdateret' : 'Ny udgift registreret';
  const rateRow  = expense.currency !== 'DKK' && expense.exchange_rate
    ? `<tr><td style="padding:6px 0;color:#777;font-size:13px">Valutakurs</td><td style="padding:6px 0;font-size:13px;text-align:right">${parseFloat(expense.exchange_rate).toFixed(4)} DKK/${expense.currency}</td></tr>`
    : '';
  const origRow  = expense.currency !== 'DKK'
    ? `<tr><td style="padding:6px 0;color:#777;font-size:13px">Beløb (original)</td><td style="padding:6px 0;font-size:13px;text-align:right">${parseFloat(expense.amount).toLocaleString('da-DK')} ${expense.currency}</td></tr>`
    : '';
  const reportRow = expense.report_name
    ? `<tr><td style="padding:6px 0;color:#777;font-size:13px">Rapport</td><td style="padding:6px 0;font-size:13px;text-align:right">${expense.report_name}</td></tr>`
    : '';
  const notesRow = expense.notes
    ? `<tr><td style="padding:6px 0;color:#777;font-size:13px">Noter</td><td style="padding:6px 0;font-size:13px;text-align:right">${expense.notes}</td></tr>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="da">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#eeecea;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table width="100%" style="max-width:480px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e0ddd8">
        <tr><td style="background:#534AB7;padding:22px 32px;text-align:center">
          <div style="display:inline-block;width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:9px;line-height:40px;font-size:20px;font-weight:700;color:#fff">K</div>
          <div style="color:#fff;font-size:11px;margin-top:6px;opacity:0.8">Kvitto – Udgiftsstyring</div>
        </td></tr>
        <tr><td style="padding:24px 32px 0">
          <div style="font-size:11px;color:#534AB7;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px">${action}</div>
          <div style="font-size:20px;font-weight:700;color:#1a1a18;margin-bottom:4px">${expense.description}</div>
          <div style="font-size:13px;color:#9c9a92">${fmtDate(expense.expense_date)} · ${CAT_LABELS[expense.category] || expense.category}</div>
        </td></tr>
        <tr><td style="padding:20px 32px">
          <table width="100%" style="border-top:1px solid #eeecea;border-bottom:1px solid #eeecea">
            <tr>
              <td style="padding:14px 0 6px;color:#777;font-size:13px">Beløb (DKK)</td>
              <td style="padding:14px 0 6px;font-size:22px;font-weight:700;color:#534AB7;text-align:right">${fmtDKK(expense.amount_dkk)}</td>
            </tr>
            ${origRow}${rateRow}${reportRow}${notesRow}
          </table>
        </td></tr>
        <tr><td style="background:#f5f4f0;padding:14px 32px;text-align:center;border-top:1px solid #eeecea">
          <p style="margin:0;font-size:12px;color:#9c9a92">Registreret via Kvitto · ${new Date().toLocaleString('da-DK')}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const text = [
    action,
    '',
    expense.description,
    `${fmtDate(expense.expense_date)} · ${CAT_LABELS[expense.category] || expense.category}`,
    '',
    `Beløb: ${fmtDKK(expense.amount_dkk)}`,
    expense.currency !== 'DKK' ? `Original: ${parseFloat(expense.amount).toLocaleString('da-DK')} ${expense.currency}` : null,
    expense.exchange_rate && expense.currency !== 'DKK' ? `Kurs: ${parseFloat(expense.exchange_rate).toFixed(4)}` : null,
    expense.report_name ? `Rapport: ${expense.report_name}` : null,
    expense.notes ? `Noter: ${expense.notes}` : null,
  ].filter(Boolean).join('\n');

  const mailOptions = {
    from, to,
    subject: `${isUpdate ? '✏️ Opdateret' : '🧾 Ny udgift'}: ${expense.description} – ${fmtDKK(expense.amount_dkk)}`,
    html, text,
  };

  // Vedhæft kvittering hvis den findes
  if (receiptPath && require('fs').existsSync(receiptPath)) {
    const ext  = require('path').extname(receiptPath).toLowerCase();
    const mime = { '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png',
                   '.webp':'image/webp', '.pdf':'application/pdf' };
    mailOptions.attachments = [{
      filename: `kvittering${ext}`,
      path: receiptPath,
      contentType: mime[ext] || 'application/octet-stream',
    }];
  }

  await getTransporter().sendMail(mailOptions);
}

module.exports = { sendInviteEmail, sendResetEmail, sendExpenseEmail, verifySmtp };
