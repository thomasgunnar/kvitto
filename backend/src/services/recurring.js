const cron = require('node-cron');
const { pool } = require('../db');

// Beregn næste dato baseret på interval
function calcNextDate(currentDate, intervalType, intervalDay) {
  const d = new Date(currentDate);
  switch (intervalType) {
    case 'daily':
      d.setDate(d.getDate() + 1);
      break;
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      if (intervalDay) {
        const maxDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(intervalDay, maxDay));
      }
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
  }
  return d.toISOString().slice(0, 10);
}

async function processRecurringExpenses() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[Recurring] Tjekker tilbagevendende udgifter for ${today}...`);

  try {
    // Hent alle aktive tilbagevendende udgifter der skal oprettes i dag eller tidligere
    const [rows] = await pool.query(
      `SELECT r.*, cr.rate_to_dkk
       FROM recurring_expenses r
       LEFT JOIN currency_rates cr ON cr.currency = r.currency
       WHERE r.active = 1 AND r.next_date <= ?`,
      [today]
    );

    if (rows.length === 0) {
      console.log('[Recurring] Ingen udgifter at oprette i dag');
      return;
    }

    for (const rec of rows) {
      try {
        // Beregn DKK beløb
        const rate = rec.exchange_rate
          ? parseFloat(rec.exchange_rate)
          : rec.rate_to_dkk ? parseFloat(rec.rate_to_dkk) : 1;

        const amount_dkk = rec.currency === 'DKK'
          ? parseFloat(rec.amount)
          : Math.round(parseFloat(rec.amount) * rate * 100) / 100;

        // Opret udgift
        await pool.query(
          `INSERT INTO expenses
            (user_id, report_id, description, amount, currency, amount_dkk, exchange_rate,
             category, expense_date, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [rec.user_id, rec.report_id, rec.description, rec.amount,
           rec.currency, amount_dkk, rate === 1 && rec.currency === 'DKK' ? null : rate,
           rec.category, rec.next_date, rec.notes]
        );

        // Opdater next_date og last_created_at
        const nextDate = calcNextDate(rec.next_date, rec.interval_type, rec.interval_day);
        await pool.query(
          'UPDATE recurring_expenses SET next_date = ?, last_created_at = NOW() WHERE id = ?',
          [nextDate, rec.id]
        );

        console.log(`[Recurring] Oprettet: "${rec.description}" for bruger ${rec.user_id} (næste: ${nextDate})`);
      } catch (err) {
        console.error(`[Recurring] Fejl ved oprettelse af ID ${rec.id}:`, err.message);
      }
    }

    console.log(`[Recurring] Behandlet ${rows.length} tilbagevendende udgifter`);
  } catch (err) {
    console.error('[Recurring] Fejl:', err.message);
  }
}

function startRecurringCron() {
  // Kør dagligt kl. 06:00
  cron.schedule('0 6 * * *', processRecurringExpenses, {
    timezone: 'Europe/Copenhagen',
  });

  // Kør også ved opstart (i tilfælde af at serveren var nede)
  processRecurringExpenses();

  console.log('[Recurring] Cron job scheduleret — dagligt kl. 06:00');
}

module.exports = { startRecurringCron, processRecurringExpenses, calcNextDate };
