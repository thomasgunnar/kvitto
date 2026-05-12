const cron = require('node-cron');
const { pool } = require('../db');

const SUPPORTED = ['EUR', 'USD', 'GBP', 'NOK', 'SEK', 'CHF', 'JPY', 'PLN', 'DKK'];

async function fetchAndStoreCurrencyRates() {
  try {
    console.log('[Currency] Fetching latest rates from exchangerate.host...');

    // exchangerate.host/live returns rates relative to USD by default
    // We fetch with base USD, then convert to DKK via USD->DKK rate
    const url = `https://api.exchangerate.host/live?access_key=${process.env.CURRENCY_API_KEY || ''}&currencies=${SUPPORTED.join(',')}&source=USD&format=1`;
    const resp = await fetch(url);

    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();

    if (!data.quotes) throw new Error('Invalid API response structure');

    // rates are USDXXX format — get USD->DKK first
    const usdToDkk = data.quotes['USDDKK'];
    if (!usdToDkk) throw new Error('DKK rate missing from response');

    const updates = [];
    for (const currency of SUPPORTED) {
      if (currency === 'DKK') {
        updates.push([currency, 1.0]);
        continue;
      }
      const usdRate = data.quotes[`USD${currency}`];
      if (!usdRate) continue;
      // rate_to_dkk = DKK per 1 unit of currency = (USD/DKK) / (USD/currency)
      const rateToDkk = usdToDkk / usdRate;
      updates.push([currency, rateToDkk]);
    }

    for (const [currency, rate] of updates) {
      await pool.query(
        'INSERT INTO currency_rates (currency, rate_to_dkk) VALUES (?, ?) ON DUPLICATE KEY UPDATE rate_to_dkk = ?, fetched_at = NOW()',
        [currency, rate, rate]
      );
    }

    console.log(`[Currency] Updated ${updates.length} rates at ${new Date().toISOString()}`);
  } catch (err) {
    console.error('[Currency] Failed to fetch rates:', err.message);
    console.log('[Currency] Keeping existing cached rates');
  }
}

function startCurrencyCron() {
  // Run once at startup
  fetchAndStoreCurrencyRates();

  // Then every day at 07:00
  cron.schedule('0 7 * * *', fetchAndStoreCurrencyRates, {
    timezone: 'Europe/Copenhagen',
  });

  console.log('[Currency] Cron job scheduled — daily at 07:00 Copenhagen time');
}

module.exports = { startCurrencyCron, fetchAndStoreCurrencyRates };
