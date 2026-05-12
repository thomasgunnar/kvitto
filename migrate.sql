-- Kør denne på din eksisterende database for at tilføje admin-funktionalitet
-- mysql -u root kvitto < migrate.sql

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_admin TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS must_change_password TINYINT(1) NOT NULL DEFAULT 0;

-- Gør den ældste bruger til admin
UPDATE users SET is_admin = 1 ORDER BY created_at ASC LIMIT 1;

SELECT id, name, email, is_admin FROM users;
