const express = require('express');
const { requireAuth } = require('../auth_middleware');
const pool = require('../db');

const router = express.Router();
const HIDDEN_MODE_META_PREFIX = '\n[ZAIRE_MODE_META]';

const packModeDescription = (description, metadata = {}) => {
  const cleanDescription = String(description || '').replace(/\n\[ZAIRE_MODE_META\][A-Za-z0-9+/=]+$/u, '').trim();
  const cleanMeta = Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  if (Object.keys(cleanMeta).length === 0) {
    return cleanDescription;
  }
  const encodedMeta = Buffer.from(JSON.stringify(cleanMeta), 'utf8').toString('base64');
  return `${cleanDescription}${HIDDEN_MODE_META_PREFIX}${encodedMeta}`;
};

const unpackModeDescription = (rawDescription) => {
  const text = String(rawDescription || '');
  const markerIndex = text.lastIndexOf(HIDDEN_MODE_META_PREFIX);
  if (markerIndex === -1) {
    return { description: text, metadata: {} };
  }

  const description = text.slice(0, markerIndex).trim();
  const encodedMeta = text.slice(markerIndex + HIDDEN_MODE_META_PREFIX.length).trim();

  try {
    const metadata = JSON.parse(Buffer.from(encodedMeta, 'base64').toString('utf8'));
    return { description, metadata: metadata && typeof metadata === 'object' ? metadata : {} };
  } catch (err) {
    console.warn('[CUSTOM MODES META WARN] Failed to parse embedded metadata:', err.message);
    return { description: text, metadata: {} };
  }
};

/**
 * GET /api/custom_modes
 * Fetch all custom modes for the authenticated user, including their components and permissions.
 */
router.get('/custom_modes', requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const modesRes = await pool.query('SELECT * FROM custom_modes WHERE user_id = $1 ORDER BY created_at DESC', [userId]);
    const modes = modesRes.rows;

    const fullModes = await Promise.all(modes.map(async (mode) => {
      const componentsRes = await pool.query(
        'SELECT component_type, layout_zone, position_index FROM mode_components WHERE mode_id = $1 ORDER BY position_index ASC',
        [mode.id]
      );
      const permissionsRes = await pool.query('SELECT * FROM mode_permissions WHERE mode_id = $1', [mode.id]);
      const { description, metadata } = unpackModeDescription(mode.description);

      return {
        id: mode.id,
        name: mode.name,
        desc: description,
        color: mode.color,
        capabilities: mode.capabilities || [],
        persona: mode.persona,
        goals: mode.goals,
        neverDo: metadata.neverDo || '',
        expertBlueprint: metadata.expertBlueprint || null,
        preferredOutput: mode.preferred_output,
        routingPriority: mode.routing_priority,
        enabled: mode.enabled,
        source: mode.source,
        components: componentsRes.rows.map(c => ({
          type: c.component_type,
          zone: c.layout_zone,
          index: c.position_index
        })),
        permissions: permissionsRes.rows[0] ? {
          fileSystem: permissionsRes.rows[0].file_system,
          shellExecution: permissionsRes.rows[0].shell_execution,
          internetAccess: permissionsRes.rows[0].internet_access,
          costWarnings: permissionsRes.rows[0].cost_warnings,
          screenCapture: permissionsRes.rows[0].screen_capture,
          hardwareMedia: permissionsRes.rows[0].hardware_media
        } : {
          fileSystem: false,
          shellExecution: false,
          internetAccess: true,
          costWarnings: true,
          screenCapture: false,
          hardwareMedia: false
        }
      };
    }));

    res.json({ success: true, modes: fullModes });
  } catch (err) {
    console.error('[CUSTOM MODES GET ERR]', err);
    res.status(500).json({ error: 'Failed to retrieve custom modes' });
  }
});

/**
 * POST /api/custom_modes
 * Save (create or overwrite) a custom mode.
 */
