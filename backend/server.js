// v8 - Multi-tenant SaaS + Socket.io notifiche real-time
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const Stripe = require('stripe');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { body, param, validationResult } = require('express-validator');

// Multi-tenant models and middleware
const {
  Organization,
  TeamMember,
  User: UserModel,
  Reward: RewardModel,
  ViewerPoints: ViewerPointsModel,
  SubscriptionPlan,
  UsageRecord,
  Invoice,
  ApiKey
} = require('./models');

const { authenticateToken } = require('./middleware');
const saasRouter = require('./saas-routes');
const analyticsRouter = require('./analytics-routes');
const leaderboardRouter = require('./leaderboard-routes');
const twoFactorRouter = require('./2fa-routes');
const auditRouter = require('./audit-routes');
const redemptionRouter = require('./redemption-routes');
const smsRouter = require('./sms-routes');
const exportRouter = require('./export-routes');
const batchRouter = require('./batch-routes');
const webhookRouter = require('./webhook-routes');
const mobileRouter = require('./mobile-routes');

// Email service
const emailService = require('./services/email');

dotenv.config();

const app = express();

// FIX: Trust proxy per Railway (risolve ERR_ERL_UNEXPECTED_X_FORWARDED_FOR)
app.set('trust proxy', 1);

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

const PORT = process.env.PORT || 5000;
const SERVER_STARTED_AT = Date.now();
const JWT_SECRET =
  process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev_fallback_secret_change_me');
const processedStripeEvents = new Map();

const KICK_CLIENT_ID = process.env.KICK_CLIENT_ID;
const KICK_CLIENT_SECRET = process.env.KICK_CLIENT_SECRET;
const KICK_REDIRECT_URI = process.env.KICK_REDIRECT_URI || 'https://kick-loyalty-app.vercel.app/auth/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://kick-loyalty-app.vercel.app';

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

if (!JWT_SECRET) {
  console.error('JWT_SECRET non configurato in produzione');
}

// Socket.io - gestione connessioni
io.on('connection', (socket) => {
  console.log('ðŸ”Œ Client connesso:', socket.id);

  // Lo streamer si registra nella sua stanza
  socket.on('join-streamer', (streamerUsername) => {
    socket.join(`streamer:${streamerUsername.toLowerCase()}`);
    console.log(`ðŸ“º Streamer ${streamerUsername} connesso alla sua stanza`);
  });

  socket.on('disconnect', () => {
    console.log('ðŸ”Œ Client disconnesso:', socket.id);
  });
});

// Rendi io disponibile alle route
app.set('io', io);

// Webhook Stripe deve essere PRIMA di express.json()
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return res.status(400).json({ error: 'Missing stripe-signature header' });

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Stripe may retry events; ignore duplicates for 24h.
  const eventId = event.id;
  const alreadyProcessedAt = processedStripeEvents.get(eventId);
  if (alreadyProcessedAt) {
    return res.json({ received: true, duplicate: true });
  }
  processedStripeEvents.set(eventId, Date.now());

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session.metadata?.userId;
      if (userId && mongoose.connection.readyState === 1) {
        await User.findByIdAndUpdate(userId, {
          plan: 'pro',
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription
        });
        console.log('âœ… Piano Pro attivato per utente:', userId);
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object;
      if (mongoose.connection.readyState === 1) {
        await User.findOneAndUpdate(
          { stripeSubscriptionId: subscription.id },
          { plan: 'free', stripeSubscriptionId: null }
        );
      }
    }

    return res.json({ received: true });
  } catch (err) {
    // Allow retries for failed processing.
    processedStripeEvents.delete(eventId);
    console.error('Stripe webhook handling error:', err.message);
    return res.status(500).json({ error: 'Webhook handling failed' });
  } finally {
    // Keep dedupe map bounded in memory.
    if (processedStripeEvents.size > 10000) {
      const now = Date.now();
      for (const [id, ts] of processedStripeEvents.entries()) {
        if (now - ts > 24 * 60 * 60 * 1000) processedStripeEvents.delete(id);
      }
    }
  }
});

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: accetta qualsiasi origine per testing
app.use(cors({ origin: '*', credentials: false }));
app.use(express.json({ limit: '10kb' }));

