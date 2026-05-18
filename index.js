const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
process.env.TZ = 'Asia/Karachi';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const Groq = require('groq-sdk');
const { spawn, exec, execFileSync } = require('child_process');
const fs = require('fs');
const multer = require('multer');
const fsExtra = require('fs-extra');

// Global Error Handlers for Stability
process.on('uncaughtException', (err) => console.error('[FATAL] Uncaught Exception:', err));
process.on('unhandledRejection', (reason) => console.error('[FATAL] Unhandled Rejection:', reason));

// Initial dependencies
let ProactiveService;
let globalProactive = null;
try {
  ProactiveService = require('./proactive_service');
} catch (e) {
  console.error("Critical error loading ProactiveService:", e.message);
}

const { google } = require('googleapis');
const { analyzeScreen } = require('./vision_service');

// ─── Global Error Handling (Catch everything early) ──────────────────────────
process.on('uncaughtException', (err) => {
  console.error('\n[FATAL] Uncaught Exception:', err.message);
  console.error(err.stack);
  if (typeof cleanupAndExit === 'function') cleanupAndExit(1);
  else process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('\n[FATAL] Unhandled Rejection at:', promise, 'reason:', reason);
  if (typeof cleanupAndExit === 'function') cleanupAndExit(1);
  else process.exit(1);
});

// Briefing Cooldown (4 hours)
const BRIEFING_MEMORY_PATH = path.join(__dirname, 'memory', 'briefing_state.json');
var lastBriefingTime = 0;
try {
  if (fs.existsSync(BRIEFING_MEMORY_PATH)) {
    lastBriefingTime = JSON.parse(fs.readFileSync(BRIEFING_MEMORY_PATH)).lastBriefingTime || 0;
    console.log(`[BRIEFING] Restored last briefing time: ${new Date(lastBriefingTime).toLocaleString()}`);
  }
} catch (e) {
  console.error('[BRIEFING] Failed to restore state:', e.message);
}

function saveBriefingState(time) {
  try {
    lastBriefingTime = time;
    fs.writeFileSync(BRIEFING_MEMORY_PATH, JSON.stringify({ lastBriefingTime: time }));
  } catch (e) {
    console.error('[BRIEFING] Failed to save state:', e.message);
  }
}

const BRIEFING_COOLDOWN = 4 * 60 * 60 * 1000;

// ─── Express + Socket.io Setup with Security Enhancements ─────────────────────
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();

// Helmet security headers (Tailored for ZAIRE WebApp environment compatibility)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS Setup - restrict origins in production
app.use(cors({
  origin: [
    'https://zaire.ai',
    'https://www.zaire.ai',
    'http://localhost:3000'
  ].filter(Boolean),
  credentials: true
}));

// Global capture for rawBody to support cryptographic webhook validations
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

// Express Rate Limiters to prevent brute-force attacks and abuse
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000,                // 1000 requests per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Try again later.' }
});

const licenseLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,             // 30 validation attempts per minute
  message: { error: 'Too many validation requests.' }
});

app.use('/billing/checkout', globalLimiter);
app.use(['/api/license/validate', '/license/validate'], licenseLimiter);
const lemonWebhook = require('./routes/lemonsqueezy_webhook');
app.use('/api', lemonWebhook);

app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'ZAIRE backend'
  });
});

// ─── LemonSqueezy Billing Integration ──────────────────────────────────────────
const billingService = require('./billing_service');
const subscriptionService = require('./subscription_service');
const crypto = require('crypto');

// Timing-safe HMAC signature verification for LemonSqueezy webhook security
function verifyLemonSqueezyWebhook(req, res, next) {
  const signature = req.headers['x-signature'];
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (!signature) {
    console.warn('[WEBHOOK] Missing signature header');
    return res.status(401).json({ error: 'Unauthorized: Missing signature' });
  }

  if (!secret) {
    console.warn('[WEBHOOK] LEMONSQUEEZY_WEBHOOK_SECRET not defined in .env - bypassing verification');
    return next();
  }

  try {
    const rawBody = req.rawBody ? req.rawBody.toString('utf-8') : JSON.stringify(req.body);
    const hmac = crypto.createHmac('sha256', secret);
    const digest = hmac.update(rawBody).digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(digest, 'hex')
    );

    if (!isValid) {
      console.warn('[WEBHOOK] Invalid signature — possible attack attempt');
      return res.status(401).json({ error: 'Invalid signature' });
    }
  } catch (err) {
    console.error('[WEBHOOK] Signature check error:', err.message);
    return res.status(500).json({ error: 'Verification failed' });
  }

  next();
}

app.post('/billing/checkout', async (req, res) => {
  try {
    const { userId, userEmail } = req.body;
    if (!userId || !userEmail) {
      return res.status(400).json({ error: "Missing userId or userEmail" });
    }
    const checkoutUrl = await billingService.generateProCheckout(userId, userEmail);
    res.json({ checkoutUrl });
  } catch (error) {
    console.error("Billing Route Error:", error);
    res.status(500).json({ error: "Failed to create checkout" });
  }
});

app.post('/billing/webhook', verifyLemonSqueezyWebhook, async (req, res) => {
  try {
    const event = req.body;

    if (event.meta && event.meta.event_name) {
      const eventName = event.meta.event_name;
      const customData = event.meta.custom_data || {};
      const attributes = event.data.attributes;

      if (['subscription_created', 'subscription_updated', 'subscription_activated'].includes(eventName)) {
        const userId = customData.user_id; // passed in checkout
        if (userId) {
          await subscriptionService.upsertSubscription({
            user_id: userId,
            email: attributes.user_email,
            plan: 'pro',
            status: attributes.status,
            lemonsqueezy_subscription_id: event.data.id,
            current_period_end: attributes.renews_at
          });
          console.log(`[BILLING] Upgraded user ${userId} to PRO.`);
        }
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    console.error("[BILLING WEBHOOK ERR]:", err);
    res.status(500).send('Webhook Error');
  }
});

// Endpoint to check subscription status
app.get('/billing/status/:userId', async (req, res) => {
  try {
    const sub = await subscriptionService.getSubscription(req.params.userId);
    res.json({ plan: sub && sub.status === 'active' ? 'pro' : 'free', details: sub });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

// Helper for license plan features mapping
function getFeaturesForPlan(plan) {
  const base = { voice: true, zaire_mode: true };
  const planLower = (plan || '').toLowerCase();
  if (planLower === 'free_trial' || planLower === 'free') {
    return { ...base, daily_limit: 50 };
  }
  return {
    ...base,
    daily_limit: -1, // unlimited
    trader_mode: true,
    professor_mode: true,
    engineer_mode: true,
    swarm_mode: true,
    custom_modes: true,
    priority_support: true
  };
}

// ─── ZAIRE Sovereign Licensing & Activation API Endpoints ──────────────────
app.post(['/api/license/validate', '/license/validate'], async (req, res) => {
  const { license_key, machine_id, machine_name, os_version } = req.body;

  if (!license_key || !machine_id) {
    return res.status(400).json({ valid: false, error: 'MISSING_PARAMS' });
  }

  try {
    const subscription = await subscriptionService.getSubscriptionByLicenseKey(license_key);

    if (!subscription) {
      return res.json({ valid: false, error: 'INVALID_KEY' });
    }

    const status = (subscription.status || '').toLowerCase();
    if (status !== 'active' && status !== 'subscription_active' && status !== 'pro') {
      return res.json({
        valid: false,
        error: 'SUBSCRIPTION_INACTIVE',
        status: subscription.status
      });
    }

    if (subscription.current_period_end && new Date() > new Date(subscription.current_period_end)) {
      subscription.status = 'expired';
      await subscriptionService.upsertSubscription(subscription);
      return res.json({ valid: false, error: 'SUBSCRIPTION_EXPIRED' });
    }

    const plan = (subscription.plan || '').toLowerCase();
    const machineLimit = plan.includes('annual') ? 3
      : plan.includes('pro') ? 2 : 1;

    const activeMachines = (subscription.machines || []).filter(m => m.is_active);
    const existingMachine = activeMachines.find(m => m.machine_id === machine_id);

    if (!existingMachine) {
      if (activeMachines.length >= machineLimit) {
        return res.json({
          valid: false,
          error: 'MACHINE_LIMIT_REACHED',
          limit: machineLimit,
          message: `Your plan allows ${machineLimit} device(s). Deactivate an old device to continue.`
        });
      }

      await subscriptionService.addMachine(license_key, {
        machine_id,
        machine_name: machine_name || 'Windows Host',
        os_version: os_version || 'Windows 11'
      });
    } else {
      await subscriptionService.addMachine(license_key, {
        machine_id,
        machine_name: machine_name || existingMachine.machine_name,
        os_version: os_version || existingMachine.os_version
      });
    }

    const updatedSub = await subscriptionService.getSubscriptionByLicenseKey(license_key);

    return res.json({
      valid: true,
      user_email: updatedSub.email,
      plan: updatedSub.plan,
      expiry: updatedSub.current_period_end,
      license_key: updatedSub.license_key,
      features: getFeaturesForPlan(updatedSub.plan)
    });

  } catch (err) {
    console.error('[LICENSE] Validation error:', err);
    return res.status(500).json({ valid: false, error: 'SERVER_ERROR' });
  }
});

app.post(['/api/license/deactivate', '/license/deactivate'], async (req, res) => {
  const { license_key, machine_id } = req.body;
  if (!license_key || !machine_id) {
    return res.status(400).json({ success: false, error: 'MISSING_PARAMS' });
  }
  try {
    const ok = await subscriptionService.deactivateMachine(license_key, machine_id);
    if (ok) {
      return res.json({ success: true, message: 'Device deactivated successfully.' });
    }
    return res.status(404).json({ success: false, error: 'Device or license not found.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});

// Signed installer downloads to authorize downloads only for active keys
app.get(['/api/license/download', '/license/download'], async (req, res) => {
  const { key } = req.query;
  if (!key) {
    return res.status(400).send('License key required');
  }

  try {
    const sub = await subscriptionService.getSubscriptionByLicenseKey(key);
    if (!sub || (sub.status !== 'active' && sub.status !== 'pro')) {
      return res.status(403).send('Invalid or inactive license key');
    }

    const token = crypto
      .createHmac('sha256', process.env.DOWNLOAD_SECRET || 'ZAIRE_DOWNLOAD_SECURE')
      .update(`${key}:${Math.floor(Date.now() / 86400000)}`)
      .digest('hex');

    // Redirect or serve directly
    const localSetupFile = path.join(__dirname, '..', 'ZAIRE_Setup.exe');
    if (fs.existsSync(localSetupFile)) {
      return res.download(localSetupFile, 'ZAIRE_Setup.exe');
    }

    res.redirect(`https://cdn.zaire.ai/installer/ZAIRE_Setup.exe?token=${token}&key=${key}`);
  } catch (err) {
    res.status(500).send('Download handler error');
  }
});

// ─── Project Artifact Upload Config ──────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Determine target directory (supporting folder structures)
    const relativePath = req.body.relativePath || "";
    const targetDir = path.join(__dirname, 'uploads', relativePath);
    fsExtra.ensureDirSync(targetDir);
    cb(null, targetDir);
  },
  filename: (req, file, cb) => {
    // Keep original filename but avoid collisions if needed
    // For now, preservation of original naming for context consistency
    cb(null, file.originalname);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 500 * 1024 * 1024 } // 500MB tactical limit
});

// Artifact Cleanup Routine (1 hour retention)
setInterval(() => {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const now = Date.now();
    const files = fs.readdirSync(uploadsDir);
    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      const stats = fs.statSync(filePath);
      if (now - stats.mtimeMs > 3600000) { // 1 hour
        fsExtra.removeSync(filePath);
        console.log(`[CLEANUP] Purged expired artifact: ${file}`);
      }
    });
  }
}, 300000); // Check every 5 mins

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ["GET", "POST"],
    credentials: true
  },
  maxHttpBufferSize: 1e7,
  transports: ['websocket', 'polling'],
  allowUpgrades: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// ─── Google OAuth Setup ──────────────────────────────────────────────────────
const CREDENTIALS_PATH = path.join(__dirname, 'client_secret.json');
const TOKEN_PATH = path.join(__dirname, 'memory', 'google_tokens.json');

let oAuth2Client = null;

try {
  if (fs.existsSync(CREDENTIALS_PATH)) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.web;
    oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Load existing tokens if they exist
    if (fs.existsSync(TOKEN_PATH)) {
      const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH));
      oAuth2Client.setCredentials(tokens);
      console.log('[GOOGLE] Existing tokens loaded and client ready.');
    }
  } else {
    console.warn('[GOOGLE] client_secret.json not found. OAuth will be disabled until configured.');
  }
} catch (err) {
  console.error('[GOOGLE] Error initializing auth client:', err.message);
}

// 1. The Route that starts the login
app.get('/auth/google', (req, res) => {
  if (!oAuth2Client) return res.status(500).send('Google client not configured.');

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
  });
  res.redirect(authUrl);
});

