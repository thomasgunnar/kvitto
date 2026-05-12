const { pool } = require('../db');

// action eksempler: 'create', 'update', 'delete', 'status_change', 'bulk_assign', 'export'
// entity_type: 'expense', 'report', 'recurring', 'user'

async function log(userId, action, entityType, entityId, entityName, details = null) {
  try {
    await pool.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, entity_name, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, action, entityType, entityId || null, entityName || null,
       details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    // Log fejler lydløst — må ikke blokere API-svaret
    console.warn('[ActivityLog] Fejl:', err.message);
  }
}

module.exports = { log };