// Rate limiting globale
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 200,
  message: { error: 'Troppe richieste, riprova tra 15 minuti.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', globalLimiter);

// Rate limiting piÃ¹ stretto per auth
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Troppi tentativi di login, riprova tra 15 minuti.' }
});

// Rate limiting per AI
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10,
  message: { error: 'Troppe richieste AI, riprova tra un minuto.' }
});

// Helper validazione
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
};

// MongoDB Connection
const connectDB = async () => {
  if (process.env.MONGODB_URI && process.env.MONGODB_URI !== 'your_mongodb_connection_string') {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('âœ… MongoDB connesso');
    } catch (error) {
      console.log('âš ï¸ MongoDB non connesso:', error.message);
    }
  }
};

// ==================== DEPRECATED: Inline Schemas (use models.js instead) ====================
// Manteniamo backward compatibility usando i modelli importati
const User = UserModel;
const Reward = RewardModel;
const ViewerPoints = ViewerPointsModel;

let mockRewards = [
  { id: '1', name: 'Welcome Bonus', description: '100 punti di benvenuto', points: 100, type: 'bonus', active: true },
  { id: '2', name: 'Viewer Shoutout', description: 'Menzione durante lo stream', points: 500, type: 'shoutout', active: true },
  { id: '3', name: 'Custom Emote', description: 'Emote personalizzata', points: 1000, type: 'emote', active: true }
];

global.oauthSessions = {};

// ==================== ROUTES PUBBLICHE (prima dei router protetti) ====================

