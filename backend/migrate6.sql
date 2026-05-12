-- Migration 6: tilbagevendende udgifter
-- Kør: mysql -h <db-host> -u kvitto -p kvitto < migrate6.sql

CREATE TABLE IF NOT EXISTS recurring_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  description VARCHAR(300) NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) NOT NULL DEFAULT 'DKK',
  exchange_rate DECIMAL(16,6) DEFAULT NULL,
  category ENUM('travel','food','hotel','transport','other') NOT NULL DEFAULT 'other',
  report_id INT DEFAULT NULL,
  notes TEXT,
  interval_type ENUM('daily','weekly','monthly','yearly') NOT NULL DEFAULT 'monthly',
  interval_day TINYINT DEFAULT NULL,   -- dag i måneden (1-31) for monthly
  next_date DATE NOT NULL,             -- næste dato for oprettelse
  active TINYINT(1) NOT NULL DEFAULT 1,
  last_created_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE SET NULL
);

SELECT 'recurring_expenses tabel oprettet' AS status;
