-- Migration 7: aktivitetslog + bulk-tilknytning endpoint
-- Kør: mysql -h <db-host> -u kvitto -p kvitto < migrate7.sql

CREATE TABLE IF NOT EXISTS activity_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  entity_type VARCHAR(30) NOT NULL,
  entity_id INT DEFAULT NULL,
  entity_name VARCHAR(300) DEFAULT NULL,
  details JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_created (user_id, created_at DESC)
);

SELECT 'activity_log tabel oprettet' AS status;