app.get('/api/health', (req, res) => {
  const dbStateByCode = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const dbStateCode = mongoose.connection.readyState;
  const dbState = dbStateByCode[dbStateCode] || 'unknown';
  const uptimeSec = Math.floor((Date.now() - SERVER_STARTED_AT) / 1000);
  const hasJwtSecret = Boolean(process.env.JWT_SECRET);

  const health = {
    status: dbState === 'connected' || !process.env.MONGODB_URI ? 'ok' : 'degraded',
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptimeSec,
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || 'unknown',
    checks: {
      database: dbState,
      jwtConfigured: hasJwtSecret
    }
  };

  const statusCode = health.status === 'ok' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.get('/api/health/ready', (req, res) => {
  const dbConnected = mongoose.connection.readyState === 1;
  if (process.env.MONGODB_URI && !dbConnected) {
    return res.status(503).json({
      status: 'not_ready',
      reason: 'database_not_connected'
    });
  }

  return res.json({ status: 'ready' });
});

// STEP 1 - Genera URL OAuth Kick con PKCE
app.get('/api/auth/kick/url', authLimiter, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');

  global.oauthSessions[state] = codeVerifier;
  setTimeout(() => { delete global.oauthSessions[state]; }, 10 * 60 * 1000);

  const scopes = ['user:read', 'channel:read'].join(' ');
  const authUrl = `https://id.kick.com/oauth/authorize?` +
    `response_type=code` +
    `&client_id=${KICK_CLIENT_ID}` +
    `&redirect_uri=${encodeURIComponent(KICK_REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&code_challenge=${codeChallenge}` +
    `&code_challenge_method=S256` +
    `&state=${state}`;

  res.json({ url: authUrl, state });
});

// STEP 2 - Callback OAuth
app.post('/api/auth/kick/callback', authLimiter, async (req, res) => {
  const { code, state } = req.body;
  if (!code) return res.status(400).json({ error: 'Code mancante' });

  const codeVerifier = global.oauthSessions[state];
  if (!codeVerifier) console.warn('codeVerifier non trovato per state:', state);

  try {
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', KICK_CLIENT_ID);
    params.append('client_secret', KICK_CLIENT_SECRET);
    params.append('redirect_uri', KICK_REDIRECT_URI);
    params.append('code', code);
    if (codeVerifier) params.append('code_verifier', codeVerifier);

    const tokenResponse = await axios.post('https://id.kick.com/oauth/token', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const { access_token, refresh_token } = tokenResponse.data;
    if (state) delete global.oauthSessions[state];

    const userResponse = await axios.get('https://api.kick.com/public/v1/users', {
      headers: { 'Authorization': `Bearer ${access_token}` }
    });

    const userData = userResponse.data?.data?.[0] || userResponse.data?.data || userResponse.data;
    const username = userData?.username || userData?.name || userData?.email || 'user_' + Date.now();
    const displayName = userData?.name || userData?.username || username;
    const avatarUrl = userData?.profile_picture || userData?.avatar || null;
    const channelId = userData?.user_id?.toString() || userData?.id?.toString() || null;

    let user;
    if (mongoose.connection.readyState === 1) {
      user = await User.findOneAndUpdate(
        { kickUsername: username.toLowerCase() },
        {
          kickUsername: username.toLowerCase(),
          kickDisplayName: displayName,
          kickAvatarUrl: avatarUrl,
          kickChannelId: channelId,
          kickAccessToken: access_token,
          kickRefreshToken: refresh_token || null,
          lastLogin: new Date()
        },
        { upsert: true, new: true }
      );
    } else {
      user = { _id: 'mock_' + username, kickUsername: username.toLowerCase(), kickDisplayName: displayName, plan: 'free' };
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT non configurato sul server' });
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user._id, username: user.kickUsername },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.kickUsername,
        displayName: user.kickDisplayName,
        avatarUrl: user.kickAvatarUrl,
        channelId: user.kickChannelId,
        plan: user.plan || 'free'
      }
    });
  } catch (error) {
    console.error('OAuth error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Errore OAuth Kick', details: error.response?.data });
  }
});

