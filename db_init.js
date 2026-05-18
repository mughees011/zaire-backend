const pool = require('./db');

async function initDatabase() {
  console.log('[DATABASE] Starting database migration check...');
  try {
    // 1. Create subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT NOT NULL,
        email           TEXT NOT NULL,
        license_key     TEXT UNIQUE NOT NULL,
        plan            TEXT NOT NULL,
        status          TEXT NOT NULL,
        ls_sub_id       TEXT,
        ls_order_id     TEXT,
        activated_at    TIMESTAMP,
        current_period_end TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ subscriptions table checked.');

    // 2. Create machines table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS machines (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        license_key     TEXT NOT NULL,
        machine_id      TEXT NOT NULL,
        machine_name    TEXT,
        os_version      TEXT,
        first_seen      TIMESTAMP DEFAULT NOW(),
        last_seen       TIMESTAMP DEFAULT NOW(),
        is_active       BOOLEAN DEFAULT true,
        UNIQUE(license_key, machine_id)
      );
    `);
    console.log('[DATABASE] ✓ machines table checked.');

    // 3. Create user_vault table for AES-256 encrypted keys
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_vault (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT UNIQUE NOT NULL,
        groq_key        TEXT,
        openai_key      TEXT,
        gemini_key      TEXT,
        openrouter_key  TEXT,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ secure user_vault table checked.');
    console.log('[DATABASE] Database schema migration completed successfully.');
  } catch (err) {
    console.error('[DATABASE ERR] Migration failed:', err.message);
  }
}

module.exports = { initDatabase };
