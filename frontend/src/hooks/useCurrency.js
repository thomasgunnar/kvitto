// Kortlægning: land → valuta
// Baseret på navigator.language og Intl.DateTimeFormat timezone
const COUNTRY_CURRENCY = {
  DK: 'DKK', NO: 'NOK', SE: 'SEK', DE: 'EUR', FR: 'EUR',
  IT: 'EUR', ES: 'EUR', NL: 'EUR', BE: 'EUR', AT: 'EUR',
  FI: 'EUR', PT: 'EUR', IE: 'EUR', PL: 'PLN', CH: 'CHF',
  GB: 'GBP', US: 'USD', JP: 'JPY', AU: 'AUD', CA: 'CAD',
};

const TIMEZONE_COUNTRY = {
  'Europe/Copenhagen': 'DK',
  'Europe/Oslo': 'NO',
  'Europe/Stockholm': 'SE',
  'Europe/Berlin': 'DE',
  'Europe/Paris': 'FR',
  'Europe/Rome': 'IT',
  'Europe/Madrid': 'ES',
  'Europe/Amsterdam': 'NL',
  'Europe/Brussels': 'BE',
  'Europe/Vienna': 'AT',
  'Europe/Helsinki': 'FI',
  'Europe/Lisbon': 'PT',
  'Europe/Dublin': 'IE',
  'Europe/Warsaw': 'PL',
  'Europe/Zurich': 'CH',
  'Europe/London': 'GB',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'Asia/Tokyo': 'JP',
};

function detectCurrencyFromTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const country = TIMEZONE_COUNTRY[tz];
    if (country && COUNTRY_CURRENCY[country]) return COUNTRY_CURRENCY[country];
  } catch {}
  return null;
}

function detectCurrencyFromLanguage() {
  try {
    // navigator.language = 'da-DK', 'en-US' osv.
    const lang = navigator.language || '';
    const parts = lang.split('-');
    const country = parts[1]?.toUpperCase();
    if (country && COUNTRY_CURRENCY[country]) return COUNTRY_CURRENCY[country];

    // Fallback på primærsprog
    const primary = parts[0]?.toLowerCase();
    const langMap = { da: 'DKK', nb: 'NOK', sv: 'SEK', de: 'EUR', fr: 'EUR',
                      it: 'EUR', es: 'EUR', nl: 'EUR', pl: 'PLN', ja: 'JPY', en: 'USD' };
    if (langMap[primary]) return langMap[primary];
  } catch {}
  return null;
}

let _detectedCurrency = null;

export function getDefaultCurrency() {
  if (_detectedCurrency) return _detectedCurrency;

  // Brug gemt præference hvis den findes
  const saved = localStorage.getItem('kvitto_preferred_currency');
  if (saved) { _detectedCurrency = saved; return saved; }

  // Prøv timezone-baseret detektering (mest præcis)
  const fromTz = detectCurrencyFromTimezone();
  if (fromTz) { _detectedCurrency = fromTz; return fromTz; }

  // Prøv sprog-baseret
  const fromLang = detectCurrencyFromLanguage();
  if (fromLang) { _detectedCurrency = fromLang; return fromLang; }

  // Fallback: DKK
  return 'DKK';
}

export function setPreferredCurrency(currency) {
  localStorage.setItem('kvitto_preferred_currency', currency);
  _detectedCurrency = currency;
}