// Login con username (fallback) - DEVE ESSERE PRIMA dei router protetti
app.post('/api/auth/login', authLimiter, [
  body('username').trim().isLength({ min: 1, max: 50 }).escape()
], validate, async (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username richiesto' });

  try {
    let kickData = null;
    try {
      const kickResponse = await axios.get(`https://kick.com/api/v1/channels/${username}`, {
        timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      kickData = kickResponse.data;
    } catch (e) { console.log('Kick API non disponibile'); }

    let user;
    if (mongoose.connection.readyState === 1) {
      user = await User.findOneAndUpdate(
        { kickUsername: username.toLowerCase() },
        {
          kickUsername: username.toLowerCase(),
          kickDisplayName: kickData?.user?.username || username,
          kickAvatarUrl: kickData?.user?.profile_pic || null,
          lastLogin: new Date()
        },
        { upsert: true, new: true }
      );
    } else {
      user = { _id: 'mock_' + username, kickUsername: username.toLowerCase(), kickDisplayName: username, plan: 'free' };
    }

    if (!JWT_SECRET) {
      return res.status(500).json({ error: 'JWT non configurato sul server' });
    }

    const jwt = require('jsonwebtoken');
    const token = jwt.sign(
      { id: user._id, username: user.kickUsername },
      JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.kickUsername,
        displayName: user.kickDisplayName || username,
        avatarUrl: user.kickAvatarUrl,
        plan: user.plan || 'free'
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Errore durante il login' });
  }
});

// Proxy per Groq AI (gratuito) - Route pubblica
app.post('/api/ai/chat', aiLimiter, async (req, res) => {
  try {
    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array required' });
    }
    const groqKey = (process.env.GROQ_API_KEY || '').trim();
    if (!groqKey) {
      return res.status(500).json({ error: 'Groq API key non configurata sul server' });
    }
    const groqMessages = [
      { role: 'system', content: "Sei l'assistente AI di KickLoyalty, piattaforma rewards per streamer su Kick. Aiuta gli streamer a crescere, suggerisci idee per rewards, strategie di engagement e come usare al meglio il sistema. Rispondi in italiano, in modo conciso e pratico." },
      ...messages
    ];
    const response = await axios.post('https://api.groq.com/openai/v1/chat/completions', {
      model: 'llama-3.1-8b-instant',
      max_tokens: 1000,
      messages: groqMessages
    }, {
      headers: {
        'Authorization': `Bearer ${groqKey}`,
        'Content-Type': 'application/json'
      }
    });
    const text = response.data.choices?.[0]?.message?.content || 'Nessuna risposta.';
    res.json({ content: [{ type: 'text', text }] });
  } catch (error) {
    console.error('AI proxy error:', error.response?.data || error.message);
    res.status(500).json({ error: error.response?.data?.error?.message || error.message });
  }
});

// KPI telemetry events (conversion funnel, onboarding, feature adoption)
app.post('/api/telemetry/events', [
  body('event').trim().isLength({ min: 1, max: 80 }),
  body('source').optional().trim().isLength({ max: 40 }),
  body('properties').optional().isObject()
], validate, async (req, res) => {
  const { event, source = 'web', properties = {} } = req.body;

  const telemetryRecord = {
    event,
    source,
    properties,
    userAgent: req.headers['user-agent'] || null,
    ip: req.ip,
    createdAt: new Date()
  };

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.collection('telemetry_events').insertOne(telemetryRecord);
    } else {
      if (!global.telemetryEvents) global.telemetryEvents = [];
      global.telemetryEvents.push(telemetryRecord);
      if (global.telemetryEvents.length > 2000) {
        global.telemetryEvents = global.telemetryEvents.slice(-2000);
      }
    }
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Telemetry ingest failed' });
  }
});

app.get('/api/telemetry/summary', async (req, res) => {
  const sinceDays = Math.min(90, Math.max(1, parseInt(req.query.days || '7', 10)));
  const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);

  try {
    let events = [];
    if (mongoose.connection.readyState === 1) {
      events = await mongoose.connection
        .collection('telemetry_events')
        .find({ createdAt: { $gte: sinceDate } })
        .toArray();
    } else {
      events = (global.telemetryEvents || []).filter((e) => new Date(e.createdAt) >= sinceDate);
    }

    const counts = events.reduce((acc, evt) => {
      acc[evt.event] = (acc[evt.event] || 0) + 1;
      return acc;
    }, {});

    const consentAccepted = counts.consent_accepted || 0;
    const ctaClicked = counts.cta_clicked || 0;
    const loginSuccess = counts.login_success || 0;
    const rewardCreated = counts.reward_created || 0;
    const upgradeClicked = counts.upgrade_clicked || 0;

    return res.json({
      sinceDays,
      totalEvents: events.length,
      counts,
      funnel: {
        consentAccepted,
        ctaClicked,
        loginSuccess,
        rewardCreated,
        upgradeClicked
      },
      rates: {
        ctaToLogin: ctaClicked > 0 ? Number((loginSuccess / ctaClicked).toFixed(3)) : 0,
        loginToReward: loginSuccess > 0 ? Number((rewardCreated / loginSuccess).toFixed(3)) : 0,
        rewardToUpgradeClick: rewardCreated > 0 ? Number((upgradeClicked / rewardCreated).toFixed(3)) : 0
      }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Telemetry summary failed' });
  }
});

// ==================== ROUTE PUBBLICHE API (prima dei router protetti) ====================

const getOwnedRewardQuery = (userId) => ({
  $or: [{ createdBy: userId }, { userId }]
});

// GET /api/rewards - pubblico
app.get('/api/rewards', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const rewardQuery = req.query.userId ? getOwnedRewardQuery(req.query.userId) : {};
      const rewards = await Reward.find(rewardQuery).sort({ createdAt: -1 });
      res.json(rewards);
    } else { res.json(mockRewards); }
  } catch (error) { res.json(mockRewards); }
});

