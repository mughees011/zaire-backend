const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

const SUBSCRIPTIONS_FILE = path.join(__dirname, 'memory', 'subscriptions.json');

async function ensureDb() {
  if (!(await fs.pathExists(SUBSCRIPTIONS_FILE))) {
    await fs.writeJson(SUBSCRIPTIONS_FILE, []);
  }
}

function generateLicenseKey() {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    parts.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `ZAIRE-${parts.join('-')}`;
}

async function getSubscription(userId) {
  await ensureDb();
  const subs = await fs.readJson(SUBSCRIPTIONS_FILE);
  let sub = subs.find(s => s.user_id === userId);
  
  if (!sub) {
    // Automatically provision a new Free tier user on-the-fly!
    sub = {
      user_id: userId,
      email: userId.includes('@') ? userId : `${userId}@zaire.local`,
      license_key: generateLicenseKey(),
      plan: 'free',
      status: 'active',
      monthly_requests: 500,
      machines: []
    };
    subs.push(sub);
    await fs.writeJson(SUBSCRIPTIONS_FILE, subs);
    console.log(`[AUTOPROVISION] Registered new Free user: ${userId}`);
  }
  
  return sub;
}

async function getSubscriptionByLicenseKey(licenseKey) {
  await ensureDb();
  const subs = await fs.readJson(SUBSCRIPTIONS_FILE);
  return subs.find(s => s.license_key === licenseKey);
}

async function upsertSubscription(data) {
  await ensureDb();
  const subs = await fs.readJson(SUBSCRIPTIONS_FILE);
  const index = subs.findIndex(s => s.user_id === data.user_id);

  if (index >= 0) {
    // If the record exists, preserve license_key and machines if not explicitly provided
    const existing = subs[index];
    subs[index] = {
      ...existing,
      ...data,
      license_key: existing.license_key || data.license_key || generateLicenseKey(),
      machines: existing.machines || data.machines || []
    };
  } else {
    // If new record, generate a fresh license key and initialize empty machines list
    subs.push({
      machines: [],
      license_key: data.license_key || generateLicenseKey(),
      ...data
    });
  }
  await fs.writeJson(SUBSCRIPTIONS_FILE, subs);
}

async function addMachine(licenseKey, machine) {
  await ensureDb();
  const subs = await fs.readJson(SUBSCRIPTIONS_FILE);
  const index = subs.findIndex(s => s.license_key === licenseKey);
  if (index < 0) return false;

  const sub = subs[index];
  if (!sub.machines) sub.machines = [];

  const existingIndex = sub.machines.findIndex(m => m.machine_id === machine.machine_id);
  if (existingIndex >= 0) {
    // Update existing machine timestamp and activity
    sub.machines[existingIndex] = {
      ...sub.machines[existingIndex],
      ...machine,
      last_seen: new Date().toISOString(),
      is_active: true
    };
  } else {
    // Register new machine
    sub.machines.push({
      ...machine,
      first_seen: new Date().toISOString(),
      last_seen: new Date().toISOString(),
      is_active: true
    });
  }

  await fs.writeJson(SUBSCRIPTIONS_FILE, subs);
  return true;
}

async function deactivateMachine(licenseKey, machineId) {
  await ensureDb();
  const subs = await fs.readJson(SUBSCRIPTIONS_FILE);
  const index = subs.findIndex(s => s.license_key === licenseKey);
  if (index < 0) return false;

  const sub = subs[index];
  if (!sub.machines) return false;

  const machineIndex = sub.machines.findIndex(m => m.machine_id === machineId);
  if (machineIndex >= 0) {
    sub.machines[machineIndex].is_active = false;
    sub.machines[machineIndex].deactivated_at = new Date().toISOString();
    await fs.writeJson(SUBSCRIPTIONS_FILE, subs);
    return true;
  }

  return false;
}

module.exports = {
  getSubscription,
  getSubscriptionByLicenseKey,
  upsertSubscription,
  addMachine,
  deactivateMachine,
  generateLicenseKey
};