router.post('/custom_modes', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const {
    id,
    name,
    desc,
    color,
    capabilities,
    persona,
    goals,
    neverDo,
    expertBlueprint,
    preferredOutput,
    routingPriority,
    enabled,
    source,
    components,
    permissions
  } = req.body;

  if (!id || !name) {
    return res.status(400).json({ error: 'ID and Name are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const packedDescription = packModeDescription(desc, { neverDo, expertBlueprint });

    // 1. Insert/Update custom_modes
    await client.query(`
      INSERT INTO custom_modes (
        id, user_id, name, description, color, capabilities, persona, goals, preferred_output, routing_priority, enabled, source, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        color = EXCLUDED.color,
        capabilities = EXCLUDED.capabilities,
        persona = EXCLUDED.persona,
        goals = EXCLUDED.goals,
        preferred_output = EXCLUDED.preferred_output,
        routing_priority = EXCLUDED.routing_priority,
        enabled = EXCLUDED.enabled,
        source = EXCLUDED.source,
        updated_at = NOW()
    `, [
      id,
      userId,
      name,
      packedDescription,
      color || '#00d4ff',
      JSON.stringify(capabilities || []),
      persona,
      goals,
      preferredOutput,
      routingPriority || 'Balanced',
      enabled !== undefined ? enabled : true,
      source || 'custom'
    ]);

    // 2. Clear old components
    await client.query('DELETE FROM mode_components WHERE mode_id = $1', [id]);

    // 3. Insert new components
    if (Array.isArray(components)) {
      for (let idx = 0; idx < components.length; idx++) {
        const comp = components[idx];
        await client.query(`
          INSERT INTO mode_components (mode_id, component_type, layout_zone, position_index)
          VALUES ($1, $2, $3, $4)
        `, [id, comp.type, comp.zone, comp.index !== undefined ? comp.index : idx]);
      }
    }

    // 4. Upsert permissions
    const perm = permissions || {};
    await client.query(`
      INSERT INTO mode_permissions (
        mode_id, file_system, shell_execution, internet_access, cost_warnings, screen_capture, hardware_media, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (mode_id) DO UPDATE SET
        file_system = EXCLUDED.file_system,
        shell_execution = EXCLUDED.shell_execution,
        internet_access = EXCLUDED.internet_access,
        cost_warnings = EXCLUDED.cost_warnings,
        screen_capture = EXCLUDED.screen_capture,
        hardware_media = EXCLUDED.hardware_media,
        updated_at = NOW()
    `, [
      id,
      perm.fileSystem || false,
      perm.shellExecution || false,
      perm.internetAccess !== undefined ? perm.internetAccess : true,
      perm.costWarnings !== undefined ? perm.costWarnings : true,
      perm.screenCapture || false,
      perm.hardwareMedia || false
    ]);

    await client.query('COMMIT');
    res.json({ success: true, message: 'Custom mode saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CUSTOM MODES SAVE ERR]', err);
    res.status(500).json({ error: 'Failed to save custom mode' });
  } finally {
    client.release();
  }
});

/**
 * PUT /api/custom_modes/:id
 * Partially updates an existing custom mode.
 */
router.put('/custom_modes/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const modeId = req.params.id;
  let ownerCheck;
  const {
    enabled,
    name,
    desc,
    color,
    capabilities,
    persona,
    goals,
    neverDo,
    expertBlueprint,
    preferredOutput,
    routingPriority,
    components,
    permissions
  } = req.body;

  try {
    ownerCheck = await pool.query('SELECT user_id, description FROM custom_modes WHERE id = $1', [modeId]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mode not found' });
    }
    if (ownerCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to modify this mode' });
    }
  } catch (err) {
    console.error('[CUSTOM MODES OWNER CHECK ERR]', err);
    return res.status(500).json({ error: 'Database error' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const existingMode = ownerCheck.rows[0];
    const currentDescState = unpackModeDescription(existingMode.description);
    const nextDescription = desc !== undefined ? desc : currentDescState.description;
    const nextMeta = {
      ...currentDescState.metadata,
      ...(neverDo !== undefined ? { neverDo } : {}),
      ...(expertBlueprint !== undefined ? { expertBlueprint } : {})
    };

    const sets = [];
    const vals = [];
    let valIdx = 1;

    if (enabled !== undefined) { sets.push(`enabled = $${valIdx++}`); vals.push(enabled); }
    if (name !== undefined) { sets.push(`name = $${valIdx++}`); vals.push(name); }
    if (desc !== undefined || neverDo !== undefined || expertBlueprint !== undefined) {
      sets.push(`description = $${valIdx++}`);
      vals.push(packModeDescription(nextDescription, nextMeta));
    }
    if (color !== undefined) { sets.push(`color = $${valIdx++}`); vals.push(color); }
    if (capabilities !== undefined) { sets.push(`capabilities = $${valIdx++}`); vals.push(JSON.stringify(capabilities)); }
    if (persona !== undefined) { sets.push(`persona = $${valIdx++}`); vals.push(persona); }
    if (goals !== undefined) { sets.push(`goals = $${valIdx++}`); vals.push(goals); }
    if (preferredOutput !== undefined) { sets.push(`preferred_output = $${valIdx++}`); vals.push(preferredOutput); }
    if (routingPriority !== undefined) { sets.push(`routing_priority = $${valIdx++}`); vals.push(routingPriority); }

    if (sets.length > 0) {
      vals.push(modeId);
      await client.query(`
        UPDATE custom_modes
        SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${valIdx}
      `, vals);
    }

    if (components !== undefined) {
      await client.query('DELETE FROM mode_components WHERE mode_id = $1', [modeId]);
      if (Array.isArray(components)) {
        for (let idx = 0; idx < components.length; idx++) {
          const comp = components[idx];
          await client.query(`
            INSERT INTO mode_components (mode_id, component_type, layout_zone, position_index)
            VALUES ($1, $2, $3, $4)
          `, [modeId, comp.type, comp.zone, comp.index !== undefined ? comp.index : idx]);
        }
      }
    }

    if (permissions !== undefined) {
      const perm = permissions || {};
      const permSets = [];
      const permVals = [];
      let permIdx = 1;

      if (perm.fileSystem !== undefined) { permSets.push(`file_system = $${permIdx++}`); permVals.push(perm.fileSystem); }
      if (perm.shellExecution !== undefined) { permSets.push(`shell_execution = $${permIdx++}`); permVals.push(perm.shellExecution); }
      if (perm.internetAccess !== undefined) { permSets.push(`internet_access = $${permIdx++}`); permVals.push(perm.internetAccess); }
      if (perm.costWarnings !== undefined) { permSets.push(`cost_warnings = $${permIdx++}`); permVals.push(perm.costWarnings); }
      if (perm.screenCapture !== undefined) { permSets.push(`screen_capture = $${permIdx++}`); permVals.push(perm.screenCapture); }
      if (perm.hardwareMedia !== undefined) { permSets.push(`hardware_media = $${permIdx++}`); permVals.push(perm.hardwareMedia); }

      if (permSets.length > 0) {
        permVals.push(modeId);
        await client.query(`
          UPDATE mode_permissions
          SET ${permSets.join(', ')}, updated_at = NOW()
          WHERE mode_id = $${permIdx}
        `, permVals);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Custom mode updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CUSTOM MODES UPDATE ERR]', err);
    res.status(500).json({ error: 'Failed to update custom mode' });
  } finally {
    client.release();
  }
});

/**
 * DELETE /api/custom_modes/:id
 * Delete a custom mode.
 */
router.delete('/custom_modes/:id', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const modeId = req.params.id;

  try {
    const ownerCheck = await pool.query('SELECT user_id FROM custom_modes WHERE id = $1', [modeId]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Mode not found' });
    }
    if (ownerCheck.rows[0].user_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized to delete this mode' });
    }

    await pool.query('DELETE FROM custom_modes WHERE id = $1', [modeId]);
    res.json({ success: true, message: 'Custom mode deleted' });
  } catch (err) {
    console.error('[CUSTOM MODES DELETE ERR]', err);
    res.status(500).json({ error: 'Failed to delete custom mode' });
  }
});

/**
 * POST /api/custom_modes/:id/duplicate
 * Duplicate a custom mode.
 */
router.post('/custom_modes/:id/duplicate', requireAuth, async (req, res) => {
  const userId = req.user.id;
  const srcModeId = req.params.id;
  const newModeId = `${srcModeId.replace(/-[0-9]+$/, '')}-copy-${Date.now()}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch original
    const modeRes = await client.query('SELECT * FROM custom_modes WHERE id = $1 AND user_id = $2', [srcModeId, userId]);
    if (modeRes.rows.length === 0) {
      return res.status(404).json({ error: 'Source mode not found' });
    }
    const srcMode = modeRes.rows[0];

    // Insert duplicate
    await client.query(`
      INSERT INTO custom_modes (
        id, user_id, name, description, color, capabilities, persona, goals, preferred_output, routing_priority, enabled, source, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
    `, [
      newModeId,
      userId,
      `${srcMode.name} COPY`,
      srcMode.description,
      srcMode.color,
      srcMode.capabilities,
      srcMode.persona,
      srcMode.goals,
      srcMode.preferred_output,
      srcMode.routing_priority,
      srcMode.enabled,
      srcMode.source
    ]);

    // Copy components
    const compRes = await client.query('SELECT * FROM mode_components WHERE mode_id = $1', [srcModeId]);
    for (const comp of compRes.rows) {
      await client.query(`
        INSERT INTO mode_components (mode_id, component_type, layout_zone, position_index)
        VALUES ($1, $2, $3, $4)
      `, [newModeId, comp.component_type, comp.layout_zone, comp.position_index]);
    }

    // Copy permissions
    const permRes = await client.query('SELECT * FROM mode_permissions WHERE mode_id = $1', [srcModeId]);
    if (permRes.rows.length > 0) {
      const p = permRes.rows[0];
      await client.query(`
        INSERT INTO mode_permissions (
          mode_id, file_system, shell_execution, internet_access, cost_warnings, screen_capture, hardware_media, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `, [newModeId, p.file_system, p.shell_execution, p.internet_access, p.cost_warnings, p.screen_capture, p.hardware_media]);
    }

    await client.query('COMMIT');
    res.json({ success: true, id: newModeId, message: 'Custom mode duplicated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[CUSTOM MODES DUPLICATE ERR]', err);
    res.status(500).json({ error: 'Failed to duplicate custom mode' });
  } finally {
    client.release();
  }
});

module.exports = router;