// GET /api/rewards/mine - autenticato, solo reward dell'utente
app.get('/api/rewards/mine', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const rewards = await Reward.find(getOwnedRewardQuery(req.user.id)).sort({ createdAt: -1 });
      return res.json(rewards);
    }

    return res.json(mockRewards);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// GET /api/stats - pubblico
app.get('/api/stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const [totalUsers, totalRewards, pointsAgg, redeemedAgg] = await Promise.all([
        User.countDocuments(),
        Reward.countDocuments({ active: true }),
        User.aggregate([{ $group: { _id: null, total: { $sum: '$totalPoints' } } }]),
        Reward.aggregate([{ $group: { _id: null, total: { $sum: '$redeemedCount' } } }])
      ]);
      res.json({
        totalViewers: totalUsers,
        activeMembers: totalUsers,
        totalPoints: pointsAgg[0]?.total || 0,
        rewardsRedeemed: redeemedAgg[0]?.total || 0
      });
    } else {
      res.json({ totalViewers: 0, activeMembers: 0, totalPoints: 0, rewardsRedeemed: 0 });
    }
  } catch (error) {
    res.json({ totalViewers: 0, activeMembers: 0, totalPoints: 0, rewardsRedeemed: 0 });
  }
});

// ==================== MULTI-TENANT SaaS ROUTES (dopo le route pubbliche) ====================
// Integrare tutte le route SaaS (organizations, team, billing, etc)
app.use('/api', saasRouter);
app.use('/api', analyticsRouter);
app.use('/api', leaderboardRouter);
app.use('/api', twoFactorRouter);
app.use('/api', auditRouter);
app.use('/api', redemptionRouter);
app.use('/api', smsRouter);
app.use('/api', exportRouter);
app.use('/api', batchRouter);
app.use('/api', webhookRouter);
app.use('/api', mobileRouter);

// ==================== STRIPE ====================

app.post('/api/stripe/create-checkout', async (req, res) => {
  const { userId } = req.body;
  if (!userId) return res.status(400).json({ error: 'userId richiesto' });

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'subscription',
      success_url: `${FRONTEND_URL}?upgrade=success`,
      cancel_url: `${FRONTEND_URL}?upgrade=cancelled`,
      metadata: { userId }
    });
    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/stripe/cancel', async (req, res) => {
  const { userId } = req.body;
  try {
    const user = await User.findById(userId);
    if (!user?.stripeSubscriptionId) return res.status(400).json({ error: 'Nessun abbonamento attivo' });
    await stripe.subscriptions.cancel(user.stripeSubscriptionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== REWARDS ====================

app.get('/api/rewards', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const rewardQuery = req.query.userId ? getOwnedRewardQuery(req.query.userId) : {};
      const rewards = await Reward.find(rewardQuery).sort({ createdAt: -1 });
      res.json(rewards);
    } else { res.json(mockRewards); }
  } catch (error) { res.json(mockRewards); }
});

