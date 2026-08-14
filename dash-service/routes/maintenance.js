// Maintenance-mode switch for the main app (sptrener.online). Reads/writes
// app_settings.maintenance_mode in the main app's own Supabase project —
// sptrener.online's routes/maintenanceMode.js polls the same row (with a
// short cache) to decide whether to redirect every request to /unavalible.
const express = require('express');
const router = express.Router();
const { requireDashAuth } = require('../lib/auth');
const { supabase: mainDb } = require('../lib/db-main');

router.get('/api/dash/maintenance', requireDashAuth, async (req, res) => {
  const { data, error } = await mainDb.from('app_settings').select('value').eq('key', 'maintenance_mode').maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ enabled: data ? data.value === true : false });
});

router.post('/api/dash/maintenance', requireDashAuth, async (req, res) => {
  const enabled = !!(req.body && req.body.enabled);
  const { error } = await mainDb.from('app_settings').upsert(
    { key: 'maintenance_mode', value: enabled, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, enabled });
});

module.exports = router;
