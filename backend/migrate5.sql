-- Migration 5: email_notifications pr. bruger
-- Kør: mysql -h <db-host> -u kvitto -p kvitto < migrate5.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_notifications TINYINT(1) NOT NULL DEFAULT 1;

SELECT 'email_notifications kolonne tilføjet' AS status;

-- Tilføj reject_comment til rapporter
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS reject_comment TEXT DEFAULT NULL;