app.post('/api/rewards', authenticateToken, [
  body('name').trim().isLength({ min: 1, max: 100 }).escape(),
  body('points').isInt({ min: 0, max: 1000000 }),
  body('description').optional().trim().isLength({ max: 500 }).escape()
], validate, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const reward = new Reward({
        ...req.body,
        createdBy: req.user.id
      });
      await reward.save();
      res.json(reward);
    } else {
      const newReward = { ...req.body, id: Date.now().toString() };
      mockRewards.push(newReward);
      res.json(newReward);
    }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.put('/api/rewards/:id', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const reward = await Reward.findOneAndUpdate(
        { _id: req.params.id, ...getOwnedRewardQuery(req.user.id) },
        req.body,
        { new: true }
      );
      if (!reward) return res.status(404).json({ error: 'Reward non trovata' });
      res.json(reward);
    } else {
      const idx = mockRewards.findIndex(r => r.id === req.params.id);
      if (idx !== -1) mockRewards[idx] = { ...mockRewards[idx], ...req.body };
      res.json(mockRewards[idx]);
    }
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.delete('/api/rewards/:id', authenticateToken, async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const deleted = await Reward.findOneAndDelete({ _id: req.params.id, ...getOwnedRewardQuery(req.user.id) });
      if (!deleted) return res.status(404).json({ error: 'Reward non trovata' });
    } else {
      mockRewards = mockRewards.filter(r => r.id !== req.params.id);
    }
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// ==================== REDEEM (con notifica real-time) ====================

app.post('/api/rewards/:id/redeem', [
  body('viewerUsername').optional().trim().isLength({ max: 50 }).escape(),
  body('streamerUsername').optional().trim().isLength({ max: 50 }).escape()
], validate, async (req, res) => {
  const { viewerUsername, streamerUsername } = req.body;
  const io = req.app.get('io');

  try {
    let reward;
    if (mongoose.connection.readyState === 1) {
      reward = await Reward.findById(req.params.id);
    } else {
      reward = mockRewards.find(r => r.id === req.params.id);
    }

    if (!reward) return res.status(404).json({ error: 'Reward non trovato' });

    // Controlla punti spettatore se richiesti
    if (reward.points > 0 && viewerUsername && streamerUsername && mongoose.connection.readyState === 1) {
      const vp = await ViewerPoints.findOne({
        viewerUsername: viewerUsername.toLowerCase(),
        streamerUsername: streamerUsername.toLowerCase()
      });
      const currentPoints = vp?.points || 0;
      if (currentPoints < reward.points) {
        return res.status(400).json({ error: `Punti insufficienti! Hai ${currentPoints} pt, servono ${reward.points} pt` });
      }
      // Scala i punti
      await ViewerPoints.findOneAndUpdate(
        { viewerUsername: viewerUsername.toLowerCase(), streamerUsername: streamerUsername.toLowerCase() },
        { $inc: { points: -reward.points } }
      );
    }

    // Incrementa contatore riscatti
    if (mongoose.connection.readyState === 1) {
      reward = await Reward.findByIdAndUpdate(req.params.id, { $inc: { redeemedCount: 1 } }, { new: true });
    }

    // Invia notifica real-time allo streamer
    if (io && streamerUsername) {
      const notification = {
        type: 'redeem',
        viewerUsername,
        rewardName: reward.name,
        rewardPoints: reward.points,
        timestamp: new Date()
      };
      io.to(`streamer:${streamerUsername.toLowerCase()}`).emit('reward-redeemed', notification);
      console.log(`ðŸ”” Notifica inviata allo streamer ${streamerUsername}:`, notification);
    }

    res.json({ success: true, reward });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== STATS & ANALYTICS ====================

app.get('/api/stats', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const [totalUsers, totalRewards, pointsAgg, redeemedAgg] = await Promise.all([
        User.countDocuments(),
        Reward.countDocuments({ active: true }),
        User.aggregate([{ $group: { _id: null, total: { $sum: '$totalPoints' } } }]),
        Reward.aggregate([{ $group: { _id: null, total: { $sum: '$redeemedCount' } } }])
      ]);
      res.json({
        totalViewers: totalUsers,
        activeMembers: totalUsers,
        totalPoints: pointsAgg[0]?.total || 0,
        rewardsRedeemed: redeemedAgg[0]?.total || 0
      });
    } else {
      res.json({ totalViewers: 0, activeMembers: 0, totalPoints: 0, rewardsRedeemed: 0 });
    }
  } catch (error) {
    res.json({ totalViewers: 0, activeMembers: 0, totalPoints: 0, rewardsRedeemed: 0 });
  }
});