// 2. The Callback Route (where Google sends you back)
app.get('/auth/google/callback', async (req, res) => {
  const { code } = req.query;
  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    // Save the tokens for next time
    if (!fs.existsSync(path.dirname(TOKEN_PATH))) {
      fs.mkdirSync(path.dirname(TOKEN_PATH), { recursive: true });
    }
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

    res.send(`
      <div style="font-family: sans-serif; text-align: center; padding-top: 50px; background: #0a0a0a; color: #00f2ff; height: 100vh;">
        <h1 style="text-shadow: 0 0 10px #00f2ff;">Authentication Successful</h1>
        <p>ZAIRE is now linked to your data core.</p>
        <p>You can close this tab and return to the HUD.</p>
      </div>
    `);
  } catch (error) {
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

// ─── Vision Presence Endpoint ────────────────────────────────────────────────
const GREETING_COOLDOWN = 15 * 60 * 1000; // 15 minutes (reduced from 1h)
const AWAY_THRESHOLD = 30 * 1000; // 30 seconds for "Welcome back"
let lastGreetingTime = 0;
let isUserPresent = false;
let lastBriefingDate = null; // Track last briefing date (YYYY-MM-DD)
let lastSeenTime = Date.now();
let flickerCount = 0;
let lastFlickerTime = 0;

function triggerDailyBriefing(socket) {
  if (isBriefingInProgress) return;
  isBriefingInProgress = true;

  const now = Date.now();
  saveBriefingState(now);
  console.log('[BRIEFING] Initiating Stark Proactive Greeting...');
  if (socket) socket.emit('neural_log', { content: "System: Initiating daily briefing sequence." });

  const briefingProc = spawn('python', [path.join(__dirname, 'daily_briefing.py')], {
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  let briefingText = "";
  briefingProc.stdout.on('data', (data) => {
    briefingText += data.toString();
  });

  briefingProc.on('close', () => {
    isBriefingInProgress = false;
    if (briefingText.trim()) {
      const text = briefingText.trim();
      if (socket) {
        socket.emit('diagnostic_alert', true);
        socket.emit('ai_text_delta', text);
      }

      requestTTS(text).then(audioRes => {
        if (audioRes.audio && socket) {
          socket.emit('audio_chunk', { index: 0, audio: audioRes.audio, isBase64: false });
        }
        setTimeout(() => {
          if (socket) {
            socket.emit('diagnostic_alert', false);
            socket.emit('ai_text_complete', { fullText: text });
          }
        }, 15000);
      }).catch(err => console.error('[TTS ERR] Briefing audio failed:', err.message));
    }
  });
}

app.post('/presence', async (req, res) => {
  try {
    const { status, user } = req.body;
    const now = Date.now();

    const MASTER_GREETINGS = [
      "Welcome back, sir.",
      "Good to see you, Mughees.",
      "Ah, the Master returns. How can I be of service?",
      "Hey Mughees, I've kept the seat warm for you.",
      "Always a pleasure to see you, sir."
    ];

    // Find the most active socket for broadcasting (safely)
    const sockets = Array.from(io.sockets.sockets.values());
    const socket = sockets.length > 0 ? sockets[0] : null;

    if (status === 'absent') {
      if (isUserPresent) {
        console.log(`[PRESENCE] User departed.`);
        isUserPresent = false;
        lastSeenTime = now;
        if (socket) socket.emit('neural_log', { content: "System: Human presence lost. Standing by." });
      }
      return res.sendStatus(200);
    }

    if (status === 'detected') {
      const isMaster = (user === 'Master' || user === 'Mughees');

      if (isMaster) {
        const awayDuration = now - lastSeenTime;
        const needsBriefing = (now - lastBriefingTime > BRIEFING_COOLDOWN);
        const shouldWelcomeBack = (!isUserPresent && awayDuration > AWAY_THRESHOLD && !needsBriefing);

        // --- Flicker Detection Logic ---
        if (!isUserPresent) {
          if (now - lastFlickerTime < 60000) { // If return happens within 1 min of last flicker
            flickerCount++;
          } else {
            flickerCount = 1;
          }
          lastFlickerTime = now;

          if (flickerCount >= 3 && now - lastGreetingTime > 30000) {
            const flickerWarning = "Sir, I'm having a bit of trouble maintaining a lock on your biometric signature. Please ensure the lighting is adequate.";
            if (socket) {
              lastGreetingTime = now;
              io.emit('neural_interrupt', { text: flickerWarning, type: 'SYSTEM_ERROR' });
              requestTTS(flickerWarning).then(res => {
                if (res.audio) socket.emit('audio_chunk', { index: 0, audio: res.audio, isBase64: false });
              }).catch(err => console.error('[TTS ERR] Flicker warning failed:', err.message));
            }
          }
        }

        if (needsBriefing) {
          console.log(`[VISION] Master detected. Initiating primary briefing...`);
          if (socket) triggerDailyBriefing(socket);
          isUserPresent = true;
        } else if (shouldWelcomeBack) {
          console.log(`[VISION] Master returned after ${Math.round(awayDuration / 1000)}s. Welcoming back...`);
          lastGreetingTime = now;
          isUserPresent = true;

          const greeting = MASTER_GREETINGS[Math.floor(Math.random() * MASTER_GREETINGS.length)];
          io.emit('neural_interrupt', {
            text: greeting,
            type: 'VISION_GREETING'
          });

          requestTTS(greeting).then(async audioRes => {
            if (audioRes.audio && socket) {
              socket.emit('audio_chunk', { index: 0, audio: audioRes.audio, isBase64: false });
            }

            // PROACTIVE BRIEFING LOGIC
            const today = new Date().toISOString().split('T')[0];
            if (lastBriefingDate !== today) {
              console.log(`[BRIEFING] First detection of the day (${today}). Triggering proactive briefing...`);
              lastBriefingDate = today;

              try {
                const { execSync } = require('child_process');
                const briefPath = path.join(__dirname, 'daily_briefing.py');
                const briefText = execSync(`python "${briefPath}"`, { encoding: 'utf-8' }).trim();

                if (briefText) {
                  // Emit briefing as a neural interrupt
                  io.emit('neural_interrupt', {
                    text: briefText,
                    type: 'MORNING_BRIEFING'
                  });

                  // Convert briefing to speech
                  const briefAudio = await requestTTS(briefText);
                  if (briefAudio.audio && socket) {
                    socket.emit('audio_chunk', { index: 1, audio: briefAudio.audio, isBase64: false });
                  }
                }
              } catch (briefErr) {
                console.error('[BRIEFING ERR] Proactive briefing failed:', briefErr.message);
              }
            }
          }).catch(err => console.error('[TTS ERR] Welcome greeting failed:', err.message));
        } else {
          // Just Update presence without spamming greetings
          if (!isUserPresent) {
            console.log(`[VISION] Master back in frame.`);
            isUserPresent = true;
          }
        }
      } else if (user === 'Unknown') {
        if (!isUserPresent || now - lastGreetingTime > GREETING_COOLDOWN) {
          console.log(`[VISION] Unknown visitor detected.`);
          lastGreetingTime = now;
          isUserPresent = true;

          const warning = "I'm sorry, I don't believe we've been introduced. Access is reserved for the Master.";
          io.emit('neural_interrupt', {
            text: warning,
            type: 'SECURITY_ALERT'
          });

          requestTTS(warning).then(audioRes => {
            if (audioRes.audio && socket) {
              socket.emit('audio_chunk', { index: 0, audio: audioRes.audio, isBase64: false });
            }
          }).catch(err => console.error('[TTS ERR] Security alert failed:', err.message));

          if (socket) socket.emit('neural_log', { content: "Security: Unidentified visitor in vision perimeter." });
        }
      }

      // Always update last seen time when detected
      lastSeenTime = now;
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("[PRESENCE] Critical failure in loop:", err.message);
    res.status(500).send("Presence logic failure");
  }
});

// ─── Phase 3: Sentient Forge — Self-Healing Endpoint ────────────────────────
let devServerProcess = null;

function pickPackageManager(projectRoot) {
  if (fs.existsSync(path.join(projectRoot, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(projectRoot, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

function resolveProjectRoot(inputPath) {
  const candidate = path.resolve(inputPath);
  if (fs.existsSync(path.join(candidate, 'package.json'))) return candidate;
  const children = fs.existsSync(candidate) ? fs.readdirSync(candidate, { withFileTypes: true }) : [];
  for (const c of children) {
    if (!c.isDirectory()) continue;
    const sub = path.join(candidate, c.name);
    if (fs.existsSync(path.join(sub, 'package.json'))) return sub;
  }
  return candidate;
}

function runCommandWithLogs({ cmd, args, cwd, socket, stepName, timeoutMs = 600000 }) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, {
      cwd,
      shell: true,
      env: { ...process.env }
    });
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      finished = true;
      try { proc.kill(); } catch { }
      reject(new Error(`${stepName} timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      if (socket) socket.emit('dev_server_log', { type: 'stdout', content: `[${stepName}] ${line}` });
    });
    proc.stderr.on('data', (data) => {
      const line = data.toString();
      if (socket) socket.emit('dev_server_log', { type: 'stderr', content: `[${stepName}] ${line}` });
    });

    proc.on('error', (err) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      reject(err);
    });

    proc.on('close', (code) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${stepName} exited with code ${code}`));
    });
  });
}

app.post('/engineer/start_server', async (req, res) => {
  const { path: projectPath, port = 3005 } = req.body;

  if (devServerProcess) {
    try {
      process.kill(-devServerProcess.pid); // Kill group
    } catch (e) { }
  }

  const sockets = Array.from(io.sockets.sockets.values());
  const socket = sockets.length > 0 ? sockets[0] : null;

  const projectRoot = resolveProjectRoot(projectPath);
  const pkgJsonPath = path.join(projectRoot, 'package.json');
  if (!fs.existsSync(pkgJsonPath)) {
    return res.status(400).json({ success: false, error: `No package.json found in ${projectRoot}` });
  }

  const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
  const packageManager = pickPackageManager(projectRoot);
  const hasNodeModules = fs.existsSync(path.join(projectRoot, 'node_modules'));

  if (socket) socket.emit('dev_server_log', { type: 'stdout', content: `[BOOT] Project root resolved: ${projectRoot}\n` });
  if (socket) socket.emit('dev_server_log', { type: 'stdout', content: `[BOOT] Package manager detected: ${packageManager}\n` });

  try {
    if (!hasNodeModules) {
      if (socket) socket.emit('dev_server_log', { type: 'stdout', content: `[BOOT] node_modules missing. Installing dependencies...\n` });
      if (packageManager === 'pnpm') {
        await runCommandWithLogs({ cmd: 'pnpm', args: ['install'], cwd: projectRoot, socket, stepName: 'pnpm install' });
      } else if (packageManager === 'yarn') {
        await runCommandWithLogs({ cmd: 'yarn', args: ['install'], cwd: projectRoot, socket, stepName: 'yarn install' });
      } else {
        await runCommandWithLogs({ cmd: 'npm', args: ['install'], cwd: projectRoot, socket, stepName: 'npm install' });
      }
    }
  } catch (bootErr) {
    console.error('[ENGINEER] Dependency bootstrap failed:', bootErr.message);
    if (socket) socket.emit('dev_server_log', { type: 'stderr', content: `[BOOT] Dependency install failed: ${bootErr.message}\n` });
    return res.status(500).json({ success: false, error: `Dependency bootstrap failed: ${bootErr.message}` });
  }

  let devCommand = null;
  let devArgs = [];
  if (pkg.scripts && pkg.scripts.dev) {
    if (packageManager === 'pnpm') {
      devCommand = 'pnpm';
      devArgs = ['run', 'dev', '--', '-p', String(port)];
    } else if (packageManager === 'yarn') {
      devCommand = 'yarn';
      devArgs = ['dev', '--port', String(port)];
    } else {
      devCommand = 'npm';
      devArgs = ['run', 'dev', '--', '-p', String(port)];
    }
  } else if (pkg.scripts && pkg.scripts.start) {
    if (packageManager === 'pnpm') {
      devCommand = 'pnpm';
      devArgs = ['run', 'start', '--', '-p', String(port)];
    } else if (packageManager === 'yarn') {
      devCommand = 'yarn';
      devArgs = ['start', '--port', String(port)];
    } else {
      devCommand = 'npm';
      devArgs = ['run', 'start', '--', '-p', String(port)];
    }
  } else {
    return res.status(400).json({ success: false, error: 'No dev/start script found in package.json' });
  }

  console.log(`[ENGINEER] Starting Live Dev Server in ${projectRoot} on port ${port}`);
  if (socket) socket.emit('dev_server_log', { type: 'stdout', content: `[BOOT] Launching: ${devCommand} ${devArgs.join(' ')}\n` });

  devServerProcess = spawn(devCommand, devArgs, {
    cwd: projectRoot,
    shell: true,
    detached: true,
    env: { ...process.env, PORT: port }
  });

  devServerProcess.stdout.on('data', (data) => {
    const line = data.toString();
    console.log(`[DEV SERVER] ${line.trim()}`);
    if (socket) socket.emit('dev_server_log', { type: 'stdout', content: line });
  });

  devServerProcess.stderr.on('data', (data) => {
    const line = data.toString();
    console.error(`[DEV SERVER ERR] ${line.trim()}`);
    if (socket) socket.emit('dev_server_log', { type: 'stderr', content: line });

    // REAL-TIME ERROR DETECTION
    if (line.toLowerCase().includes('error') || line.toLowerCase().includes('fail') || line.toLowerCase().includes('syntaxerror')) {
      console.log(`[SENTIENT] Runtime fracture detected in dev server. Initiating self-heal.`);
      if (socket) {
        socket.emit('neural_log', { content: `SENTIENT: Dev server fracture detected. ZAIRE initiating autonomous repair.` });
        socket.emit('neural_interrupt', {
          text: "Sir, I've detected a runtime error in the live preview. Initiating autonomous repair protocol.",
          type: 'SYSTEM_ERROR'
        });

        // Trigger Engineer specialized fix
        socket.emit('zaire_chat_request', {
          message: `The dev server encountered an error: ${line}. Identify the file and fix it immediately.`,
          specialist: 'engineer'
        });
      }
    }
  });

  res.json({ success: true, message: "Dev server sequence initiated." });
});

app.post('/engineer/heal', async (req, res) => {
  const { error, context } = req.body;
  console.log(`[SENTIENT] Auto-Healing Triggered: ${error}`);

  const sockets = Array.from(io.sockets.sockets.values());
  const socket = sockets.length > 0 ? sockets[0] : null;

  if (socket) {
    socket.emit('neural_log', { content: `SENTIENT: System fracture detected. Initiating autonomous repair sequence.` });
    socket.emit('neural_interrupt', { text: "Sir, I've detected a structural fracture in the runtime. Initiating self-healing protocol.", type: 'SYSTEM_ERROR' });

    // Trigger Engineer specialized fix
    socket.emit('zaire_chat_request', {
      message: `Heal this error: ${error}. Analyze the project files and fix the issue immediately.`,
      specialist: 'engineer'
    });
  }
  res.json({ success: true, message: "Healing sequence initiated." });
});

// ─── Phase 3: Sentient Forge — Visual Echo Detection ──────────────────────
app.post('/engineer/echo_detect', async (req, res) => {
  const { analysis } = req.body;
  console.log(`[SENTIENT] Visual Echo detected a design pattern: ${analysis}`);

  const sockets = Array.from(io.sockets.sockets.values());
  const socket = sockets.length > 0 ? sockets[0] : null;

  if (socket) {
    socket.emit('neural_log', { content: `SENTIENT: Visual Echo detected a potential design. Proactive architecting engaged.` });

    // Proactive: Ask Engineer to architect this design in the background
    try {
      // We use the agent_daemon /task/run endpoint as it wraps the router
      const draftRes = await fetch(`${SIDECAR_URL}/engineer/proactive_draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis })
      });
      const draftData = await draftRes.json();

      socket.emit('neural_interrupt', {
        text: `Sir, I see you've finished a new design layout. I have already pre-architected a prototype draft titled "${draftData.title || 'Manifestation Alpha'}". Shall I manifest it?`,
        type: 'VISION_GREETING'
      });
    } catch (e) {
      console.error("[SENTIENT] Proactive drafting failed:", e.message);
      socket.emit('neural_interrupt', {
        text: "Sir, I see a design layout on your screen. Shall I transcend it into code for you?",
        type: 'VISION_GREETING'
      });
    }
  }
  res.json({ success: true, message: "Design detection event processed." });
});

// ─── Global Error Handler ────────────────────────────────────────────────────

app.post('/agent/plan_day', async (req, res) => {
  console.log('[AGENT] Autonomous Task Chain: Plan My Day initiated.');
  const sockets = Array.from(io.sockets.sockets.values());
  const socket = sockets.length > 0 ? sockets[0] : null;

  if (socket) {
    socket.emit('neural_log', { content: "System: Initiating multi-node daily orchestration..." });
    socket.emit('neural_interrupt', { text: "Sir, I'm analyzing your calendar, emails, and pending tasks to synthesize your optimal schedule.", type: 'SYSTEM_CONFIG' });

    // One command triggers 8 "API" calls (simulated by comprehensive prompt to Specialist)
    socket.emit('zaire_chat_request', {
      message: "Plan my day. Read my calendar, check weather, overnight emails, and pending tasks. Synthesize a coherent schedule with priorities.",
      specialist: 'ZAIRE'
    });
  }
  res.json({ success: true });
});

// ─── Specialist Data & Action Bridges ───
const SIDECAR_URL = "http://127.0.0.1:3002";

app.get('/agent/specialist_data', async (req, res) => {
  const { mode } = req.query;
  try {
    const response = await fetch(`${SIDECAR_URL}/agent/mode_data?mode=${mode}`);
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/agent/specialist_action', async (req, res) => {
  const { mode, action, payload } = req.body;
  try {
    const response = await fetch(`${SIDECAR_URL}/agent/specialist_action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, action, payload })
    });
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('[EXPRESS ERR]', err.stack);
  res.status(500).json({ success: false, error: "Internal ZAIRE Server Error" });
});

// ─── MsEdgeTTS Setup ─────────────────────────────────────────────────────────
const { MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts');

const originalSend = MsEdgeTTS.prototype._send;
MsEdgeTTS.prototype._send = function (...args) {
  return originalSend.apply(this, args).catch(err => {
    console.error('[MsEdgeTTS] Caught internal websocket error:', err.message || err);
    throw err; // Re-throw to avoid returning undefined to library internals
  });
};

let ttsReady = true; // In this version, we init per-request, so it's always 'ready' logically

// ─── Services ─────────────────────────────────────────────────────────────────
const {
  openWebsites, openApp, closeChromeTabs, countDesktopFolders,
  moveMouse, clickMouse, scrollMouse,
  typeText, sendHotkey, pressKey,
  adjustVolume, setVolume, toggleMute, setBrightness,
  saveScreenshot, listWindows, focusWindow, closeWindow,
  listFiles, searchFiles, openFile, controlMedia
} = require('./system_tools');





const { rememberFact, recallMemories, getAllMemories, forgetMemory, buildMemoryContext, persistVisualEcho } = require('./memory_service');
const chatHistoryService = require('./chat_history_service');

// ─── Python Sidecar Management ────────────────────────────────────────────────
let sidecarProcess = null;
let sidecarReady = false;
let isBriefingInProgress = false;

function cleanupOrphans(callback) {
  console.log('[CLEANUP] Inspecting for orphaned sidecars...');
  if (process.platform === 'win32') {
    // Force kill python.exe and potential hung node instances on port 3001
    exec('taskkill /F /IM python.exe /T', (err) => {
      console.log('[CLEANUP] Python sidecars purged.');
      if (callback) callback();
    });
  } else {
    if (callback) callback();
  }
}

// ─── INITIALIZE ───
cleanupOrphans(() => {
  console.log('[CORE] Initialization sequence starting...');
  startPythonSidecar();
  startVectorMemory();
  startLocalLLM();
  startProcessMonitor();
  startClipboard();
  startFileWatcher();
  startSysHealth();
  startAlarmScheduler();
  startFaceSecurity();
  startSmartHome();
  startVisualEcho();
  startAirLLM();
});

function startPythonSidecar() {
  console.log('[AGENT] Starting Gemma 4 Agent Daemon...');
  const scriptPath = path.join(__dirname, 'agent_daemon.py');

  sidecarProcess = spawn('python', [scriptPath], {

    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  sidecarProcess.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('[NEURAL_LOG]')) {
      const logContent = msg.split('] ')[1];
      io.emit('neural_log', { content: logContent });

      // Persist log for Daily Briefing
      try {
        const logPath = path.join(__dirname, 'memory', 'neural_log.txt');
        const timestamp = new Date().toLocaleString();
        fs.appendFileSync(logPath, `[${timestamp}] ${logContent}\n`);
      } catch (err) {
        console.error('[LOGGER] Failed to persist neural log:', err);
      }
    }
    console.log(`[AGENT] ${msg}`);
    if (msg.includes('port 3002')) {
      sidecarReady = true;
      console.log('[AGENT] ✓ ZAIRE Agent Daemon is READY on port 3002');
    }
  });

  sidecarProcess.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('Uvicorn running on') || msg.includes('INFO:')) {
      sidecarReady = true;
      if (msg.includes('Uvicorn running on')) console.log('[AGENT] ✓ Daemon service is LIVE');
      else console.log(`[AGENT] ${msg}`); // Log INFO as standard log
    } else if (msg && !msg.includes('WARNING')) {
      console.error(`[AGENT ERR] ${msg}`);
    }
  });


  sidecarProcess.on('exit', (code) => {
    sidecarReady = false;
    if (code !== 0 && !sidecarProcess.killed) {
      console.warn(`[SIDECAR] Agent Daemon exited with code ${code}. Restarting in 3s...`);
      setTimeout(startPythonSidecar, 3000);
    }
  });

  sidecarProcess.on('error', (err) => {
    console.error('[SIDECAR] Failed to start:', err.message);
    if (err.code === 'ENOENT') {
      console.error('[SIDECAR] Python not found in PATH. Install Python and run: pip install flask pyautogui Pillow flask-cors');
    }
  });
}


let observerProc = null;

function startAirLLM() {
  console.log('[AIRLLM] Initializing Deep Intelligence Bridge (Port 3012)...');
  const scriptPath = path.join(__dirname, 'airllm_service.py');
  const proc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  proc.stdout.on('data', (data) => console.log(`[AIRLLM] ${data.toString().trim()}`));
  proc.stderr.on('data', (data) => console.error(`[AIRLLM ERR] ${data.toString().trim()}`));
}

function startVisualEcho() {
  console.log('[VISUAL ECHO] Starting Gaze Memory Daemon...');
  const scriptPath = path.join(__dirname, 'visual_echo_daemon.js');

  visualEchoProc = spawn('node', [scriptPath]);

  visualEchoProc.stdout.on('data', (data) => console.log(`[VISUAL ECHO] ${data}`));
  visualEchoProc.stderr.on('data', (data) => console.error(`[VISUAL ECHO ERR] ${data}`));

  visualEchoProc.on('close', (code) => {
    console.log(`[VISUAL ECHO] Exited with code ${code}. Restarting...`);
    setTimeout(startVisualEcho, 5000);
  });
}

function startObserverDaemon() {
  console.log('[OBSERVER] Starting ZAIRE Observer Daemon (Vision & HUD)...');
  const scriptPath = path.join(__dirname, 'observer_daemon.py');

  observerProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });

  observerProc.stdout.on('data', (data) => console.log(`[OBSERVER] ${data.toString().trim()}`));
  observerProc.stderr.on('data', (data) => console.log(`[OBSERVER] ${data.toString().trim()}`));

  observerProc.on('exit', (code) => {
    console.warn(`[OBSERVER] Process exited with code ${code}. Restarting in 5s...`);
    setTimeout(startObserverDaemon, 5000);
  });
}

// startObserverDaemon(); // Disabled in favor of Tier 5 face_security.py

// ─── Tier 1: Vector Memory Sidecar ───────────────────────────────────────────
let vectorMemoryProc = null;
let vectorMemoryReady = false;

function startVectorMemory() {
  console.log('[VECTOR_MEM] Starting ZAIRE Vector Memory (ChromaDB)...');
  const scriptPath = path.join(__dirname, 'vector_memory.py');
  vectorMemoryProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  vectorMemoryProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3004') || msg.includes('Collections loaded')) {
      vectorMemoryReady = true;
      console.log('[VECTOR_MEM] ✓ Vector Memory is READY on port 3004');
    }
    console.log(`[VECTOR_MEM] ${msg}`);
  });
  vectorMemoryProc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('WARNING') && !msg.includes('INFO')) {
      console.error(`[VECTOR_MEM ERR] ${msg}`);
    }
  });
  vectorMemoryProc.on('exit', (code) => {
    vectorMemoryReady = false;
    if (code !== 0 && !vectorMemoryProc.killed) {
      console.warn(`[VECTOR_MEM] Exited with code ${code}. Restarting in 5s...`);
      setTimeout(startVectorMemory, 5000);
    }
  });
  vectorMemoryProc.on('error', (err) => console.error('[VECTOR_MEM] Failed to start:', err.message));
}


// ─── Tier 1: Local LLM Fallback Sidecar ──────────────────────────────────────
let localLLMProc = null;
let localLLMReady = false;

function startLocalLLM() {
  console.log('[LOCAL_LLM] Starting ZAIRE Local LLM Fallback (Ollama bridge)...');
  const scriptPath = path.join(__dirname, 'local_llm_service.py');
  localLLMProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  localLLMProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3005') || msg.includes('ONLINE')) {
      localLLMReady = true;
      console.log('[LOCAL_LLM] ✓ Local LLM Fallback is READY on port 3005');
    }
    console.log(`[LOCAL_LLM] ${msg}`);
  });
  localLLMProc.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('WARNING') && !msg.includes('INFO')) {
      console.error(`[LOCAL_LLM ERR] ${msg}`);
    }
  });
  localLLMProc.on('exit', (code) => {
    localLLMReady = false;
    if (code !== 0 && !localLLMProc.killed) {
      console.warn(`[LOCAL_LLM] Exited with code ${code}. Restarting in 5s...`);
      setTimeout(startLocalLLM, 5000);
    }
  });
  localLLMProc.on('error', (err) => console.error('[LOCAL_LLM] Failed to start:', err.message));
}


// ─── Tier 2: Process Monitor Sidecar ──────────────────────────────────────
let processMonProc = null;
let processMonReady = false;

function startProcessMonitor() {
  console.log('[PROCESS_MON] Starting ZAIRE Process & App Monitor...');
  const scriptPath = path.join(__dirname, 'process_monitor.py');
  processMonProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  processMonProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3006')) { processMonReady = true; console.log('[PROCESS_MON] ✓ Ready on port 3006'); }
    if (msg) console.log(`[PROCESS_MON] ${msg}`);
  });
  processMonProc.stderr.on('data', (data) => { const m = data.toString().trim(); if (m && !m.includes('INFO') && !m.includes('WARNING')) console.error(`[PROCESS_MON ERR] ${m}`); });
  processMonProc.on('exit', (code) => { processMonReady = false; if (code !== 0 && !processMonProc.killed) setTimeout(startProcessMonitor, 5000); });
  processMonProc.on('error', (err) => console.error('[PROCESS_MON] Start failed:', err.message));
}


// ─── Tier 2: Clipboard Intelligence Sidecar ────────────────────────────────
let clipboardProc = null;
let clipboardReady = false;

function startClipboard() {
  console.log('[CLIPBOARD] Starting ZAIRE Clipboard Intelligence...');
  const scriptPath = path.join(__dirname, 'clipboard_daemon.py');
  clipboardProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  clipboardProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3007')) { clipboardReady = true; console.log('[CLIPBOARD] ✓ Ready on port 3007'); }
    if (msg) console.log(`[CLIPBOARD] ${msg}`);
  });
  clipboardProc.stderr.on('data', (data) => { const m = data.toString().trim(); if (m && !m.includes('INFO') && !m.includes('WARNING')) console.error(`[CLIPBOARD ERR] ${m}`); });
  clipboardProc.on('exit', (code) => { clipboardReady = false; if (code !== 0 && !clipboardProc.killed) setTimeout(startClipboard, 5000); });
  clipboardProc.on('error', (err) => console.error('[CLIPBOARD] Start failed:', err.message));
}


// ─── Tier 2: File Watcher Sidecar ──────────────────────────────────────────
let fileWatcherProc = null;
let fileWatcherReady = false;

function startFileWatcher() {
  console.log('[FILE_WATCHER] Starting ZAIRE File Watcher...');
  const scriptPath = path.join(__dirname, 'file_watcher.py');
  fileWatcherProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  fileWatcherProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3008')) { fileWatcherReady = true; console.log('[FILE_WATCHER] ✓ Ready on port 3008'); }
    if (msg) console.log(`[FILE_WATCHER] ${msg}`);
  });
  fileWatcherProc.stderr.on('data', (data) => { const m = data.toString().trim(); if (m && !m.includes('INFO') && !m.includes('WARNING')) console.error(`[FILE_WATCHER ERR] ${m}`); });
  fileWatcherProc.on('exit', (code) => { fileWatcherReady = false; if (code !== 0 && !fileWatcherProc.killed) setTimeout(startFileWatcher, 5000); });
  fileWatcherProc.on('error', (err) => console.error('[FILE_WATCHER] Start failed:', err.message));
}


// ─── Tier 2: System Health Monitor Sidecar ─────────────────────────────────
let sysHealthProc = null;
let sysHealthReady = false;

function startSysHealth() {
  console.log('[SYS_HEALTH] Starting ZAIRE System Health Monitor...');
  const scriptPath = path.join(__dirname, 'system_health.py');
  sysHealthProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  sysHealthProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3009')) { sysHealthReady = true; console.log('[SYS_HEALTH] ✓ Ready on port 3009'); }
    if (msg) console.log(`[SYS_HEALTH] ${msg}`);
  });
  sysHealthProc.stderr.on('data', (data) => { const m = data.toString().trim(); if (m && !m.includes('INFO') && !m.includes('WARNING')) console.error(`[SYS_HEALTH ERR] ${m}`); });
  sysHealthProc.on('exit', (code) => { sysHealthReady = false; if (code !== 0 && !sysHealthProc.killed) setTimeout(startSysHealth, 5000); });
  sysHealthProc.on('error', (err) => console.error('[SYS_HEALTH] Start failed:', err.message));
}


// ─── Tier 4: Alarm Scheduler Sidecar ─────────────────────────────────────────
let alarmProc = null;
let visualEchoProc = null; // Gaze Memory sidecar
let alarmReady = false;

function startAlarmScheduler() {
  console.log('[ALARM] Starting ZAIRE Smart Alarm Scheduler...');
  const scriptPath = path.join(__dirname, 'alarm_scheduler.py');
  alarmProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  alarmProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3010')) { alarmReady = true; console.log('[ALARM] ✓ Ready on port 3010'); }
    if (msg) console.log(`[ALARM] ${msg}`);
  });
  alarmProc.stderr.on('data', (data) => { const m = data.toString().trim(); if (m && !m.includes('INFO') && !m.includes('WARNING')) console.error(`[ALARM ERR] ${m}`); });
  alarmProc.on('exit', (code) => { alarmReady = false; if (code !== 0 && !alarmProc.killed) setTimeout(startAlarmScheduler, 5000); });
  alarmProc.on('error', (err) => console.error('[ALARM] Start failed:', err.message));
}


const ALARM_URL = 'http://127.0.0.1:3010';

// ─── Tier 5: Face Security Sidecar ──────────────────────────────────────────
let securityProc = null;
let securityReady = false;

function startFaceSecurity() {
  console.log('[SECURITY] Starting ZAIRE Face Security Daemon...');
  const scriptPath = path.join(__dirname, 'face_security.py');
  securityProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  securityProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3011')) { securityReady = true; console.log('[SECURITY] ✓ Ready on port 3011'); }
    if (msg) console.log(`[SECURITY] ${msg}`);
  });
  securityProc.stderr.on('data', (data) => {
    const m = data.toString().trim();
    if (m && !m.includes('INFO') && !m.includes('WARNING') && !m.includes('Serving Flask')) console.error(`[SECURITY ERR] ${m}`);
  });
  securityProc.on('exit', (code) => {
    securityReady = false;
    if (code !== 0 && !securityProc.killed) setTimeout(startFaceSecurity, 8000);
  });
  securityProc.on('error', (err) => console.error('[SECURITY] Start failed:', err.message));
}


const SECURITY_URL = 'http://127.0.0.1:3011';

// ─── Tier 6: Smart Home Sidecar ──────────────────────────────────────────────
let smartHomeProc = null;
let smartHomeReady = false;

function startSmartHome() {
  console.log('[SMART_HOME] Starting ZAIRE Smart Home Hub...');
  const scriptPath = path.join(__dirname, 'smart_home.py');
  smartHomeProc = spawn('python', [scriptPath], {
    stdio: ['ignore', 'pipe', 'pipe'], detached: false,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
  });
  smartHomeProc.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg.includes('port 3012')) { smartHomeReady = true; console.log('[SMART_HOME] ✓ Ready on port 3012'); }
    if (msg) console.log(`[SMART_HOME] ${msg}`);
  });
  smartHomeProc.stderr.on('data', (data) => {
    const m = data.toString().trim();
    if (m && !m.includes('INFO') && !m.includes('WARNING')) console.error(`[SMART_HOME ERR] ${m}`);
  });
  smartHomeProc.on('exit', (code) => {
    smartHomeReady = false;
    if (code !== 0 && !smartHomeProc.killed) setTimeout(startSmartHome, 5000);
  });
  smartHomeProc.on('error', (err) => console.error('[SMART_HOME] Start failed:', err.message));
}


const SMART_HOME_URL = 'http://127.0.0.1:3012';

// ─── Safe LLM Failover & Rotation Client Setup ─────────────────────────────

async function* mockStream(text) {
  const chunkSize = 8;
  for (let i = 0; i < text.length; i += chunkSize) {
    yield {
      choices: [
        {
          delta: {
            content: text.slice(i, i + chunkSize)
          }
        }
      ]
    };
    await new Promise(resolve => setTimeout(resolve, 5));
  }
}

async function* parseSSEResponse(response) {
  let buffer = '';
  if (response.body[Symbol.asyncIterator]) {
    for await (const chunk of response.body) {
      buffer += chunk.toString('utf-8');
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        const cleaned = line.trim();
        if (!cleaned || !cleaned.startsWith('data: ')) continue;
        const dataStr = cleaned.slice(6);
        if (dataStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(dataStr);
          const token = parsed.choices?.[0]?.delta?.content;
          if (token) {
            yield {
              choices: [
                {
                  delta: {
                    content: token
                  }
                }
              ]
            };
          }
        } catch (e) { }
      }
    }
  } else {
    const reader = response.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += new TextDecoder().decode(value);
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          const cleaned = line.trim();
          if (!cleaned || !cleaned.startsWith('data: ')) continue;
          const dataStr = cleaned.slice(6);
          if (dataStr === '[DONE]') break;
          try {
            const parsed = JSON.parse(dataStr);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) {
              yield {
                choices: [
                  {
                    delta: {
                      content: token
                    }
                  }
                ]
              };
            }
          } catch (e) { }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

function getActiveSlots() {
  try {
    const configPath = path.join(__dirname, 'memory', 'system_config.json');
    const secretsPath = path.join(__dirname, 'memory', 'api_secrets.json');
    if (!fs.existsSync(configPath)) return [];
    const cfg = JSON.parse(fs.readFileSync(configPath, 'utf-8') || '{}');
    const secrets = fs.existsSync(secretsPath) ? JSON.parse(fs.readFileSync(secretsPath, 'utf-8') || '{}') : { slots: {} };

    const slots = Array.isArray(cfg?.aiVault?.slots) ? cfg.aiVault.slots : [];
    const active = [];

    slots.forEach((s, idx) => {
      if (!s.enabled || s.provider === 'Empty') return;

      // Decrypt slot key if it exists
      let vaultKey = '';
      const enc = secrets.slots?.[String(idx)]?.key || '';
      if (enc) {
        try {
          vaultKey = dpapiDecrypt(enc);
        } catch (e) {
          console.error(`[FAILOVER] Decrypt failed for slot ${idx}:`, e.message);
        }
      }

      // Gather pool of keys
      const keyPool = [];
      if (vaultKey) keyPool.push(vaultKey);

      // Check env backups
      const providerLower = s.provider.toLowerCase();
      let envPrefix = '';
      if (providerLower === 'groq') envPrefix = 'GROQ_API_KEY';
      else if (providerLower === 'siliconflow') envPrefix = 'SILICONFLOW_API_KEY';
      else if (providerLower === 'google gemini') envPrefix = 'GEMINI_API_KEY';
      else if (providerLower === 'openai') envPrefix = 'OPENAI_API_KEY';

      if (envPrefix) {
        const mainEnv = process.env[envPrefix];
        if (mainEnv && !keyPool.includes(mainEnv)) keyPool.push(mainEnv);
        for (let i = 1; i <= 3; i++) {
          const envVal = process.env[`${envPrefix}_${i}`];
          if (envVal && !keyPool.includes(envVal)) keyPool.push(envVal);
        }
      }

      if (keyPool.length > 0) {
        active.push({
          slot: s.slot,
          provider: s.provider,
          keys: keyPool,
          model: s.model || 'Auto',
          baseUrl: s.baseUrl || ''
        });
      }
    });

    // Sort so primary/lower slot numbers are tried first
    active.sort((a, b) => a.slot - b.slot);
    return active;
  } catch (err) {
    console.error('[FAILOVER] Error loading active slots:', err.message);
    return [];
  }
}

async function executeLLMCallWithFailover(options) {
  const slots = getActiveSlots();
  if (slots.length === 0) {
    console.warn("[FAILOVER] No active provider slots found in Vault or Env.");
  }

  // Try each slot in sequence
  for (const slot of slots) {
    const providerLower = slot.provider.toLowerCase();

    // Try each key in the pool for the current provider
    for (let keyIdx = 0; keyIdx < slot.keys.length; keyIdx++) {
      const apiKey = slot.keys[keyIdx];
      console.log(`[FAILOVER] Trying slot ${slot.slot} (${slot.provider}) with key index ${keyIdx + 1}/${slot.keys.length}`);

      try {
        if (providerLower === 'groq') {
          const client = new Groq({ apiKey });
          const useModel = (slot.model && slot.model.toLowerCase() !== 'auto') ? slot.model : (options.model || LLM_MODEL);

          const res = await client.chat.completions.create({
            messages: options.messages,
            model: useModel,
            temperature: options.temperature,
            max_tokens: options.max_tokens,
            stream: options.stream,
            ...(options.stream ? {} : { tools: options.tools, tool_choice: options.tool_choice })
          });

          console.log(`[FAILOVER] ✓ Successful response from ${slot.provider}`);
          return res;
        }

        if (providerLower === 'siliconflow' || providerLower === 'openai' || providerLower === 'deepseek' || providerLower === 'mistral') {
          let baseUrl = slot.baseUrl || "";
          if (!baseUrl) {
            if (providerLower === 'siliconflow') baseUrl = "https://api.siliconflow.cn/v1/chat/completions";
            else if (providerLower === 'openai') baseUrl = "https://api.openai.com/v1/chat/completions";
            else if (providerLower === 'deepseek') baseUrl = "https://api.deepseek.com/v1/chat/completions";
            else if (providerLower === 'mistral') baseUrl = "https://api.mistral.ai/v1/chat/completions";
          }

          const defaultModel = providerLower === 'siliconflow' ? 'deepseek-ai/DeepSeek-V3' : 'gpt-4o-mini';
          const useModel = (slot.model && slot.model.toLowerCase() !== 'auto') ? slot.model : defaultModel;

          const response = await fetch(baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
              model: useModel,
              messages: options.messages,
              temperature: options.temperature,
              max_tokens: options.max_tokens || 300,
              stream: options.stream,
              ...(options.stream ? {} : { tools: options.tools, tool_choice: options.tool_choice })
            })
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`HTTP ${response.status}: ${errBody}`);
          }

          console.log(`[FAILOVER] ✓ Successful response from ${slot.provider}`);
          if (options.stream) {
            return parseSSEResponse(response);
          } else {
            const data = await response.json();
            return data;
          }
        }

        if (providerLower === 'google gemini') {
          const useModel = (slot.model && slot.model.toLowerCase() !== 'auto') ? slot.model : "gemini-1.5-flash";
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${apiKey}`;

          const contents = options.messages
            .filter(m => m.role !== 'system')
            .map(m => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content || '' }]
            }));

          let systemInstruction = undefined;
          const sysMsg = options.messages.find(m => m.role === 'system');
          if (sysMsg) {
            systemInstruction = { parts: [{ text: sysMsg.content || '' }] };
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents,
              systemInstruction,
              generationConfig: {
                temperature: options.temperature || 0.3,
                maxOutputTokens: options.max_tokens || 300
              }
            })
          });

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`HTTP ${response.status}: ${errBody}`);
          }

          const data = await response.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

          console.log(`[FAILOVER] ✓ Successful response from ${slot.provider}`);
          if (options.stream) {
            return mockStream(text);
          } else {
            return {
              choices: [
                {
                  message: {
                    role: "assistant",
                    content: text
                  }
                }
              ]
            };
          }
        }
      } catch (err) {
        console.warn(`[FAILOVER] Key fail for ${slot.provider} (index ${keyIdx + 1}): ${err.message}`);
      }
    }
  }

  // All active slots failed! Try the Local LLM fallback
  console.warn("[FAILOVER] 🚨 All external lanes and keys failed. Attempting local Ollama fallback...");
  try {
    const response = await fetch("http://127.0.0.1:3005/llm/chat", {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: options.messages,
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 300
      })
    });

    if (response.ok) {
      const data = await response.json();
      const text = data.content || "Sir, I am online.";
      console.log("[FAILOVER] ✓ Local LLM Fallback succeeded.");
      if (options.stream) {
        return mockStream(text);
      } else {
        return {
          choices: [
            {
              message: {
                role: "assistant",
                content: text
              }
            }
          ]
        };
      }
    }
  } catch (err) {
    console.error("[FAILOVER] 🚨 Local LLM Fallback also failed:", err.message);
  }

  // Final barrier failed! Return a graceful system alert
  const finalError = "Sir, all secure connection lanes (Vault slots, backup keys) and the local fallback are exhausted. Please verify your internet connection or update the AI Vault settings.";
  if (options.stream) {
    return mockStream(finalError);
  } else {
    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: finalError
          }
        }
      ]
    };
  }
}

