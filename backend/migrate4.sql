-- Migration 4: tilføj exchange_rate kolonne til udgifter
-- Kør: mysql -u root kvitto < migrate4.sql

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS exchange_rate DECIMAL(16,6) DEFAULT NULL
  AFTER amount_dkk;

-- Udfyld eksisterende rækker med beregnet kurs
UPDATE expenses
  SET exchange_rate = ROUND(amount_dkk / amount, 6)
  WHERE amount > 0 AND currency != 'DKK' AND exchange_rate IS NULL;

UPDATE expenses
  SET exchange_rate = 1.000000
  WHERE currency = 'DKK' AND exchange_rate IS NULL;

SELECT 'exchange_rate kolonne tilføjet' AS status;