app.get('/api/analytics', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const [topRewards, recentUsers, totalRewards] = await Promise.all([
        Reward.find().sort({ redeemedCount: -1 }).limit(5),
        User.find().sort({ createdAt: -1 }).limit(10),
        Reward.countDocuments()
      ]);

      const months = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];
      const now = new Date();
      const pointsByMonth = [];
      for (let i = 3; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const count = await User.countDocuments({ createdAt: { $gte: d, $lt: end } });
        pointsByMonth.push({ month: months[d.getMonth()], points: count * 100 });
      }

      res.json({
        topRewards: topRewards.map(r => ({ name: r.name, count: r.redeemedCount || 0 })),
        pointsByMonth,
        totalRewards,
        recentUsers: recentUsers.length
      });
    } else {
      res.json({ topRewards: [], pointsByMonth: [], totalRewards: 0, recentUsers: 0 });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== KICK WEBHOOK ====================

// Kick manda eventi qui quando qualcuno guarda, segue, si iscrive
// Cache in-memory per rate limiting punti (max 1 punto/min per utente per streamer)
const pointsCooldown = new Map();

const canEarnPoints = (viewerUsername, streamerUsername, cooldownMs = 60000) => {
  const key = `${viewerUsername}:${streamerUsername}`;
  const last = pointsCooldown.get(key) || 0;
  if (Date.now() - last < cooldownMs) return false;
  pointsCooldown.set(key, Date.now());
  return true;
};

// Pulizia cache ogni ora
setInterval(() => {
  const cutoff = Date.now() - 3600000;
  for (const [key, time] of pointsCooldown.entries()) {
    if (time < cutoff) pointsCooldown.delete(key);
  }
}, 3600000);

const awardPoints = async (viewerUsername, streamerUsername, points, reason) => {
  if (!viewerUsername || !streamerUsername || mongoose.connection.readyState !== 1) return null;
  const vp = await ViewerPoints.findOneAndUpdate(
    { viewerUsername: viewerUsername.toLowerCase(), streamerUsername: streamerUsername.toLowerCase() },
    { $inc: { points, totalEarned: points }, lastSeen: new Date() },
    { upsert: true, new: true }
  );
  console.log(`â­ +${points} punti a ${viewerUsername} (${reason}) per ${streamerUsername}`);
  return vp;
};

app.post('/api/kick/webhook', express.json(), async (req, res) => {
  try {
    const event = req.body;
    const eventType = event?.type || event?.event || 'unknown';
    console.log('ðŸ“¥ Kick Webhook ricevuto:', eventType);

    // â”€â”€ Chat message: +1 punto (max 1 al minuto per utente)
    if (['chat_message', 'stream.chat.message', 'ChatMessageEvent'].includes(eventType)) {
      const viewerUsername = event?.data?.sender?.username || event?.data?.chatter?.username || event?.data?.sender;
      const streamerUsername = event?.data?.broadcaster?.username || event?.data?.channel?.slug || event?.channel_id;
      if (viewerUsername && streamerUsername && canEarnPoints(viewerUsername, streamerUsername, 60000)) {
        await awardPoints(viewerUsername, streamerUsername, 1, 'chat message');
      }
    }

    // â”€â”€ Nuovo follower: +50 punti
    if (['channel.follow', 'follow', 'FollowEvent', 'stream.followed'].includes(eventType)) {
      const viewerUsername = event?.data?.follower?.username || event?.data?.user?.username || event?.data?.follower;
      const streamerUsername = event?.data?.channel?.slug || event?.data?.broadcaster?.username || event?.channel_id;
      if (viewerUsername && streamerUsername && canEarnPoints(viewerUsername, streamerUsername, 86400000)) {
        await awardPoints(viewerUsername, streamerUsername, 50, 'follow');
      }
    }

    // â”€â”€ Subscription: +200 punti
    if (['channel.subscription', 'subscription', 'SubscriptionEvent', 'stream.subscribed'].includes(eventType)) {
      const viewerUsername = event?.data?.subscriber?.username || event?.data?.user?.username || event?.data?.subscriber;
      const streamerUsername = event?.data?.channel?.slug || event?.data?.broadcaster?.username || event?.channel_id;
      if (viewerUsername && streamerUsername) {
        await awardPoints(viewerUsername, streamerUsername, 200, 'subscription');
      }
    }

    // â”€â”€ Gift sub: +100 punti al mittente
    if (['channel.subscription.gift', 'GiftSubscriptionEvent'].includes(eventType)) {
      const viewerUsername = event?.data?.gifter?.username || event?.data?.gifted_by;
      const streamerUsername = event?.data?.channel?.slug || event?.data?.broadcaster?.username;
      if (viewerUsername && streamerUsername) {
        await awardPoints(viewerUsername, streamerUsername, 100, 'gift sub');
      }
    }

    // â”€â”€ Raid in arrivo: +30 punti al raider
    if (['raid', 'RaidEvent', 'stream.raided'].includes(eventType)) {
      const viewerUsername = event?.data?.raider?.username || event?.data?.from_username;
      const streamerUsername = event?.data?.channel?.slug || event?.data?.broadcaster?.username;
      if (viewerUsername && streamerUsername) {
        await awardPoints(viewerUsername, streamerUsername, 30, 'raid');
      }
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Kick webhook error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint per testare i punti manualmente (utile per debug)
app.post('/api/kick/test-points', authenticateToken, async (req, res) => {
  const { viewerUsername, points = 10, reason = 'test' } = req.body;
  if (!viewerUsername) return res.status(400).json({ error: 'viewerUsername richiesto' });
  try {
    const streamerUsername = req.user.username;
    const vp = await awardPoints(viewerUsername, streamerUsername, points, reason);
    res.json({ success: true, newPoints: vp?.points || points });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== VIEWER POINTS ====================

// Ottieni punti di uno spettatore per uno streamer
app.get('/api/viewer-points/:viewerUsername/:streamerUsername', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const vp = await ViewerPoints.findOne({
        viewerUsername: req.params.viewerUsername.toLowerCase(),
        streamerUsername: req.params.streamerUsername.toLowerCase()
      });
      res.json({ points: vp?.points || 0, totalEarned: vp?.totalEarned || 0 });
    } else {
      res.json({ points: 0, totalEarned: 0 });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assegna punti manualmente (streamer lo fa dalla dashboard)
app.post('/api/viewer-points/assign', async (req, res) => {
  const { viewerUsername, streamerUsername, points } = req.body;
  if (!viewerUsername || !streamerUsername || !points) {
    return res.status(400).json({ error: 'Dati mancanti' });
  }
  try {
    if (mongoose.connection.readyState === 1) {
      const vp = await ViewerPoints.findOneAndUpdate(
        { viewerUsername: viewerUsername.toLowerCase(), streamerUsername: streamerUsername.toLowerCase() },
        { $inc: { points: parseInt(points), totalEarned: parseInt(points) }, lastSeen: new Date() },
        { upsert: true, new: true }
      );
      res.json({ success: true, points: vp.points });
    } else {
      res.json({ success: true, points: parseInt(points) });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Leaderboard spettatori per uno streamer
app.get('/api/viewer-points/leaderboard/:streamerUsername', async (req, res) => {
  try {
    if (mongoose.connection.readyState === 1) {
      const leaderboard = await ViewerPoints.find({
        streamerUsername: req.params.streamerUsername.toLowerCase()
      }).sort({ points: -1 }).limit(10);
      res.json(leaderboard);
    } else {
      res.json([]);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

connectDB();
emailService.initializeEmailService();

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📋 API disponibili su http://localhost:${PORT}/api/`);
  console.log(`📡 Socket.io attivo`);
});