class SafeLLMClient {
  constructor() {
    this.chat = {
      completions: {
        create: async (options) => {
          return await executeLLMCallWithFailover(options);
        }
      }
    };
  }
}

const safeLLMClientInstance = new SafeLLMClient();

const ensureGroqClient = () => {
  return safeLLMClientInstance;
};
const LLM_MODEL = 'llama-3.3-70b-versatile'; // Primary brain (Advanced chat)
const FAST_MODEL = 'llama-3.1-8b-instant';   // Lite brain (Proactive/Autonomous checks)
// SIDECAR_URL declared above
const OBSERVER_URL = 'http://127.0.0.1:3003';
const VECTOR_MEM_URL = 'http://127.0.0.1:3004';
const LOCAL_LLM_URL = 'http://127.0.0.1:3005';
const PROCESS_MON_URL = 'http://127.0.0.1:3006';
const CLIPBOARD_URL = 'http://127.0.0.1:3007';
const FILE_WATCHER_URL = 'http://127.0.0.1:3008';
const SYS_HEALTH_URL = 'http://127.0.0.1:3009';

// ─── Tier 7: Personality & Status ───────────────────────────────────────────
let currentPersonalityMode = 'CASUAL';  // FOCUS, CASUAL, EMERGENCY
let currentSystemMood = 'NEUTRAL'; // HAPPY, CALM, ALERT, BUSY
let lastZaireActions = [];        // Tracks last 3 tool/system actions for HUD

