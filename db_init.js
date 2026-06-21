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

    // 4. Create custom_modes table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS custom_modes (
        id              TEXT PRIMARY KEY,
        user_id         TEXT NOT NULL,
        name            TEXT NOT NULL,
        description     TEXT,
        color           TEXT DEFAULT '#00d4ff',
        capabilities    JSONB DEFAULT '[]'::jsonb,
        persona         TEXT,
        goals           TEXT,
        preferred_output TEXT,
        routing_priority TEXT DEFAULT 'Balanced',
        enabled         BOOLEAN DEFAULT true,
        source          TEXT DEFAULT 'custom',
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_custom_modes_user_id ON custom_modes(user_id);`);
    console.log('[DATABASE] ✓ custom_modes table checked.');

    // 5. Create mode_components table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mode_components (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        mode_id         TEXT NOT NULL REFERENCES custom_modes(id) ON DELETE CASCADE,
        component_type  TEXT NOT NULL,
        layout_zone     TEXT NOT NULL,
        position_index  INT DEFAULT 0,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_mode_components_mode_id ON mode_components(mode_id);`);
    console.log('[DATABASE] ✓ mode_components table checked.');

    // 6. Create mode_permissions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mode_permissions (
        mode_id         TEXT PRIMARY KEY REFERENCES custom_modes(id) ON DELETE CASCADE,
        file_system     BOOLEAN DEFAULT false,
        shell_execution BOOLEAN DEFAULT false,
        internet_access BOOLEAN DEFAULT true,
        cost_warnings   BOOLEAN DEFAULT true,
        screen_capture  BOOLEAN DEFAULT false,
        hardware_media  BOOLEAN DEFAULT false,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ mode_permissions table checked.');

    // 7. Create user_settings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_settings (
        user_id         TEXT PRIMARY KEY,
        theme_settings  JSONB DEFAULT '{}'::jsonb,
        voice_settings  JSONB DEFAULT '{}'::jsonb,
        agent_settings  JSONB DEFAULT '{}'::jsonb,
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ user_settings table checked.');

    // 8. Create weekly_briefings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS weekly_briefings (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT NOT NULL,
        job_id          TEXT NOT NULL,
        pdf_url         TEXT,
        audio_url       TEXT,
        summary         TEXT,
        status          TEXT DEFAULT 'running',
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_weekly_briefings_user_id ON weekly_briefings(user_id);`);
    console.log('[DATABASE] ✓ weekly_briefings table checked.');

    console.log('[DATABASE] Database schema migration completed successfully.');
  } catch (err) {
    console.error('[DATABASE ERR] Migration failed:', err.message);
  }
}

module.exports = { initDatabase };
