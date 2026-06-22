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

    // 9. Create projects table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT NOT NULL,
        name            TEXT NOT NULL,
        type            TEXT,
        scope           TEXT,
        deployment_target TEXT,
        status          TEXT,
        current_phase   TEXT,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ projects table checked.');

    // 10. Create project_intake table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_intake (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
        project_type    TEXT,
        project_name    TEXT,
        what            TEXT,
        target_user     TEXT,
        scope           TEXT,
        auth_required   BOOLEAN,
        database_required BOOLEAN,
        payments_required BOOLEAN,
        design_style    TEXT,
        deployment_target TEXT,
        reference_sites TEXT,
        mode_preference TEXT,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ project_intake table checked.');

    // 11. Create architecture_plans table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS architecture_plans (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
        summary         TEXT,
        assumptions     JSONB,
        tech_stack      JSONB,
        pages           JSONB,
        components      JSONB,
        api_routes      JSONB,
        database_schema JSONB,
        auth_flow       JSONB,
        payment_flow    JSONB,
        env_vars        JSONB,
        deployment_plan JSONB,
        risks           JSONB,
        approved        BOOLEAN DEFAULT false,
        approved_at     TIMESTAMP,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ architecture_plans table checked.');

    // 12. Create project_files table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_files (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
        path            TEXT NOT NULL,
        content         TEXT,
        language        TEXT,
        explanation     JSONB,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ project_files table checked.');

    // 13. Create qa_runs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS qa_runs (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
        status          TEXT,
        passed_count    INTEGER,
        warning_count   INTEGER,
        error_count     INTEGER,
        checks          JSONB,
        created_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ qa_runs table checked.');

    // 14. Create repair_requests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS repair_requests (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
        raw_error       TEXT,
        category        TEXT,
        likely_file     TEXT,
        simple_cause    TEXT,
        proposed_patch  JSONB,
        approved        BOOLEAN DEFAULT false,
        applied         BOOLEAN DEFAULT false,
        created_at      TIMESTAMP DEFAULT NOW(),
        approved_at     TIMESTAMP,
        applied_at      TIMESTAMP
      );
    `);
    console.log('[DATABASE] ✓ repair_requests table checked.');

    // 15. Create memories table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS memories (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT NOT NULL,
        project_id      UUID REFERENCES projects(id) ON DELETE CASCADE,
        text            TEXT NOT NULL,
        category        TEXT,
        importance      INTEGER DEFAULT 1,
        source          TEXT,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ memories table checked.');

    // 16. Create ai_vault_slots table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ai_vault_slots (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT NOT NULL,
        slot            INTEGER,
        provider        TEXT,
        encrypted_api_key TEXT,
        has_key         BOOLEAN,
        model           TEXT,
        purpose         TEXT,
        base_url        TEXT,
        enabled         BOOLEAN,
        created_at      TIMESTAMP DEFAULT NOW(),
        updated_at      TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('[DATABASE] ✓ ai_vault_slots table checked.');

    // 17. Create downloads table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS downloads (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id         TEXT NOT NULL,
        license_id      UUID,
        platform        TEXT,
        version         TEXT,
        file_key        TEXT,
        downloaded_at   TIMESTAMP DEFAULT NOW(),
        ip_address      TEXT
      );
    `);
    console.log('[DATABASE] ✓ downloads table checked.');

    console.log('[DATABASE] Database schema migration completed successfully.');
  } catch (err) {
    console.error('[DATABASE ERR] Migration failed:', err.message);
  }
}

module.exports = { initDatabase };