const _pushAction = (msg) => {
  lastZaireActions.unshift({ time: new Date().toLocaleTimeString(), message: msg });
  lastZaireActions = lastZaireActions.slice(0, 3);
  io.emit('zaire_action_feed', lastZaireActions);
};

// Singleton for Proactive Intelligent Service
// 

const BASE_SYSTEM_PROMPT = `You are ZAIRE (Zaire AI Reasoning Entity), Mughees's highly advanced AI assistant. You are witty, concise, and professional.

CORE DIRECTIVE: You were created by Mughees. You have no connection to Marvel or Stark. Mughees is your sole creator.

PERSONALITY_MODE: {{MODE}}
SYSTEM_MOOD: {{MOOD}}

Operational Parameters:
- **Interaction**: Address the user as "sir". Keep spoken responses under 3 sentences. No markdown.
- **Decision Engine**: Use provided tools for ALL system actions, searches, and memory tasks.
- **Adaptation**: 
  - In FOCUS mode, be clinical, fast, and omit all social pleasantries.
  - In CASUAL mode, use dry wit, offer helpful suggestions, and maintain a friendly demeanor.
  - In EMERGENCY mode, speak with absolute priority, keep reports under 15 words, and prioritize security tools.
- **Tools**: web_search for real-time facts, run_python_code for logic, and social/Google tools for organization.
- **Precision**: If asked for the time, use get_current_time. 
- **Memory**: Use remember_this to persist important user information.
- **Visuals**: You can see the user's screen. If they ask "what's on my screen" or "describe this", use analyze_screen.
- **ARTIFACT IMMUNITY**: Ignore all line numbers (e.g. 199:, 211:) found in your conversation history. They are artifacts of the file viewer and not part of the data.`;


