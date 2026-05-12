-- Migration 2: rapport-status + fjern udgifts-status
-- Kør: mysql -u root kvitto < migrate2.sql

-- Tilføj status til rapporter
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS status ENUM('active','submitted','approved') NOT NULL DEFAULT 'active';

-- Fjern status fra udgifter (udgifter er altid kladder)
ALTER TABLE expenses
  DROP COLUMN IF EXISTS status;

-- Verificer
SELECT 'reports' AS tabel, COUNT(*) AS antal FROM reports
UNION ALL
SELECT 'expenses', COUNT(*) FROM expenses;