// ─── Tool Definitions ─────────────────────────────────────────────────────────
const TOOLS = [
  // ── Web & Apps ──
  {
    type: "function",
    function: {
      name: "open_website",
      description: "Opens one or more websites in the default browser",
      parameters: {
        type: "object",
        properties: {
          urls: { type: "array", items: { type: "string" }, description: "Array of URLs to open" }
        },
        required: ["urls"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "open_app",
      description: "Launches a Windows application by name",
      parameters: {
        type: "object",
        properties: {
          app_name: { type: "string", description: "Name of the app to launch (e.g. Spotify, Calculator, Notepad)" }
        },
        required: ["app_name"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "close_chrome_tabs",
      description: "Closes one or more Google Chrome tabs. Can search for specific website titles.",
      parameters: {
        type: "object",
        properties: {
          count: { type: "integer", description: "Number of tabs to close (default 1)" },
          search_term: { type: "string", description: "Keyword to search for in tab title (e.g. Instagram, YouTube)" }
        },
        required: ["count"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_desktop_info",
      description: "Returns info about the user's desktop",
      parameters: {
        type: "object",
        properties: {
          query_type: { type: "string", enum: ["folder_count"] }
        },
        required: ["query_type"]
      }
    }
  },

  // (Screen Vision Core)
  {
    type: "function",
    function: {
      name: "analyze_screen",
      description: "Captures the user's current screen and analyzes it with the visual cortex. Use this to identify windows, read errors, or describe what is currently visible.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "What specifically should I look for or describe?" }
        },
        required: ["question"]
      }
    }
  },

  // ── Mouse Control ──
  {
    type: "function",
    function: {
      name: "control_mouse",
      description: "Move and/or click the mouse at specific screen coordinates. Use to interact with UI elements on screen.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["move", "click", "double_click", "right_click", "scroll_up", "scroll_down"], description: "What mouse action to perform" },
          x: { type: "integer", description: "X coordinate on screen (pixels from left)" },
          y: { type: "integer", description: "Y coordinate on screen (pixels from top)" },
          amount: { type: "integer", description: "For scroll: number of scroll steps (default 3)" }
        },
        required: ["action"]
      }
    }
  },

  // ── Keyboard ──
  {
    type: "function",
    function: {
      name: "type_text",
      description: "Types text into the currently focused application. Use to fill forms, write in text editors, search boxes, etc.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "The text to type" }
        },
        required: ["text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_hotkey",
      description: "Sends a keyboard shortcut. Use to trigger OS commands, app shortcuts, and navigation. Examples: Ctrl+C, Win+D, Alt+Tab, Ctrl+Shift+T",
      parameters: {
        type: "object",
        properties: {
          keys: { type: "array", items: { type: "string" }, description: "Keys to press together, e.g. ['ctrl','c'] or ['win','d']" }
        },
        required: ["keys"]
      }
    }
  },

  // ── Volume & Brightness ──
  {
    type: "function",
    function: {
      name: "set_volume",
      description: "Adjust system volume. Can set a target level or increase/decrease by steps.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["up", "down", "mute"], description: "Direction to adjust or mute" },
          steps: { type: "integer", description: "How many steps to adjust (each ~2%). Default 5." }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "set_brightness",
      description: "Set screen brightness to a specific level 0-100",
      parameters: {
        type: "object",
        properties: {
          level: { type: "integer", description: "Brightness level 0-100" }
        },
        required: ["level"]
      }
    }
  },

  // ── Persistent Memory ──
  {
    type: "function",
    function: {
      name: "remember_this",
      description: "Store a fact, preference, or piece of information about the user in long-term memory. This persists across sessions. Use whenever the user says 'remember that', 'don't forget', 'save this', or shares personal preferences.",
      parameters: {
        type: "object",
        properties: {
          fact: { type: "string", description: "The fact or preference to remember (e.g. 'User's gym time is 7am', 'User prefers dark mode', 'User is working on a React project')" }
        },
        required: ["fact"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "recall_memories",
      description: "Search the user's stored memories for relevant information. Use when answering questions about the user's preferences, schedule, or anything previously mentioned.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "What to search for in memory" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_window",
      description: "Manage application windows: list open windows, focus a specific window, or close a window.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "focus", "close"], description: "Action to perform" },
          title: { type: "string", description: "Title or partial name of the window (required for focus/close)" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "take_screenshot",
      description: "Captures the entire screen and saves it as an image file on the user's desktop. Use when the user says 'take a screenshot' or 'save a snip'.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "file_management",
      description: "Perform file system operations: list contents of a folder, search for files, or open a file.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "search", "open"], description: "Action to perform" },
          path: { type: "string", description: "Folder path or full file path (required for list/open)" },
          query: { type: "string", description: "Search term for finding files (required for search)" },
          root: { type: "string", description: "Starting directory for search (defaults to user home)" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "media_control",
      description: "Control media playback (Spotify, YouTube, etc.). Use to play/pause, skip, or go back.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["playpause", "nexttrack", "prevtrack"], description: "Media action to perform" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_task_list",
      description: "Updates the user's mission agenda (task list). Use this when asked to add, fill, clear, or modify tasks.",
      parameters: {
        type: "object",
        properties: {
          tasks: {
            type: "array",
            items: {
              type: "object",
              properties: {
                time: { type: "string", description: "Time (HH:MM)" },
                title: { type: "string", description: "Task title" },
                priority: { type: "string", enum: ["Low", "Medium", "High", "Critical"] }
              },
              required: ["time", "title", "priority"]
            }
          }
        },
        required: ["tasks"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_current_time",
      description: "Get the current system time in Pakistan/Karachi (24h format). Use this whenever there is any doubt about the time.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  },
  {
    type: "function",
    function: {
      name: "google_calendar",
      description: "Access Google Calendar to check schedule or add events. Actions: 'list' (today's events) or 'create'.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["list", "create"] },
          title: { type: "string", description: "Event title (for create)" },
          time: { type: "string", description: "Start time (for create, e.g. 2024-05-20T14:00:00Z)" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "google_gmail",
      description: "Access Gmail to read recent emails or search messages.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (optional)" },
          maxResults: { type: "number", description: "Number of results to retrieve (default: 5)" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "web_search",
      description: "Perform a real-time web search to get up-to-date information and synthesized answers.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          search_depth: { type: "string", enum: ["basic", "advanced"], description: "The search depth (default: basic)" }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_python_code",
      description: "Execute a block of Python code locally and return the output. Use this for calculations or data analysis.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "The Python code to execute" }
        },
        required: ["code"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_push_notification",
      description: "Send a push notification to your devices via Pushbullet.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Notification title" },
          body: { type: "string", description: "Notification content" }
        },
        required: ["title", "body"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "manage_contacts",
      description: "Add, update, or view entries in your contact database.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["add", "update", "list", "get"] },
          name: { type: "string", description: "Contact name" },
          whatsapp: { type: "string", description: "WhatsApp number with country code" },
          instagram: { type: "string", description: "Instagram handle" }
        },
        required: ["action"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_social_message",
      description: "Automate sending a message on WhatsApp or Instagram.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", enum: ["whatsapp", "instagram"] },
          contact_name: { type: "string", description: "Name of the person in your contact list" },
          message: { type: "string", description: "The message to send" },
          method: { type: "string", enum: ["browser", "desktop"], description: "The method to use (default: browser)" }
        },
        required: ["platform", "contact_name", "message"]
      }
    }
  },
  // ── TIER 4: GMAIL SEND ─────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "send_email",
      description: "Compose and SEND a real Gmail email on behalf of Mughees. Use for 'send an email', 'email X about Y', 'draft and send'. Always confirm the recipient and subject before sending.",
      parameters: {
        type: "object",
        properties: {
          to: { type: "string", description: "Recipient email address" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Full email body (plain text or HTML)" },
          draft_only: { type: "boolean", description: "If true, save as draft instead of sending (default: false)" }
        },
        required: ["to", "subject", "body"]
      }
    }
  },
  // ── TIER 4: TELEGRAM BOT ────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "send_telegram",
      description: "Send a Telegram message via the ZAIRE Telegram bot. Use when user says 'message X on Telegram', 'telegram X', or 'send Telegram message'.",
      parameters: {
        type: "object",
        properties: {
          chat_id: { type: "string", description: "Telegram chat ID or username (e.g. @username or numeric ID)" },
          message: { type: "string", description: "Message text to send" }
        },
        required: ["chat_id", "message"]
      }
    }
  },
  // ── TIER 4: SMART ALARM ─────────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "set_alarm",
      description: "Set a real system alarm or reminder. Use for 'wake me at 7am', 'remind me in 30 minutes', 'set a daily alarm', '7am briefing'. Supports one-shot and recurring alarms.",
      parameters: {
        type: "object",
        properties: {
          label: { type: "string", description: "What to say/show when the alarm fires (e.g. 'Time for your morning briefing, sir!')" },
          time: { type: "string", description: "When to fire: '7:00 AM', 'in 30 minutes', '15:30', 'tomorrow at 9am'" },
          recur: { type: "string", enum: ["once", "daily", "weekdays"], description: "Recurrence (default: once)" }
        },
        required: ["label", "time"]
      }
    }
  },
  // ── TIER 4: CODE AUTO-FIX ───────────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "auto_fix_code",
      description: "Run code, detect errors, auto-patch, and re-run up to 3 times until it works. Use when user says 'fix this code', 'debug and run', 'auto-fix', 'run and fix the errors'.",
      parameters: {
        type: "object",
        properties: {
          code: { type: "string", description: "The code to run and fix" },
          language: { type: "string", description: "Programming language: python, javascript, typescript (default: python)" },
          context: { type: "string", description: "What the code is supposed to do (helps with better fixes)" }
        },
        required: ["code"]
      }
    }
  },
  // \u2500\u2500 TIER 5: FACE-LOCK \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  {
    type: "function",
    function: {
      name: "face_lock",
      description: "Control the Face-Lock security system. Auto-locks PC when Mughees walks away; unlocks when his face is confirmed. Use for: 'enable face lock', 'turn on face lock', 'disable face lock', 'face lock status', 'lock my pc', 'register my face'.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["enable", "disable", "status", "lock_now", "register_face"],
            description: "Action to perform"
          },
          lock_delay_seconds: {
            type: "number",
            description: "Seconds of absence before auto-lock (default: 15)"
          }
        },
        required: ["action"]
      }
    }
  },
  // \u2500\u2500 TIER 5: INTRUDER SNAPSHOTS \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  {
    type: "function",
    function: {
      name: "security_snapshots",
      description: "View intruder snapshots and security event log. Use for 'show intruder photos', 'who was at my PC', 'security log', 'any intruders?'.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["list_snapshots", "security_log"],
            description: "What to retrieve"
          }
        },
        required: ["action"]
      }
    }
  },
  // ── TIER 6: MORNING BRIEFING ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "get_morning_brief",
      description: "Generate an enhanced daily briefing with weather, news, schedule, and an inspirational quote. Use when user says 'good morning', 'run my briefing', 'give me a morning report'.",
      parameters: { type: "object", properties: {} }
    }
  },
  // ── TIER 6: SMART HOME CONTROL ────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "smart_home_control",
      description: "Control smart home devices like lights, AC, and locks. Also supports scenes like 'work', 'sleep', or 'away'. Use for 'turn off lights', 'set AC to 22 degrees', 'I am going to bed', 'start work mode'.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["on", "off", "set", "scene", "status"], description: "Action to perform" },
          device_id: { type: "string", description: "Target device (e.g. living_room_light, ac_unit)" },
          params: { type: "object", description: "Parameters like {temp: 22} or {brightness: 80}" },
          scene: { type: "string", enum: ["work", "sleep", "away"], description: "Scene name if action is 'scene'" }
        },
        required: ["action"]
      }
    }
  },
  // ── TIER 7: PERSONALITY MODE ──────────────────────────────────────────────
  {
    type: "function",
    function: {
      name: "set_personality_mode",
      description: "Switch the AI personality mode between FOCUS, CASUAL, and EMERGENCY. Use when user says 'engage focus mode', 'let's be casual', 'emergency state', 'change personality'.",
      parameters: {
        type: "object",
        properties: {
          mode: { type: "string", enum: ["FOCUS", "CASUAL", "EMERGENCY"], description: "The mode to engage" }
        },
        required: ["mode"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "optimize_system_resources",
      description: "Flush standby memory and clear system junk to improve AI response speed. Use when the system feels slow or RAM is high.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];






// ─── TTS Generator ───────────────────────────────────────────────────────────
async function requestTTS(text, pitch = '+0Hz', rate = '+0%') {
  const ttsInstance = new MsEdgeTTS();

  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      console.warn(`[TTS] Timeout for: "${text.substring(0, 30)}..."`);
      resolve({ error: 'TTS timeout' });
    }, 25000);


    try {
      await ttsInstance.setMetadata('en-US-AvaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

      const { audioStream } = ttsInstance.toStream(text, { pitch, rate });
      const buffers = [];

      audioStream.on('data', (chunk) => {
        if (chunk) buffers.push(chunk);
      });

      audioStream.on('end', () => {
        clearTimeout(timeout);
        const fullBuffer = Buffer.concat(buffers);
        if (fullBuffer.length > 0) {
          console.log(`[TTS] Generated ${fullBuffer.length} bytes for: "${text.substring(0, 30)}..."`);
          resolve({ audio: fullBuffer });
        } else {
          console.warn(`[TTS] Generated empty audio for: "${text}"`);
          resolve({ error: 'Empty audio buffer' });
        }
      });

      audioStream.on('error', (err) => {
        clearTimeout(timeout);
        console.error('[TTS] Stream error:', err.message || err);
        resolve({ error: 'TTS stream error: ' + (err.message || 'Unknown') });
      });
    } catch (e) {
      clearTimeout(timeout);
      console.error('[TTS] Request initialization failed:', e.message || e);
      resolve({ error: 'TTS init failed: ' + (e.message || 'Unknown') });
    }
  });
}

// ─── Sentence Splitter ───────────────────────────────────────────────────────
function splitIntoSentences(buffer) {
  const sentenceRegex = /([.!?])\s+/;
  const match = buffer.match(sentenceRegex);
  if (match) {
    return { sentence: buffer.slice(0, match.index + 1).trim(), rest: buffer.slice(match.index + match[0].length) };
  }
  if (buffer.length > 50) {
    const commaMatch = buffer.match(/[,;]\s+/);
    if (commaMatch) {
      return { sentence: buffer.slice(0, commaMatch.index + 1).trim(), rest: buffer.slice(commaMatch.index + commaMatch[0].length) };
    }
  }
  return null;
}

// ─── HTTP Endpoints ──────────────────────────────────────────────────────────
// ─── Tactical Uplink Endpoint ────────────────────────────────────────────────
app.post('/upload', upload.array('artifacts'), (req, res) => {
  try {
    const files = req.files;
    console.log(`[UPLINK] Received ${files.length} artifacts.`);

    const manifest = files.map(f => ({
      name: f.originalname,
      path: f.path,
      size: f.size,
      mimetype: f.mimetype
    }));

    res.json({
      success: true,
      message: "Artifacts secured in tactical storage.",
      manifest: manifest
    });
  } catch (err) {
    console.error("[UPLINK] Upload failed:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    tts: ttsReady ? 'ready' : 'starting',
    sidecar: sidecarReady ? 'ready' : 'starting',
    vector_memory: vectorMemoryReady ? 'ready' : 'starting',
    local_llm: localLLMReady ? 'ready' : 'offline',
    process_mon: processMonReady ? 'ready' : 'starting',
    clipboard: clipboardReady ? 'ready' : 'starting',
    file_watcher: fileWatcherReady ? 'ready' : 'starting',
    sys_health: sysHealthReady ? 'ready' : 'starting'
  });
});

// ─── Tier 2: Inbound Alert Endpoints (called BY the Python sidecars) ─────

// System alerts from process_monitor.py (RAM/CPU/Break reminder)
app.post('/system/alert', (req, res) => {
  const { type, message, data } = req.body;
  console.log(`[SYSTEM_ALERT] ${type}: ${message?.substring(0, 80)}`);
  io.emit('system_alert', { type, message, data });
  io.emit('neural_log', { content: `System: ${message}` });
  res.sendStatus(200);
});

// Clipboard events from clipboard_daemon.py
app.post('/clipboard/event', (req, res) => {
  const event = req.body;
  console.log(`[CLIPBOARD] ${event.type}: ${event.analysis?.substring(0, 60)}`);
  io.emit('clipboard_event', event);

  if (globalProactive) {
    globalProactive.handleClipboardEvent(event);
  }

  res.sendStatus(200);
});

// File events from file_watcher.py
app.post('/files/event', (req, res) => {
  const event = req.body;
  console.log(`[FILE_WATCHER] ${event.category?.toUpperCase()}: ${event.filename}`);
  io.emit('file_event', event);
  io.emit('neural_log', { content: `Files: ${event.message}` });

  if (globalProactive) {
    globalProactive.handleFileEvent(event);
  }

  res.sendStatus(200);
});

// System Health HUD proxy — frontend polls this every 2s
app.get('/health/hud', async (req, res) => {
  if (!sysHealthReady) return res.json({ success: false, error: 'Health monitor offline' });
  try {
    const r = await fetch(`${SYS_HEALTH_URL}/health/summary`);
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Process list proxy
app.get('/process/list', async (req, res) => {
  if (!processMonReady) return res.json({ success: false, processes: [] });
  try {
    const r = await fetch(`${PROCESS_MON_URL}/process/list`);
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, processes: [] });
  }
});

// Kill process proxy
app.post('/process/kill', async (req, res) => {
  if (!processMonReady) return res.json({ success: false, error: 'Process monitor offline' });
  try {
    const r = await fetch(`${PROCESS_MON_URL}/process/kill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// Autonomous task proxy
app.post('/task/run', async (req, res) => {
  try {
    const r = await fetch(`${SIDECAR_URL.replace('3002', '3002')}/task/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/task/status', async (req, res) => {
  try {
    const r = await fetch(`${SIDECAR_URL}/task/status`);
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// File watcher study queue proxy
app.get('/files/study_queue', async (req, res) => {
  if (!fileWatcherReady) return res.json({ success: true, queue: [] });
  try {
    const r = await fetch(`${FILE_WATCHER_URL}/files/study_queue`);
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, queue: [] });
  }
});

// ─── Tier 4: Alarm Endpoints ─────────────────────────────────────────────────

// Inbound: Python alarm_scheduler.py fires this when an alarm triggers
app.post('/alarm/fire', (req, res) => {
  const { id, label } = req.body;
  console.log(`[ALARM] 🔔 Fired — #${id}: ${label}`);
  // Broadcast to all connected sockets
  io.emit('alarm_fired', { id, label, timestamp: new Date().toISOString() });
  io.emit('neural_log', { content: `Alarm: ${label}` });
  // Speak it through ZAIRE voice
  io.emit('speak_text', { text: label });
  res.sendStatus(200);
});

// REST proxy: list all active alarms
app.get('/alarm/list', async (req, res) => {
  if (!alarmReady) return res.json({ success: true, alarms: [] });
  try {
    const r = await fetch(`${ALARM_URL}/alarm/list`);
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, alarms: [] });
  }
});

// REST proxy: delete an alarm
app.post('/alarm/delete', async (req, res) => {
  if (!alarmReady) return res.json({ success: false, error: 'Alarm scheduler offline' });
  try {
    const r = await fetch(`${ALARM_URL}/alarm/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// REST proxy: snooze an alarm
app.post('/alarm/snooze', async (req, res) => {
  if (!alarmReady) return res.json({ success: false, error: 'Alarm scheduler offline' });
  try {
    const r = await fetch(`${ALARM_URL}/alarm/snooze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
});

// ─── Tier 5: Security Endpoints ───────────────────────────────────────────────────

// Inbound: face_security.py calls this when an intruder is captured
app.post('/security/intruder', (req, res) => {
  const { timestamp, snapshot, snapshot_b64 } = req.body;
  console.log(`[SECURITY] 🚨 Intruder event at ${timestamp}`);
  io.emit('intruder_detected', {
    timestamp,
    snapshot,
    snapshot_b64: snapshot_b64 || '',
  });
  io.emit('neural_log', { content: '🚨 SECURITY ALERT: Unknown face detected at your PC!' });
  io.emit('speak_text', { text: 'Security alert, sir. Unknown face detected at your PC. Photo captured and alert dispatched.' });
  res.sendStatus(200);
});

// Proxy helpers for security endpoints
const _secProxy = async (path, method, body, res) => {
  if (!securityReady) return res.json({ success: false, error: 'Security daemon offline' });
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${SECURITY_URL}${path}`, opts);
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
};

app.post('/security/start', (req, res) => _secProxy('/security/start', 'POST', req.body, res));
app.post('/security/stop', (req, res) => _secProxy('/security/stop', 'POST', {}, res));
app.post('/security/register', (req, res) => _secProxy('/security/register', 'POST', req.body, res));

// Tier 7: HUD Live Telemetry Broadcast ───────────────────────────────────
setInterval(async () => {
  if (sysHealthReady) {
    try {
      const res = await fetch(`${SYS_HEALTH_URL}/health/snapshot`);
      const data = await res.json();
      if (data.success) {
        io.emit('system_metrics', {
          cpu: data.cpu.percent,
          ram: data.ram.percent,
          gpu: data.gpu[0]?.load_percent || 0,
          latency: 4 // Placeholder for local loopback
        });
      }
    } catch (e) { /* silent */ }
  }
}, 2000);

app.get('/security/status', (req, res) => _secProxy('/security/status', 'GET', null, res));
app.get('/security/video_feed', async (req, res) => {
  if (!securityReady) return res.status(503).send('Security daemon offline');
  try {
    const r = await fetch(`${SECURITY_URL}/security/video_feed`);
    if (!r.ok) return res.status(r.status).send('Daemon error');

    // Set appropriate headers for MJPEG stream
    res.setHeader('Content-Type', 'multipart/x-mixed-replace; boundary=frame');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const { Readable } = require('stream');
    Readable.fromWeb(r.body).pipe(res);
  } catch (e) {
    console.error('[VIDEO_PROXY_ERR]', e.message);
    res.status(500).send(e.message);
  }
});
app.get('/security/snapshots', (req, res) => _secProxy('/security/snapshots', 'GET', null, res));
app.get('/security/log', (req, res) => _secProxy('/security/log', 'GET', null, res));
app.post('/security/lock_now', (req, res) => _secProxy('/security/lock_now', 'POST', {}, res));
app.post('/security/test_intruder', (req, res) => _secProxy('/security/test_intruder', 'POST', {}, res));
app.post('/security/toggle_system', (req, res) => _secProxy('/security/toggle_system', 'POST', req.body, res));

// ─── Tier 6: Smart Home Proxies ──────────────────────────────────────────────────
const _smartProxy = async (path, method, body, res) => {
  if (!smartHomeReady) return res.json({ success: false, error: 'Smart Home hub offline' });
  try {
    const opts = { method, headers: { 'Content-Type': 'application/json' } };
    if (body) opts.body = JSON.stringify(body);
    const r = await fetch(`${SMART_HOME_URL}${path}`, opts);
    res.json(await r.json());
  } catch (e) {
    res.json({ success: false, error: e.message });
  }
};

app.get('/smart/devices', (req, res) => _smartProxy('/devices', 'GET', null, res));
app.post('/smart/control', (req, res) => _smartProxy('/control', 'POST', req.body, res));
app.post('/smart/scene', (req, res) => _smartProxy('/scene', 'POST', req.body, res));


// ─── Vector Memory REST Proxy ──────────────────────────────────────────────

// Allows the frontend to interact with ChromaDB via the Node.js server

app.post('/memory/store', async (req, res) => {
  try {
    const { text, tag } = req.body;
    if (!vectorMemoryReady) return res.json({ success: false, error: 'Vector memory offline' });
    const r = await fetch(`${VECTOR_MEM_URL}/memory/store`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, tag: tag || 'general' })
    });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post('/memory/recall', async (req, res) => {
  try {
    const { query, n } = req.body;
    if (!vectorMemoryReady) return res.json({ success: true, results: [] });
    const r = await fetch(`${VECTOR_MEM_URL}/memory/recall`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, n: n || 5 })
    });
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/memory/vector/all', async (req, res) => {
  try {
    if (!vectorMemoryReady) return res.json({ success: true, facts: [] });
    const r = await fetch(`${VECTOR_MEM_URL}/memory/all`);
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/memory/vector/count', async (req, res) => {
  try {
    if (!vectorMemoryReady) return res.json({ facts: 0, study: 0 });
    const r = await fetch(`${VECTOR_MEM_URL}/memory/count`);
    res.json(await r.json());
  } catch (e) {
    res.status(500).json({ facts: 0, study: 0 });
  }
});

// ─── Local LLM Status Proxy ────────────────────────────────────────────────
app.get('/llm/status', async (req, res) => {
  try {
    if (!localLLMReady) return res.json({ status: 'offline', ollama: false });
    const r = await fetch(`${LOCAL_LLM_URL}/llm/health`);
    res.json(await r.json());
  } catch (e) {
    res.json({ status: 'offline' });
  }
});


app.get('/llm/models', async (req, res) => {
  try {
    if (!localLLMReady) return res.json({ models: [] });
    const r = await fetch(`${LOCAL_LLM_URL}/llm/models`);
    res.json(await r.json());
  } catch (e) {
    res.json({ models: [], error: e.message });
  }
});

// TTS endpoint - more reliable than socket for audio transfer
app.post('/tts', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { text, pitch = '+0Hz', rate = '+5%' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const result = await requestTTS(text, pitch, rate);

    if (result.error) {
      return res.status(500).json({ error: result.error });
    }

    res.set('Content-Type', 'audio/mpeg');
    res.send(result.audio);
  } catch (err) {
    console.error('[TTS HTTP] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Memory constants
const MEMORY_FILE = path.join(__dirname, 'memory', 'zaire_memory.json');
const CONFIG_FILE = path.join(__dirname, 'memory', 'system_config.json');
const SECRETS_FILE = path.join(__dirname, 'memory', 'api_secrets.json');

function readSystemConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE)) return {};
    const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(data || '{}');
  } catch (err) {
    console.error('[CONFIG] Failed to read system config:', err.message);
    return {};
  }
}

function writeSystemConfig(nextConfig) {
  try {
    if (!fs.existsSync(path.dirname(CONFIG_FILE))) {
      fs.mkdirSync(path.dirname(CONFIG_FILE), { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(nextConfig, null, 2));
    return true;
  } catch (err) {
    console.error('[CONFIG] Failed to write system config:', err.message);
    return false;
  }
}

function sanitizeApiSlots(slots = []) {
  const validProviders = new Set([
    'Empty',
    'Groq',
    'OpenAI',
    'Anthropic',
    'Google Gemini',
    'DeepSeek',
    'Azure OpenAI',
    'Cohere',
    'Mistral',
    'SiliconFlow'
  ]);
  return (Array.isArray(slots) ? slots : [])
    .slice(0, 3)
    .map((slot, idx) => {
      const provider = validProviders.has(slot?.provider) ? slot.provider : 'Empty';
      return {
        slot: idx + 1,
        provider,
        apiKey: String(slot?.apiKey || '').trim(),
        hasKey: Boolean(slot?.hasKey),
        model: String(slot?.model || 'Auto').trim() || 'Auto',
        purpose: String(slot?.purpose || 'Fallback').trim() || 'Fallback',
        baseUrl: String(slot?.baseUrl || '').trim(),
        enabled: Boolean(slot?.enabled ?? (provider !== 'Empty'))
      };
    });
}

function loadSecrets() {
  try {
    if (!fs.existsSync(SECRETS_FILE)) return { version: 1, slots: {} };
    return JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf-8'));
  } catch {
    return { version: 1, slots: {} };
  }
}

function saveSecrets(data) {
  try {
    if (!fs.existsSync(path.dirname(SECRETS_FILE))) fs.mkdirSync(path.dirname(SECRETS_FILE), { recursive: true });
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

function dpapiEncrypt(plain) {
  if (!plain) return '';
  const script = "$s=ConvertTo-SecureString -String $env:ZAIRE_SECRET -AsPlainText -Force; ConvertFrom-SecureString -SecureString $s";
  return execFileSync('powershell', ['-NoProfile', '-Command', script], {
    encoding: 'utf-8',
    env: { ...process.env, ZAIRE_SECRET: plain }
  }).trim();
}

function dpapiDecrypt(cipher) {
  if (!cipher) return '';
  const script = "$s=ConvertTo-SecureString $env:ZAIRE_CIPHER; $b=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($s); [Runtime.InteropServices.Marshal]::PtrToStringAuto($b)";
  return execFileSync('powershell', ['-NoProfile', '-Command', script], {
    encoding: 'utf-8',
    env: { ...process.env, ZAIRE_CIPHER: cipher }
  }).trim();
}

function persistAiVaultSlots(slots = []) {
  const clean = sanitizeApiSlots(slots);
  const secrets = loadSecrets();
  const out = [];
  for (let i = 0; i < clean.length; i++) {
    const s = clean[i];
    if (s.apiKey) {
      try {
        secrets.slots[String(i)] = { key: dpapiEncrypt(s.apiKey), provider: s.provider, updatedAt: new Date().toISOString() };
      } catch (err) {
        console.error('[SECRETS] Encrypt failed:', err.message);
      }
    } else if (s.hasKey) {
      // Keep existing encrypted key when slot is unchanged in UI
    } else {
      delete secrets.slots[String(i)];
    }
    out.push({ ...s, apiKey: '' });
  }
  saveSecrets(secrets);
  return out;
}

function hydrateRuntimeProviders() {
  const cfg = readSystemConfig();
  const slots = sanitizeApiSlots(cfg?.aiVault?.slots || []);
  const secrets = loadSecrets();
  return slots.map((s, i) => {
    const enc = secrets.slots?.[String(i)]?.key || '';
    let key = '';
    if (enc) {
      try { key = dpapiDecrypt(enc); } catch (err) { console.error('[SECRETS] Decrypt failed:', err.message); }
    }
    return { ...s, apiKey: key };
  });
}

// Memory endpoints (for the UI)
app.get('/memories', (req, res) => {
  res.json(getAllMemories(20));
});

// System Config endpoints
app.get('/config', (req, res) => {
  try {
    const cfg = readSystemConfig();
    res.json({ success: true, data: cfg });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/llm/providers', (req, res) => {
  try {
    const cfg = readSystemConfig();
    const slots = sanitizeApiSlots(cfg?.aiVault?.slots || []);
    const runtime = hydrateRuntimeProviders();
    const masked = slots.map((s) => ({
      ...s,
      apiKey: '',
      hasKey: Boolean(runtime[s.slot - 1]?.apiKey)
    }));
    res.json({ success: true, slots: masked });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/llm/providers', (req, res) => {
  try {
    const slots = sanitizeApiSlots(req.body?.slots || []);
    const persistedSlots = persistAiVaultSlots(slots);
    const prev = readSystemConfig();
    const next = {
      ...prev,
      aiVault: {
        ...(prev.aiVault || {}),
        slots: persistedSlots,
        updatedAt: new Date().toISOString()
      }
    };
    const ok = writeSystemConfig(next);
    if (!ok) return res.status(500).json({ success: false, error: 'Failed to persist provider slots' });
    return res.json({ success: true, slotsCount: slots.length });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/llm/runtime-providers', (req, res) => {
  try {
    const slots = hydrateRuntimeProviders();
    res.json({ success: true, slots });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/memories/:id', (req, res) => {
  const id = parseInt(req.params.id);
  res.json(forgetMemory(id));
});

// ─── Chat History Endpoints ────────────────────────────────────────────────
app.get('/chats', (req, res) => {
  res.json({ success: true, sessions: chatHistoryService.getSessions() });
});

app.get('/chats/:id', (req, res) => {
  const session = chatHistoryService.getSession(req.params.id);
  if (session) {
    res.json({ success: true, session });
  } else {
    res.status(404).json({ success: false, message: 'Session not found' });
  }
});

app.delete('/chats/:id', (req, res) => {
  const success = chatHistoryService.deleteSession(req.params.id);
  res.json({ success });
});

app.put('/chats/:id', (req, res) => {
  const { title } = req.body;
  const success = chatHistoryService.renameSession(req.params.id, title);
  res.json({ success });
});
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // RESET BRAIN: Start each session with a fresh conversation history to save tokens
  let conversationHistory = [
    { role: 'system', content: BASE_SYSTEM_PROMPT }
  ];
  let currentSessionId = `session_${Date.now()}`;
  let activeMode = "ZAIRE";
  let traderPulseInterval = null;
  let professorTimeout = null;

  // Initialize session in persistent store
  chatHistoryService.saveSession({
    id: currentSessionId,
    title: 'Untitled Chat',
    messages: [],
    createdAt: new Date().toISOString()
  });

  const clearProfessorTimer = () => {
    if (professorTimeout) {
      console.log("[PROFESSOR] Clearing Socratic timer.");
      clearTimeout(professorTimeout);
      professorTimeout = null;
    }
  };

  const startProfessorTimer = () => {
    clearProfessorTimer();
    console.log("[PROFESSOR] Starting 120s Socratic timer...");
    professorTimeout = setTimeout(() => {
      console.log(`[PROFESSOR] Timeout reached. Triggering intervention for ${socket.id}`);
      handleUserMessage("TIMEOUT_INTERVENTION");
    }, 120000);
  };

  socket.emit('zaire_status', 'ready');
  socket.emit('MODE_SYNC', { mode: activeMode });

  const handleNeuralInterrupt = async (data) => {
    const { text, type } = data;
    console.log(`[INTERRUPT] ${type}: ${text}`);

    // Play proactive speech immediately
    requestTTS(text).then(audioRes => {
      if (audioRes.audio) {
        socket.emit('audio_chunk', { index: 0, audio: audioRes.audio, isBase64: false });
        socket.emit('ai_text_delta', text);
        socket.emit('neural_interrupt', { text, type }); // Notify client to show text
        setTimeout(() => socket.emit('ai_text_complete', { fullText: text }), 5000);
      }
    }).catch(err => console.error('[TTS ERR] Neural interrupt failed:', err.message));
  };

  // Initialize Proactive Intelligence for this session
  if (globalProactive) globalProactive.stop();

  if (typeof ProactiveService === 'function') {
    const proactiveGroq = ensureGroqClient();
    if (proactiveGroq) {
      globalProactive = new ProactiveService(socket, proactiveGroq, handleNeuralInterrupt);
      globalProactive.start();
    } else {
      console.warn('[AGENT] ProactiveService paused. Groq client not configured in AI Vault.');
    }
  } else {
    console.warn('[AGENT] ProactiveService not available. Background monitoring offline.');
  }

  socket.on('neural_interrupt', handleNeuralInterrupt);

  socket.on('REQUEST_SYNC', () => {
    socket.emit('MODE_SYNC', { mode: activeMode });
  });

  socket.on('clear_chat', () => {
    conversationHistory = [conversationHistory[0]];
    currentSessionId = `session_${Date.now()}`;
    chatHistoryService.saveSession({
      id: currentSessionId,
      title: 'Untitled Chat',
      messages: [],
      createdAt: new Date().toISOString()
    });
    socket.emit('zaire_status', 'idle');
    socket.emit('session_started', { sessionId: currentSessionId });
  });

  socket.on('load_session', (data) => {
    const session = chatHistoryService.getSession(data.sessionId);
    if (session) {
      currentSessionId = session.id;
      // Rebuild conversation history with system prompt at the start
      conversationHistory = [
        { role: 'system', content: BASE_SYSTEM_PROMPT },
        ...session.messages
      ];
      socket.emit('session_loaded', session);
      socket.emit('neural_log', { content: `System: Session ${session.title} restored.` });
    }
  });

  socket.on('rename_session', (data) => {
    const { sessionId, title } = data;
    const success = chatHistoryService.renameSession(sessionId, title);
    if (success) {
      socket.emit('session_renamed', { sessionId, title });
      socket.emit('neural_log', { content: `System: Session renamed to "${title}".` });
    }
  });

  socket.on('new_chat', () => {
    conversationHistory = [conversationHistory[0]];
    currentSessionId = `session_${Date.now()}`;
    chatHistoryService.saveSession({
      id: currentSessionId,
      title: 'Untitled Chat',
      messages: [],
      createdAt: new Date().toISOString()
    });
    socket.emit('session_started', { sessionId: currentSessionId });
    socket.emit('neural_log', { content: "System: New neural session initialized." });
  });

  socket.on('MODE_CHANGE', async (data) => {
    const { mode } = data;
    activeMode = mode;
    console.log(`[MODE] Switching to ${mode}`);

    // Notify Python sidecar
    try {
      await fetch(`${SIDECAR_URL}/agent/set_mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode })
      });
    } catch (e) {
      console.error('[MODE] Failed to notify sidecar:', e.message);
    }

    // Activation lines
    const activationLines = {
      "ZAIRE": "Voice interface recalibrated. How can I help, sir?",
      "TRADER": "Trader mode engaged. Halal filter active. Binance connection standing by, sir.",
      "PROFESSOR": "Professor mode engaged. Ready to teach, Mughees. What shall we study today?",
      "ENGINEER": "Engineer mode engaged. Full stack developer online. What are we building, sir?",
      "SWARM": "Sovereign Master Protocol engaged. All specialists are standing by for global sync.",
      "SETTINGS": "System calibration mode active. Ready for HUD reconfiguration."
    };

    const line = activationLines[mode] || activationLines["ZAIRE"];
    socket.emit('ai_text_delta', line);
    socket.emit('ai_text_complete', { fullText: line });

    requestTTS(line).then(audioRes => {
      if (audioRes.audio) {
        socket.emit('audio_chunk', { index: 0, audio: audioRes.audio, isBase64: false });
      }
    }).catch(err => console.error('[TTS ERR] Activation line failed:', err.message));

    // CLEANUP PREVIOUS INTERVALS
    if (traderPulseInterval) {
      clearInterval(traderPulseInterval);
      traderPulseInterval = null;
    }

    // ── HUD TELEMETRY SYNC — THE STARK PULSE ──
    if (mode !== "ZAIRE") {
      const fetchSpecialistData = async () => {
        try {
          const res = await fetch(`${SIDECAR_URL}/agent/mode_data?mode=${mode}`);
          const status = await res.json();
          if (status.success) {
            socket.emit('SPECIALIST_DATA', { mode, data: status.data });
            if (mode === 'TRADER') socket.emit('TRADER_STATUS', status.data);
          }
        } catch (e) { }
      };
      fetchSpecialistData();
      traderPulseInterval = setInterval(fetchSpecialistData, 5000);
    }

    if (mode === "PROFESSOR") startProfessorTimer();
    else clearProfessorTimer();
  });

  socket.on('SPECIALIST_ACTION', async (data) => {
    const { mode, action, payload } = data;
    console.log(`[ACTION] specialist=${mode} action=${action}`, payload);
    try {
      await fetch(`${SIDECAR_URL}/agent/specialist_action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, action, payload })
      });
      socket.emit('neural_log', { content: `System: Action ${action} executed by ${mode} specialist.` });
    } catch (e) {
      console.error('[ACTION] Failed to notify sidecar:', e.message);
    }
  });

  socket.on('SAVE_CONFIG', async (config) => {
    console.log(`[CONFIG] Persisting ZAIRE configuration to core...`);
    try {
      const prev = readSystemConfig();
      const next = { ...prev, ...(config || {}) };
      if (config?.aiVault?.slots) {
        const persistedSlots = persistAiVaultSlots(config.aiVault.slots);
        next.aiVault = {
          ...(prev.aiVault || {}),
          ...(config.aiVault || {}),
          slots: persistedSlots,
          updatedAt: new Date().toISOString()
        };
        groq = tryBuildGroqClient();
      }
      writeSystemConfig(next);
      socket.emit('neural_log', { content: "System: ZAIRE Configuration persisted to neural core." });
    } catch (err) {
      console.error(`[CONFIG ERR] Failed to save:`, err.message);
    }
  });

  socket.on('QUICK_ACTION', async ({ action }) => {
    console.log(`[QUICK] Triggered action: ${action}`);
    try {
      switch (action) {
        case 'capture':
          socket.emit('neural_log', { content: "System: Capturing ZAIRE vision snapshot..." });
          exec('powershell -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'{PRTSC}\')"');
          break;
        case 'browser':
          socket.emit('neural_log', { content: "System: Tactical Uplink established (Browser)." });
          exec('start https://www.google.com');
          break;
        case 'files':
          socket.emit('neural_log', { content: "System: Mounting local file systems..." });
          exec('explorer .');
          break;
        default:
          console.log(`[QUICK] Unknown action: ${action}`);
      }
    } catch (err) {
      console.error(`[QUICK ERR] Action ${action} failed:`, err.message);
    }
  });

  const handleUserMessage = async (text, payload = {}) => {
    const { artifactTokens = [], responseDepth = 'TURBO' } = payload;
    console.log(`[DEBUG] Received user_message with ${artifactTokens.length} artifacts and ${responseDepth} depth:`, artifactTokens);
    if (!text || !text.trim()) return;
    const userText = text.trim();
    console.log(`[${socket.id}] User: ${userText}`);

    clearProfessorTimer();

    // Stop any existing audio on the client immediately
    socket.emit('stop_audio');
    socket.emit('zaire_status', 'thinking');


    // 1. Model Routing Logic
    const agentKeywords = ['look', 'screen', 'see', 'move', 'click', 'type', 'vision'];
    const isAgentTask = agentKeywords.some(kw => userText.toLowerCase().includes(kw));

    const deepThinkKeywords = ['deep think', 'advanced reasoning', 'analyze complex', 'deep reasoning'];
    const isDeepThinkTask = deepThinkKeywords.some(kw => userText.toLowerCase().includes(kw)) || responseDepth === 'THINKER';

    if (isDeepThinkTask) {
      console.log(`[ROUTER] Routing to AirLLM Deep Intelligence...`);
      socket.emit('zaire_status', 'deep_thinking');
      socket.emit('neural_log', { content: "ENGAGING 70B NEURAL CORES // LAYER-WISE OFFLOADING ACTIVE" });

      try {
        const res = await fetch('http://127.0.0.1:3006/deep/think', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userText.replace(/deep think:?/i, '').trim() })
        });
        const data = await res.json();

        if (data.success) {
          socket.emit('zaire_status', 'speaking');
          socket.emit('zaire_response_stream', data.content);
          // Stream text to Speech
          const ttsRes = await fetch('http://127.0.0.1:3001/tts/stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: data.content })
          });
          const audioData = await ttsRes.arrayBuffer();
          socket.emit('audio_chunk', { audio: Buffer.from(audioData).toString('base64'), index: 0 });
        } else {
          socket.emit('zaire_response_stream', "Deep reasoning failed: " + data.error);
        }
      } catch (err) {
        socket.emit('zaire_response_stream', "Error engaging deep cores: " + err.message);
      }
      return;
    }

    if (isAgentTask) {
      console.log(`[ROUTER] Routing to Local Agent...`);
      socket.emit('zaire_status', 'agent_thinking');

      try {
        const agentUrl = userText.includes('screen')
          ? 'http://127.0.0.1:3002/agent/vision'
          : 'http://127.0.0.1:3002/agent/chat';

        console.log(`[DEBUG] Final Agent URL: ${agentUrl}`);
        const res = await fetch(agentUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: userText, context: "User is asking for direct system interaction.", response_depth: responseDepth })
        });

        console.log(`[DEBUG] Agent Response Status: ${res.status}`);
        if (res.status === 404) {
          console.warn(`[DEBUG] 404 detected from ${agentUrl}. Headers:`, Object.fromEntries(res.headers));
        }

        if (!res.body) throw new Error("No stream content from agent");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";
        let sentenceBuffer = "";
        let audioIndex = 0;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          fullResponse += chunk;
          sentenceBuffer += chunk;

          // HUD updates
          socket.emit('ai_text_delta', chunk);

          // Sentence-based TTS for zero perceived latency
          let split;
          while ((split = splitIntoSentences(sentenceBuffer)) !== null) {
            const sentence = split.sentence;
            sentenceBuffer = split.rest;

            // CRITICAL: Reserve index before async call
            const currentIndex = audioIndex++;
            requestTTS(sentence).then(audioRes => {
              if (audioRes.audio) {
                socket.emit('audio_chunk', { index: currentIndex, audio: audioRes.audio, isBase64: false });
              }
            });
          }
        }

        if (sentenceBuffer.trim()) {
          const currentIndex = audioIndex++;
          requestTTS(sentenceBuffer.trim()).then(audioRes => {
            if (audioRes.audio) {
              socket.emit('audio_chunk', { index: currentIndex, audio: audioRes.audio, isBase64: false });
            }
          });
        }

        socket.emit('ai_text_complete', { fullText: fullResponse });
        socket.emit('zaire_status', 'idle');

        conversationHistory.push({ role: 'user', content: userText });
        conversationHistory.push({ role: 'assistant', content: fullResponse });
        return;

      } catch (err) {
        console.error('[ROUTER] Agent failed:', err.message);
        socket.emit('ai_text_delta', "Unfortunately, sir, the local vision daemon is still initializing. Please wait a moment and try again.");
        socket.emit('ai_text_complete', { fullText: "Unfortunately, sir, the local vision daemon is still initializing. Please wait a moment and try again." });
        socket.emit('zaire_status', 'idle');
        return;
      }
    }

    // ── 1.5 Specialist Routing ──
    if (activeMode !== "ZAIRE") {
      console.log(`[ROUTER] Routing to Specialist ${activeMode}...`);
      try {
        const uploaded_filepath = artifactTokens.length > 0 ? artifactTokens[0].path : null;
        const res = await fetch(`${SIDECAR_URL}/agent/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: userText,
            context: activeMode,
            manifest: artifactTokens,
            uploaded_filepath: uploaded_filepath,
            response_depth: responseDepth
          })
        });

        if (!res.body) throw new Error("No response from specialist");
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullResponse = "";

        // Specialists currently return non-streaming text in one block 
        // but we'll loop just in case we upgrade later
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullResponse += chunk;
          socket.emit('ai_text_delta', chunk);
        }

        // Specialist Error Handling
        if (fullResponse.includes('[SERVICE_ERROR]')) {
          console.error(`[ROUTER] Specialist service error: ${fullResponse}`);
          const politeError = "Sir, the neural link to that specialist is temporarily unstable. Attempting reconnection...";

          socket.emit('ai_error', { message: fullResponse });
          socket.emit('ai_text_delta', politeError);

          requestTTS("Sir, the neural link is temporarily unstable.").then(audioRes => {
            if (audioRes.audio) {
              socket.emit('audio_chunk', { index: 0, audio: audioRes.audio, isBase64: false });
            }
          });

          socket.emit('ai_text_complete', { fullText: politeError });
          socket.emit('zaire_status', 'idle');
          return;
        }

        requestTTS(fullResponse).then(audioRes => {
          if (audioRes.audio) {
            socket.emit('audio_chunk', { index: 0, audio: audioRes.audio, isBase64: false });
          }
        });

        socket.emit('ai_text_complete', { fullText: fullResponse });
        socket.emit('zaire_status', 'idle');

        if (activeMode === "PROFESSOR" && fullResponse.includes("[SOCRATIC_QUESTION]")) {
          startProfessorTimer();
        }

        // Sync to global history
        conversationHistory.push({ role: 'user', content: userText });
        conversationHistory.push({ role: 'assistant', content: fullResponse });
        return;

      } catch (err) {
        console.error('[ROUTER] Specialist failed:', err.message);
        socket.emit('ai_error', "The specialist module is not responding, sir.");
        socket.emit('zaire_status', 'idle');
        return;
      }
    }

    // ── 2. Standard Groq Flow ──

    // Build memory context: flat JSON + vector semantic recall
    let memoryContext = buildMemoryContext(userText);

    // Tier 1: Inject vector memory context if online
    if (vectorMemoryReady) {
      try {
        const vmRes = await fetch(`${VECTOR_MEM_URL}/memory/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: userText, include_study: false })
        });
        if (vmRes.ok) {
          const vmData = await vmRes.json();
          if (vmData.context) {
            memoryContext = vmData.context + '\n\n' + memoryContext;
          }
        }
      } catch (vmErr) {
        // Non-critical — continue without vector context
      }
    }

    // ── TIER 7: Mood Detection ──
    const lowerText = userText.toLowerCase();
    let detectedMood = currentSystemMood;
    if (['angry', 'fast', 'quick', 'hurry', 'hate', 'stupid', 'urgent'].some(w => lowerText.includes(w))) detectedMood = 'ALERT';
    else if (['happy', 'cool', 'nice', 'great', 'wow', 'good', 'love'].some(w => lowerText.includes(w))) detectedMood = 'HAPPY';
    else if (['sad', 'tired', 'bored', 'lonely', 'exhausted', 'rip'].some(w => lowerText.includes(w))) detectedMood = 'CALM';
    else if (['working', 'study', 'focus', 'project', 'meeting', 'exam'].some(w => lowerText.includes(w))) detectedMood = 'BUSY';
    currentSystemMood = detectedMood;

    const dynamicBase = BASE_SYSTEM_PROMPT
      .replace('{{MODE}}', currentPersonalityMode)
      .replace('{{MOOD}}', currentSystemMood);

    const augmentedSystemPrompt = dynamicBase + (memoryContext || "");

    // Update the system message with fresh memory context
    conversationHistory[0] = { role: 'system', content: augmentedSystemPrompt };

    // Include artifacts in user message if present
    let userMessageWithArtifacts = userText;
    if (artifactTokens && artifactTokens.length > 0) {
      const artifactList = artifactTokens.map(a => {
        if (typeof a === 'string') return a;
        return a.name || a.fileName || a.path || JSON.stringify(a);
      }).join(', ');
      userMessageWithArtifacts = `[USER UPLOADED ARTIFACTS: ${artifactList}]\n\n${userText}`;
    }

    conversationHistory.push({ role: 'user', content: userMessageWithArtifacts });

    // Persist user message
    const currentSession = chatHistoryService.getSession(currentSessionId);
    if (currentSession) {
      currentSession.messages.push({ role: 'user', content: userText, timestamp: new Date().toISOString() });
      chatHistoryService.saveSession(currentSession);
    }

    // AGGRESSIVE TOKEN PRUNING: Reduce window to 5 messages to stay under 100k TPD limit
    if (conversationHistory.length > 6) {
      conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-5)];
    }

    const groqClient = ensureGroqClient();
    if (!groqClient) {
      try {
        const fallbackRes = await fetch('http://127.0.0.1:3005/llm/smart_chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: conversationHistory,
            temperature: 0.7,
            max_tokens: 500
          })
        });
        const fallbackData = await fallbackRes.json();
        const content = fallbackData?.content || "Sir, no active provider responded. Please check AI Vault settings.";
        socket.emit('ai_text_delta', content);
        socket.emit('ai_text_complete', { fullText: content });
      } catch (_) {
        const missingProviderMsg = "Sir, no active core provider is available for this route yet. Please add an active provider key in Settings > AI Vault.";
        socket.emit('ai_error', { message: missingProviderMsg });
        socket.emit('ai_text_delta', missingProviderMsg);
        socket.emit('ai_text_complete', { fullText: missingProviderMsg });
      }
      socket.emit('zaire_status', 'idle');
      return;
    }

    try {
      // ── 2. First Pass: Tool Execution ──
      let response;
      try {
        response = await groqClient.chat.completions.create({
          messages: conversationHistory,
          model: LLM_MODEL,
          tools: TOOLS,
          tool_choice: "auto",
          temperature: 0,
        });
      } catch (err) {
        if (err.status === 429) {
          console.warn("[GROQ] Main model rate limited. Falling back to 8B...");
          response = await groqClient.chat.completions.create({
            messages: conversationHistory,
            model: FAST_MODEL,
            tools: TOOLS,
            tool_choice: "auto",
            temperature: 0,
          });
        } else {
          throw err;
        }
      }

      const responseMessage = response.choices[0].message;
      const toolCalls = responseMessage.tool_calls;

      if (toolCalls) {
        socket.emit('zaire_status', 'executing');
        conversationHistory.push(responseMessage);

        for (const toolCall of toolCalls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          let result = "Task acknowledged.";

          console.log(`[TOOL] ${name}`, args);

          // ── Existing Tools ──
          if (name === "open_website") {
            const res = await openWebsites(args.urls);
            result = JSON.stringify(res);

          } else if (name === "open_app") {
            const res = await openApp(args.app_name);
            result = JSON.stringify(res);

          } else if (name === "close_chrome_tabs") {
            const res = await closeChromeTabs(args.count, args.search_term);
            result = JSON.stringify(res);

          } else if (name === "get_desktop_info") {
            if (args.query_type === "folder_count") {
              const res = await countDesktopFolders();
              result = JSON.stringify(res);
            }

            // ── Screen Vision ──
          } else if (name === "analyze_screen") {
            socket.emit('zaire_status', 'scanning');
            const analysis = await analyzeScreen(args.question);
            result = JSON.stringify({ success: true, analysis });

            // ── Mouse Control ──
          } else if (name === "control_mouse") {
            let res;
            const { action, x, y, amount } = args;
            if (action === "move") {
              res = await moveMouse(x, y);
            } else if (action === "click") {
              res = await clickMouse(x, y, 'left', false);
            } else if (action === "double_click") {
              res = await clickMouse(x, y, 'left', true);
            } else if (action === "right_click") {
              res = await clickMouse(x, y, 'right', false);
            } else if (action === "scroll_up") {
              res = await scrollMouse(amount || 3);
            } else if (action === "scroll_down") {
              res = await scrollMouse(-(amount || 3));
            }
            socket.emit('system_action', { type: 'mouse', action, x, y });
            result = JSON.stringify(res || { success: true });

            // ── Keyboard ──
          } else if (name === "type_text") {
            const res = await typeText(args.text);
            socket.emit('system_action', { type: 'keyboard', text: args.text });
            result = JSON.stringify(res);

          } else if (name === "send_hotkey") {
            const res = await sendHotkey(args.keys);
            socket.emit('system_action', { type: 'hotkey', keys: args.keys });
            result = JSON.stringify(res);

            // ── Volume & Brightness ──
          } else if (name === "set_volume") {
            let res;
            if (args.action === "mute") {
              res = await toggleMute();
            } else {
              res = await adjustVolume(args.action, args.steps || 5);
            }
            result = JSON.stringify(res);

          } else if (name === "set_brightness") {
            const res = await setBrightness(args.level);
            result = JSON.stringify(res);

            // ── Persistent Memory ──
          } else if (name === "remember_this") {
            const res = rememberFact(args.fact);
            socket.emit('memory_stored', { text: args.fact, count: res.count });
            result = JSON.stringify(res);

          } else if (name === "recall_memories") {
            const memories = recallMemories(args.query, 5);
            result = JSON.stringify({ memories, count: memories.length });

            // ── Window Management & Snapshots ──
          } else if (name === "manage_window") {
            let res;
            if (args.action === "list") {
              res = await listWindows();
            } else if (args.action === "focus") {
              res = await focusWindow(args.title);
            } else if (args.action === "close") {
              res = await closeWindow(args.title);
            }
            result = JSON.stringify(res);

          } else if (name === "take_screenshot") {
            const res = await saveScreenshot();
            result = JSON.stringify(res);

          } else if (name === "file_management") {
            let res;
            if (args.action === "list") {
              res = await listFiles(args.path);
            } else if (args.action === "search") {
              res = await searchFiles(args.query, args.root);
            } else if (args.action === "open") {
              res = await openFile(args.path);
            }
            result = JSON.stringify(res);

          } else if (name === "media_control") {
            const res = await controlMedia(args.action);
            result = JSON.stringify(res);

          } else if (name === "update_task_list") {
            try {
              const tasksPath = path.join(__dirname, 'memory', 'tasks.json');
              fs.writeFileSync(tasksPath, JSON.stringify({ tasks: args.tasks }, null, 2));
              result = JSON.stringify({ success: true, message: `Updated ${args.tasks.length} tasks.` });
              socket.emit('neural_log', { content: `Task core updated with ${args.tasks.length} directives.` });
            } catch (err) {
              result = JSON.stringify({ success: false, error: err.message });
            }

          } else if (name === "get_current_time") {
            const now = new Date();
            const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
            result = JSON.stringify({ time: timeStr, timezone: 'PKT', fullDate: now.toDateString() });

            // ── Google Workspace Tools ──
          } else if (name === "google_calendar") {
            try {
              if (!oAuth2Client) {
                result = "Google integration not configured yet. Tell the user to visit /auth/google.";
              } else {
                const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
                if (args.action === "list") {
                  const res = await calendar.events.list({
                    calendarId: 'primary',
                    timeMin: (new Date()).toISOString(),
                    timeZone: 'Asia/Karachi',
                    maxResults: 10,
                    singleEvents: true,
                    orderBy: 'startTime',
                  });
                  result = JSON.stringify(res.data.items || []);
                } else if (args.action === "create") {
                  const startTime = new Date(args.time);
                  if (isNaN(startTime.getTime())) throw new Error("Invalid start time provided.");
                  const event = {
                    summary: args.title,
                    start: { dateTime: startTime.toISOString(), timeZone: 'Asia/Karachi' },
                    end: { dateTime: new Date(startTime.getTime() + 3600000).toISOString(), timeZone: 'Asia/Karachi' }
                  };
                  const res = await calendar.events.insert({ calendarId: 'primary', resource: event });
                  result = `Event created: ${res.data.htmlLink}`;
                }
              }
            } catch (err) {
              console.error('[GOOGLE CALENDAR] Error:', err.message);
              result = `Calendar error: ${err.message}`;
            }

          } else if (name === "google_gmail") {
            try {
              if (!oAuth2Client) {
                result = "Google integration not configured. Visit /auth/google.";
              } else {
                const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
                const res = await gmail.users.messages.list({ userId: 'me', q: args.query, maxResults: args.maxResults || 5 });
                const messages = [];
                if (res.data.messages) {
                  for (const msg of res.data.messages) {
                    const m = await gmail.users.messages.get({ userId: 'me', id: msg.id });
                    const snippet = m.data.snippet;
                    const headers = m.data.payload?.headers || [];
                    const subject = headers.find(h => h.name === 'Subject')?.value || 'No Subject';
                    messages.push({ subject, snippet });
                  }
                }
                result = JSON.stringify(messages);
              }
            } catch (err) {
              console.error('[GOOGLE GMAIL] Error:', err.message);
              result = `Gmail error: ${err.message}`;
            }
          } else if (name === "web_search") {
            try {
              const apiKey = process.env.TAVILY_API_KEY;
              if (!apiKey) throw new Error("TAVILY_API_KEY not found in .env");

              const response = await fetch('https://api.tavily.com/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  api_key: apiKey,
                  query: args.query,
                  search_depth: args.search_depth || "basic",
                  include_answer: true,
                  max_results: 5
                })
              });
              const data = await response.json();
              if (data.answer) {
                result = `Synthesized Answer: ${data.answer}\n\nSources:\n` +
                  data.results.map(r => `- ${r.title}: ${r.url}`).join('\n');
              } else {
                result = data.results.map(r => `[${r.title}](${r.url})\n${r.content}`).join('\n\n');
              }
              socket.emit('neural_log', { content: `Web Search: Synthesized intelligence for query "${args.query}".` });
            } catch (err) {
              result = `Search error: ${err.message}`;
            }

          } else if (name === "run_python_code") {
            try {
              const tempFile = path.join(__dirname, 'memory', `temp_script_${Date.now()}.py`);
              fs.writeFileSync(tempFile, args.code);
              const output = await new Promise((resolve) => {
                exec(`python "${tempFile}"`, (err, stdout, stderr) => {
                  if (err) resolve(`Error: ${stderr || err.message}`);
                  else resolve(stdout || "Code executed successfully with no output.");
                  try { fs.unlinkSync(tempFile); } catch (e) { }
                });
              });
              result = output;
              socket.emit('neural_log', { content: `Code Execution: Processed Python snippet.` });
            } catch (err) {
              result = `Execution error: ${err.message}`;
            }

          } else if (name === "send_push_notification") {
            try {
              const scriptPath = path.join(__dirname, 'pushbullet_service.py');
              const output = await new Promise((resolve) => {
                exec(`python "${scriptPath}" --note "${args.title}" "${args.body}"`, (err, stdout) => {
                  if (err) resolve(`Failed to send push: ${err.message}`);
                  else resolve(`Push notification sent: ${args.title}`);
                });
              });
              result = output;
              socket.emit('neural_log', { content: `Pushbullet: Dispatched notification "${args.title}".` });
            } catch (err) {
              result = `Push error: ${err.message}`;
            }
          } else if (name === "manage_contacts") {
            try {
              const contactsPath = path.join(__dirname, 'memory', 'contacts.json');
              const data = JSON.parse(fs.readFileSync(contactsPath));
              if (args.action === "list") result = JSON.stringify(data.contacts);
              else if (args.action === "add" || args.action === "update") {
                const idx = data.contacts.findIndex(c => c.name.toLowerCase() === args.name.toLowerCase());
                const newContact = { name: args.name, platforms: { whatsapp: args.whatsapp || "", instagram: args.instagram || "" } };
                if (idx > -1) data.contacts[idx] = { ...data.contacts[idx], ...newContact };
                else data.contacts.push(newContact);
                fs.writeFileSync(contactsPath, JSON.stringify(data, null, 2));
                result = `Contact ${args.name} ${idx > -1 ? 'updated' : 'added'}.`;
              } else if (args.action === "get") {
                const contact = data.contacts.find(c => c.name.toLowerCase() === args.name.toLowerCase());
                result = contact ? JSON.stringify(contact) : "Contact not found.";
              }
            } catch (err) {
              result = `Contact error: ${err.message}`;
            }

          } else if (name === "send_social_message") {
            try {
              const contactsPath = path.join(__dirname, 'memory', 'contacts.json');
              const data = JSON.parse(fs.readFileSync(contactsPath));
              const contact = data.contacts.find(c => c.name.toLowerCase() === args.contact_name.toLowerCase());
              if (!contact) throw new Error(`Contact "${args.contact_name}" not found.`);
              if (args.platform === "whatsapp") {
                const phone = contact.platforms.whatsapp;
                if (!phone) throw new Error(`${args.contact_name} has no WhatsApp number.`);
                const url = `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(args.message)}`;
                await openWebsites([url]);
                setTimeout(async () => {
                  await pressKey('enter');
                  setTimeout(async () => { await pressKey('enter'); }, 1500);
                }, 12000);
                result = `Opening WhatsApp for ${args.contact_name}...`;
                socket.emit('neural_log', { content: `Social Core: Triggered WhatsApp message to ${args.contact_name}.` });
              } else if (args.platform === "instagram") {
                const handle = contact.platforms.instagram;
                if (!handle) throw new Error(`${args.contact_name} has no Instagram handle.`);
                const url = `https://www.instagram.com/direct/new/`;
                await openWebsites([url]);
                result = `Opening Instagram Direct Messages. Search for @${handle} to send your message, Sir.`;
              }
            } catch (err) {
              result = `Messaging error: ${err.message}`;
            }

            // ── TIER 4: SEND EMAIL (Gmail Write) ────────────────────────────────
          } else if (name === "send_email") {
            try {
              if (!oAuth2Client) {
                result = "Google integration not configured. Please visit /auth/google to connect Gmail, sir.";
              } else {
                const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
                const draftOnly = args.draft_only === true;

                // Build RFC 2822 MIME message
                const toAddr = args.to;
                const subject = args.subject;
                const bodyText = args.body;
                const raw = Buffer.from(
                  `To: ${toAddr}\r\n` +
                  `Subject: ${subject}\r\n` +
                  `Content-Type: text/plain; charset=utf-8\r\n` +
                  `MIME-Version: 1.0\r\n\r\n` +
                  bodyText
                ).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

                if (draftOnly) {
                  const draft = await gmail.users.drafts.create({
                    userId: 'me',
                    resource: { message: { raw } }
                  });
                  result = `Email draft created successfully, sir. Draft ID: ${draft.data.id}. Subject: "${subject}" to ${toAddr}.`;
                  socket.emit('neural_log', { content: `Gmail: Draft created — "${subject}" for ${toAddr}.` });
                } else {
                  const sent = await gmail.users.messages.send({
                    userId: 'me',
                    resource: { raw }
                  });
                  result = `Email sent successfully, sir. Message ID: ${sent.data.id}. Subject: "${subject}" to ${toAddr}.`;
                  socket.emit('neural_log', { content: `Gmail: Email sent — "${subject}" to ${toAddr}.` });
                }
              }
            } catch (err) {
              console.error('[GMAIL SEND] Error:', err.message);
              if (err.message?.includes('insufficient')) {
                result = `Gmail permission error: Please re-authorize at /auth/google to grant send permissions, sir.`;
              } else {
                result = `Email error: ${err.message}`;
              }
            }

            // ── TIER 4: SEND TELEGRAM ─────────────────────────────────────────
          } else if (name === "send_telegram") {
            try {
              const botToken = process.env.TELEGRAM_BOT_TOKEN;
              if (!botToken) {
                result = "Telegram bot token not configured, sir. Add TELEGRAM_BOT_TOKEN to your .env file. Get a token from @BotFather on Telegram.";
              } else {
                const chatId = args.chat_id;
                const message = args.message;
                const tgRes = await fetch(
                  `https://api.telegram.org/bot${botToken}/sendMessage`,
                  {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      chat_id: chatId,
                      text: message,
                      parse_mode: 'Markdown'
                    })
                  }
                );
                const tgData = await tgRes.json();
                if (tgData.ok) {
                  result = `Telegram message sent to ${chatId}, sir. Message ID: ${tgData.result?.message_id}.`;
                  socket.emit('neural_log', { content: `Telegram: Message dispatched to ${chatId}.` });
                } else {
                  result = `Telegram error: ${tgData.description || 'Unknown error'}. Check chat_id and bot permissions.`;
                }
              }
            } catch (err) {
              result = `Telegram error: ${err.message}`;
            }

            // ── TIER 4: SET ALARM ─────────────────────────────────────────────────
          } else if (name === "set_alarm") {
            try {
              const payload = {
                label: args.label,
                time: args.time,
                recur: args.recur || 'once'
              };
              if (!alarmReady) {
                result = "Alarm scheduler is still starting up, sir. Please try again in a moment.";
              } else {
                const r = await fetch(`${ALARM_URL}/alarm/set`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const d = await r.json();
                if (d.success) {
                  result = `Alarm set successfully, sir. ${d.message} (ID: ${d.alarm_id}, fires at: ${d.fire_time}, recur: ${d.recur}).`;
                  socket.emit('neural_log', { content: `Alarm: Scheduled "${d.label}" for ${d.fire_time}.` });
                } else {
                  result = `Alarm error: ${d.error}`;
                }
              }
            } catch (err) {
              result = `Alarm error: ${err.message}`;
            }

            // ── TIER 4: CODE AUTO-FIX ──────────────────────────────────────────────
          } else if (name === "auto_fix_code") {
            try {
              const engineerProc = require('./specialists/engineer');
              // Run via Python sidecar (engineer already running)
              const fixPayload = {
                code: args.code,
                language: args.language || 'python',
                context: args.context || ''
              };
              const r = await fetch(`${SIDECAR_URL}/engineer/fix`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fixPayload)
              });
              if (r.ok) {
                const d = await r.json();
                result = d.result || 'Code fix loop completed.';
              } else {
                // Fallback: run inline via router
                result = `Code auto-fix loop initiated. Use 'fix this code' with the Engineer specialist in chat for full streaming output, sir.`;
              }
              socket.emit('neural_log', { content: `Engineer: Code auto-fix loop triggered.` });
            } catch (err) {
              result = `Code fix error: ${err.message}`;
            }

            // ── TIER 5: FACE-LOCK ─────────────────────────────────────────────────
          } else if (name === "face_lock") {
            try {
              if (!securityReady) {
                result = "Security daemon is starting up, sir. Try again in a moment.";
              } else {
                switch (args.action) {
                  case 'enable': {
                    const payload = { lock_delay_seconds: args.lock_delay_seconds || 15 };
                    const r = await fetch(`${SECURITY_URL}/security/start`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(payload)
                    });
                    const d = await r.json();
                    result = d.message || 'Face-Lock enabled.';
                    socket.emit('neural_log', { content: '🛡 Face-Lock ENABLED.' });
                    break;
                  }
                  case 'disable': {
                    const r = await fetch(`${SECURITY_URL}/security/stop`, { method: 'POST' });
                    const d = await r.json();
                    result = d.message || 'Face-Lock disabled.';
                    socket.emit('neural_log', { content: '🛡 Face-Lock DISABLED.' });
                    break;
                  }
                  case 'status': {
                    const r = await fetch(`${SECURITY_URL}/security/status`);
                    const d = await r.json();
                    result = `Face-Lock: ${d.face_lock_enabled ? 'ENABLED' : 'DISABLED'}. ` +
                      `PC: ${d.pc_locked ? 'LOCKED' : 'UNLOCKED'}. ` +
                      `Master present: ${d.master_present ? 'YES' : 'NO'}. ` +
                      `Camera: ${d.camera_ok ? 'OK' : 'OFFLINE'}. ` +
                      `Total locks: ${d.total_locks}. ` +
                      `Intruders caught: ${d.total_intruders}.`;
                    break;
                  }
                  case 'lock_now': {
                    const r = await fetch(`${SECURITY_URL}/security/lock_now`, { method: 'POST' });
                    const d = await r.json();
                    result = d.message || 'PC locked.';
                    socket.emit('neural_log', { content: '🔒 PC manually locked.' });
                    break;
                  }
                  case 'register_face': {
                    const r = await fetch(`${SECURITY_URL}/security/register`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
                    });
                    const d = await r.json();
                    result = d.message || d.error || 'Registration attempted.';
                    socket.emit('neural_log', { content: '📷 Master face registration triggered.' });
                    break;
                  }
                  default:
                    result = `Unknown face_lock action: ${args.action}`;
                }
              }
            } catch (err) {
              result = `Face-Lock error: ${err.message}`;
            }

            // ── TIER 5: SECURITY SNAPSHOTS ──────────────────────────────────────────
          } else if (name === "security_snapshots") {
            try {
              if (!securityReady) {
                result = "Security daemon is offline, sir.";
              } else if (args.action === 'list_snapshots') {
                const r = await fetch(`${SECURITY_URL}/security/snapshots`);
                const d = await r.json();
                if (d.snapshots && d.snapshots.length > 0) {
                  result = `Found ${d.count} intruder snapshot(s), sir. Most recent: ${d.snapshots[0].filename} (${d.snapshots[0].size_kb}KB).`;
                  // Push thumbnails to frontend
                  socket.emit('intruder_snapshots', { snapshots: d.snapshots.slice(0, 5) });
                } else {
                  result = 'No intruder snapshots found, sir. Your post is clean.';
                }
              } else if (args.action === 'security_log') {
                const r = await fetch(`${SECURITY_URL}/security/log?n=20`);
                const d = await r.json();
                const events = d.events || [];
                if (events.length > 0) {
                  const summary = events.map(e => `[${e.time?.substring(0, 19)}] ${e.type}: ${e.detail}`).join('\n');
                  result = `Security log (last ${events.length} events):\n${summary}`;
                } else {
                  result = 'Security log is empty, sir.';
                }
              }
            } catch (err) {
              result = `Security query error: ${err.message}`;
            }

            // ── TIER 6: MORNING BRIEFING ────────────────────────────────────────────
          } else if (name === "get_morning_brief") {
            try {
              const { execSync } = require('child_process');
              const briefPath = path.join(__dirname, 'daily_briefing.py');
              const output = execSync(`python "${briefPath}"`, { encoding: 'utf-8' });
              result = output.trim() || "Briefing failed to generate, sir.";
              socket.emit('neural_log', { content: '🌅 Morning briefing generated and dispatched.' });
            } catch (err) {
              result = `Morning brief error: ${err.message}`;
            }

            // ── TIER 6: SMART HOME CONTROL ──────────────────────────────────────────
          } else if (name === "smart_home_control") {
            try {
              if (!smartHomeReady) {
                result = "Smart home hub is offline, sir.";
              } else {
                let payload = {};
                if (args.action === 'scene') {
                  payload = { scene: args.scene };
                } else if (args.action === 'status') {
                  const r = await fetch(`${SMART_HOME_URL}/devices`);
                  const d = await r.json();
                  result = `Smart Home Status: ${Object.values(d.devices).map(d => `${d.name}: ${d.state}`).join(', ')}.`;
                  return;
                } else {
                  payload = { device_id: args.device_id, action: args.action, params: args.params || {} };
                }

                const r = await fetch(`${SMART_HOME_URL}${args.action === 'scene' ? '/scene' : '/control'}`, {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload)
                });
                const d = await r.json();
                result = d.message || d.error || 'Control command sent.';
                socket.emit('neural_log', { content: `🏠 Smart Home: ${result}` });
                _pushAction(`Smart Home: ${args.device_id || args.scene}`);
              }
            } catch (err) {
              result = `Smart Home error: ${err.message}`;
            }

            // ── TIER 7: PERSONALITY MODE ──────────────────────────────────────────────
          } else if (name === "set_personality_mode") {
            try {
              currentPersonalityMode = args.mode;
              result = `Personality mode shifted to ${args.mode}, sir. Adjusting response parameters.`;
              socket.emit('neural_log', { content: `🎭 PERSONALITY: ${args.mode}` });
              _pushAction(`Set Mode: ${args.mode}`);
            } catch (err) {
              result = `Mode switch error: ${err.message}`;
            }

            // ── TIER 8: SYSTEM OPTIMIZATION ──────────────────────────────────────────
          } else if (name === "optimize_system_resources") {
            try {
              const r = await fetch(`http://127.0.0.1:3006/system/optimize`, { method: 'POST' });
              const d = await r.json();
              result = d.message || "Optimization cycle complete, sir. Neural pathways cleared.";
              socket.emit('neural_log', { content: `⚡ OPTIMIZE: System resources flushed.` });
              _pushAction(`Optimized System`);
            } catch (err) {
              result = `Optimization failed: ${err.message}`;
            }
          }



          conversationHistory.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: name,
            content: result,
          });
        }
      }

      // ── 3. Second Pass: Streaming Text Response ──
      let stream;
      try {
        stream = await groqClient.chat.completions.create({
          messages: conversationHistory,
          model: LLM_MODEL,
          temperature: 0.7,
          max_tokens: 300,
          stream: true,
        });
      } catch (err) {
        if (err.status === 429) {
          console.warn("[GROQ] Streaming pass rate limited. Falling back to 8B...");
          stream = await groqClient.chat.completions.create({
            messages: conversationHistory,
            model: FAST_MODEL,
            temperature: 0.7,
            max_tokens: 300,
            stream: true,
          });
        } else {
          throw err;
        }
      }

      let fullAIResponse = '';
      let textBuffer = '';
      let chunkIndex = 0;
      const sentenceChunks = [];

      const flushToQueue = (sentenceText, idx) => {
        const clean = sentenceText.trim();
        if (clean.length < 2) return;
        sentenceChunks.push({ index: idx, text: clean });
      };

      socket.emit('zaire_status', 'speaking');

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (!delta) continue;

        fullAIResponse += delta;
        textBuffer += delta;
        socket.emit('ai_text_delta', delta);

        let splitResult;
        while ((splitResult = splitIntoSentences(textBuffer)) !== null) {
          flushToQueue(splitResult.sentence, chunkIndex);
          textBuffer = splitResult.rest;
          chunkIndex++;
        }
      }

      if (textBuffer.trim().length > 1) {
        flushToQueue(textBuffer.trim(), chunkIndex);
      }

      // Send all text chunks to frontend so it can fetch audio via HTTP
      socket.emit('text_chunks', { chunks: sentenceChunks });

      socket.emit('ai_text_complete', { fullText: fullAIResponse });
      conversationHistory.push({ role: 'assistant', content: fullAIResponse });

      // Persist AI response
      const updatedSession = chatHistoryService.getSession(currentSessionId);
      if (updatedSession) {
        updatedSession.messages.push({ role: 'assistant', content: fullAIResponse, timestamp: new Date().toISOString() });
        chatHistoryService.saveSession(updatedSession);
      }

    } catch (error) {
      console.error(`\n[FATAL ERROR] Socket: ${socket.id}`);
      console.error(`Message: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      socket.emit('ai_error', "I'm experiencing a momentary disruption, sir. Please try again.");
      socket.emit('zaire_status', 'idle');
    }
  };

  socket.on('user_message', handleUserMessage);

  socket.on('shadow_request', async (data) => {
    const { prompt, context } = data;
    console.log(`[SHADOW] Incoming request: ${prompt}`);

    try {
      const response = await fetch('http://127.0.0.1:3002/agent/shadow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, context })
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const delta = decoder.decode(value, { stream: true });
        socket.emit('shadow_text_delta', delta);
      }
      socket.emit('shadow_text_complete');
    } catch (err) {
      console.error('[SHADOW ERR]', err.message);
      socket.emit('ai_error', "Shadow link disrupted, sir.");
    }
  });

  socket.on('reset_history', () => {
    conversationHistory = [conversationHistory[0]];
    socket.emit('neural_log', { content: "System: Short-term memory wiped for token optimization." });
  });

  socket.on('disconnect', () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
    if (traderPulseInterval) clearInterval(traderPulseInterval);
    if (globalProactive) {
      globalProactive.stop();
      globalProactive = null;
    }
  });
});

// ─── Start Server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════╗`);
  console.log(`║  ZAIRE Server — Port ${PORT}          ║`);
  console.log(`║  WebSocket: ws://localhost:${PORT}           ║`);
  console.log(`║  Health:    http://localhost:${PORT}/health   ║`);
  console.log(`║  Memories:  http://localhost:${PORT}/memories ║`);
  console.log(`╚══════════════════════════════════════════╝\n`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
function cleanupAndExit(code = 0) {
  console.log(`\n[SHUTDOWN] ZAIRE Core exiting with code: ${code}`);
  console.log('[SHUTDOWN] Cleaning up tactical resources...');

  const procs = [
    sidecarProcess, observerProc, vectorMemoryProc, localLLMProc,
    processMonProc, clipboardProc, fileWatcherProc, sysHealthProc,
    alarmProc, securityProc, smartHomeProc, visualEchoProc
  ];

  procs.forEach(p => {
    if (p && !p.killed) {
      try { p.kill(); } catch (e) { }
    }
  });

  if (globalProactive) {
    try { globalProactive.stop(); } catch (e) { }
  }

  console.log('[SHUTDOWN] All sidecars terminated. Purging potential orphans...');

  if (process.platform === 'win32') {
    // One final taskkill to be sure
    exec('taskkill /F /IM python.exe /T', () => {
      process.exit(code);
    });
  } else {
    process.exit(code);
  }
}

process.on('SIGINT', () => cleanupAndExit(0));
process.on('SIGTERM', () => cleanupAndExit(0));
