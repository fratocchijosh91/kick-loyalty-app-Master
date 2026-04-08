/**
 * MODELS - Multi-tenant SaaS Database Schemas
 * Organization-based data isolation with subscription management
 */

const mongoose = require('mongoose');

// ==================== ORGANIZATION ====================
// Container per ogni team/account (multi-tenant isolation)
const organizationSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true, lowercase: true, index: true },
  description: { type: String },
  logo: { type: String },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Subscription info
  subscription: {
    plan: { type: String, enum: ['free', 'pro', 'business', 'enterprise'], default: 'free' },
    status: { type: String, enum: ['active', 'cancelled', 'past_due', 'inactive'], default: 'active' },
    stripeCustomerId: { type: String },
    stripeSubscriptionId: { type: String },
    stripePriceId: { type: String },
    renewalDate: { type: Date },
    cancelledAt: { type: Date }
  },

  // Usage tracking
  usage: {
    rewards: { type: Number, default: 0 },
    teamMembers: { type: Number, default: 1 },
    apiCalls: { type: Number, default: 0 },
    webhookEvents: { type: Number, default: 0 }
  },

  // Settings
  settings: {
    webhooksEnabled: { type: Boolean, default: false },
    customBranding: { type: Boolean, default: false },
    twoFactorRequired: { type: Boolean, default: false }
  },

  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null } // Soft delete
});

organizationSchema.index({ owner: 1, deletedAt: 1 });
organizationSchema.index({ slug: 1, deletedAt: 1 });

// ==================== TEAM MEMBER ====================
// Utenti che hanno accesso a un'organizzazione
const teamMemberSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['owner', 'admin', 'editor', 'viewer'], default: 'viewer' },
  permissions: {
    canManageRewards: { type: Boolean, default: false },
    canManageTeam: { type: Boolean, default: false },
    canViewAnalytics: { type: Boolean, default: true },
    canManageBilling: { type: Boolean, default: false }
  },
  invitedAt: { type: Date, default: Date.now },
  joinedAt: { type: Date },
  deletedAt: { type: Date } // Soft delete
});

teamMemberSchema.index({ organization: 1, user: 1 }, { unique: true });
teamMemberSchema.index({ user: 1, deletedAt: 1 });

// ==================== SUBSCRIPTION PLAN ====================
// Plan templates con quota limits
const subscriptionPlanSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  slug: { type: String, required: true, unique: true },
  displayName: { type: String },
  description: { type: String },
  priceMonthly: { type: Number, required: true },
  priceYearly: { type: Number },
  stripePriceIdMonthly: String,
  stripePriceIdYearly: String,
  
  // Quotas
  quotas: {
    maxRewards: { type: Number, required: true },
    maxTeamMembers: { type: Number, required: true },
    maxApiCallsPerMonth: { type: Number, required: true },
    maxWebhooksPerMonth: { type: Number, required: true },
    customBranding: { type: Boolean, default: false },
    advancedAnalytics: { type: Boolean, default: false },
    prioritySupport: { type: Boolean, default: false },
    whiteLabel: { type: Boolean, default: false },
    webhookIntegrations: { type: Boolean, default: false }
  },

  order: { type: Number, default: 0 }, // Per ordinamento nella UI
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

// ==================== USAGE RECORD ====================
// Track API/webhook usage per enforcement quota
const usageRecordSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  type: { type: String, enum: ['api_call', 'webhook_event', 'reward_created', 'team_member_added'], required: true },
  metadata: mongoose.Schema.Types.Mixed, // Dettagli aggiuntivi
  createdAt: { type: Date, default: Date.now, expires: 2592000 } // TTL: 30 giorni
});

usageRecordSchema.index({ organization: 1, type: 1, createdAt: 1 });

// ==================== INVOICE ====================
// Fatture Stripe syncate
const invoiceSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  stripeInvoiceId: { type: String, required: true, unique: true },
  amount: { type: Number }, // in cents
  currency: { type: String, default: 'usd' },
  status: { type: String, enum: ['paid', 'draft', 'open', 'void', 'uncollectible'], default: 'open' },
  pdfUrl: String,
  periodStart: Date,
  periodEnd: Date,
  paidAt: Date,
  createdAt: { type: Date, default: Date.now }
});

// ==================== API KEY ====================
// Per autenticazione programmatica (future)
const apiKeySchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  key: { type: String, required: true, unique: true, index: true },
  secret: { type: String, required: true }, // Hashed
  lastUsedAt: Date,
  rateLimit: { type: Number, default: 1000 }, // req/min
  scopes: [String], // es: ['rewards:read', 'rewards:write']
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: Date
});

// ==================== UPDATED USER SCHEMA ====================
// Extended with organization support
const userSchema = new mongoose.Schema({
  kickUsername: { type: String, required: true, unique: true, lowercase: true },
  kickDisplayName: { type: String },
  kickAvatarUrl: { type: String },
  kickChannelId: { type: String },
  kickAccessToken: { type: String },
  kickRefreshToken: { type: String },
  
  // Email (from Kick or fallback)
  email: { type: String },
  
  // Primary organization (for quick access)
  primaryOrganization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization' },
  
  // Feature flags
  features: {
    betaFeatures: { type: Boolean, default: false },
    customDomain: { type: Boolean, default: false }
  },

  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
  deletedAt: { type: Date } // Soft delete
});

userSchema.index({ kickUsername: 1, deletedAt: 1 });
userSchema.index({ email: 1, deletedAt: 1 });

// ==================== REWARD (updated) ====================
const rewardSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  points: { type: Number, required: true },
  type: { type: String, enum: ['bonus', 'shoutout', 'emote', 'custom'], default: 'custom' },
  icon: String,
  active: { type: Boolean, default: true },
  redeemedCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

rewardSchema.index({ organization: 1, active: 1 });

// ==================== VIEWER POINTS (updated) ====================
const viewerPointsSchema = new mongoose.Schema({
  organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  viewerUsername: { type: String, required: true, lowercase: true },
  streamerUsername: { type: String, required: true, lowercase: true },
  points: { type: Number, default: 0 },
  totalEarned: { type: Number, default: 0 },
  lastSeen: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now }
});

viewerPointsSchema.index({ organization: 1, viewerUsername: 1, streamerUsername: 1 }, { unique: true });
viewerPointsSchema.index({ organization: 1, streamerUsername: 1, points: -1 }); // For leaderboard

// ==================== ACHIEVEMENT ====================
// Badge/achievement definitions (e.g., "Earned 1000 points", "10 referrals")
const achievementSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  name: { type: String, required: true },
  description: { type: String },
  icon: { type: String }, // emoji or URL
  badge: { type: String }, // Display badge HTML/text
  category: { 
    type: String, 
    enum: ['engagement', 'loyalty', 'spending', 'social', 'milestone', 'special'],
    default: 'milestone'
  },
  
  // Unlock condition
  unlockCondition: {
    type: { 
      type: String, 
      enum: ['points_milestone', 'redemptions', 'consecutive_days', 'referrals', 'streak', 'custom'],
      required: true 
    },
    value: { type: Number }, // e.g., 1000 points for "points_milestone"
    customLogic: { type: String } // For type='custom'
  },
  
  // Reward
  pointReward: { type: Number, default: 0 }, // Bonus points for unlocking
  badgeReward: { type: String }, // Display in profile
  
  // State
  isActive: { type: Boolean, default: true },
  displayOrder: { type: Number, default: 0 },
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

achievementSchema.index({ organizationId: 1, isActive: 1, displayOrder: 1 });

// ==================== USER ACHIEVEMENT ====================
// Track which achievements a viewer has unlocked
const userAchievementSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  achievementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement', required: true },
  viewerUsername: { type: String, required: true, lowercase: true },
  
  // Achievement details (snapshot at unlock)
  achievementName: { type: String },
  achievementIcon: { type: String },
  icon: { type: String },
  badge: { type: String },
  pointReward: { type: Number, default: 0 },
  
  // Unlock info
  unlockedAt: { type: Date, default: Date.now },
  progress: { type: Number, default: 100 }, // 0-100, represents progress to unlock
  notified: { type: Boolean, default: false },
  
  createdAt: { type: Date, default: Date.now }
});

userAchievementSchema.index({ organizationId: 1, viewerUsername: 1, achievementId: 1 }, { unique: true });
userAchievementSchema.index({ organizationId: 1, viewerUsername: 1, unlockedAt: -1 });

// ==================== LEADERBOARD (cached stats for performance) ====================
const leaderboardSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  
  // Stats period
  period: { 
    type: String, 
    enum: ['all_time', 'monthly', 'weekly', 'daily'],
    default: 'all_time'
  },
  periodDate: { type: Date }, // For monthly/weekly/daily (start of period)
  
  // Leaderboard entries (top 100)
  entries: [{
    rank: Number,
    viewerUsername: String,
    points: Number,
    achievements: Number,
    streaks: Number,
    lastUpdate: Date
  }],
  
  // Metadata
  lastUpdated: { type: Date, default: Date.now },
  totalParticipants: { type: Number, default: 0 }
});

leaderboardSchema.index({ organizationId: 1, period: 1, periodDate: 1 }, { unique: true });

// ==================== TWO-FACTOR AUTHENTICATION ====================
// Store 2FA secrets and backup codes for users
const twoFactorSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  
  // TOTP Secret
  secret: { type: String, required: true }, // Encrypted secret for TOTP (speakeasy)
  backupCodes: [{
    code: String,           // Encrypted backup code
    used: { type: Boolean, default: false },
    usedAt: Date
  }],
  
  // Status
  isEnabled: { type: Boolean, default: false },
  verifiedAt: { type: Date }, // When 2FA was verified
  
  // Recovery info
  lastVerified: { type: Date },
  failedAttempts: { type: Number, default: 0 },
  lockedUntil: { type: Date }, // Rate limiting after too many failed attempts
  
  // Trusted devices (optional: skip 2FA on trusted devices)
  trustedDevices: [{
    deviceId: String,
    deviceName: String,
    userAgent: String,
    ipAddress: String,
    addedAt: Date,
    lastUsedAt: Date
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

twoFactorSchema.index({ userId: 1, isEnabled: 1 });
twoFactorSchema.index({ organizationId: 1, isEnabled: 1 });

// ==================== AUDIT LOG ====================
// Immutable append-only audit trail for compliance & security
const auditLogSchema = new mongoose.Schema({
  // Actor (who did it)
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
  username: String, // Denormalized for readability
  
  // Action details
  action: { 
    type: String, 
    enum: [
      'create', 'update', 'delete', 'restore',
      'permission_change', 'role_grant', 'role_revoke',
      'login', 'logout', 'password_change', '2fa_enable', '2fa_disable',
      'api_key_create', 'api_key_delete', 'api_key_revoke',
      'subscription_change', 'payment_processed', 'invoice_generated',
      'webhook_send', 'export_data', 'bulk_operation', 'admin_action',
      'security_event', 'data_access'
    ],
    required: true,
    index: true
  },
  
  // What was affected
  resourceType: {
    type: String,
    enum: [
      'user', 'team_member', 'reward', 'viewer_points',
      'achievement', 'leaderboard', 'organization', 'subscription',
      'invoice', 'api_key', 'webhook', 'two_factor', 'role',
      'webhook_event', 'bulk_upload', 'system'
    ],
    required: true,
    index: true
  },
  resourceId: String, // ID of affected resource
  resourceName: String, // Human-readable name (reward name, user email, etc.)
  
  // Change details
  details: String, // Human-readable description
  changes: {
    before: mongoose.Schema.Types.Mixed, // Previous state
    after: mongoose.Schema.Types.Mixed   // New state
  },
  
  // Request context
  ipAddress: String,
  userAgent: String,
  ipCountry: String, // Geo-location (optional)
  
  // Result
  success: { type: Boolean, default: true, index: true },
  statusCode: Number,
  error: String, // If failed, what was the error
  
  // Metadata
  createdAt: { type: Date, default: Date.now, index: true },
  // Note: We NEVER delete audit logs (immutable)
  // Note: We NEVER update audit logs (append-only)
});

// Indexes for common queries
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, resourceType: 1, createdAt: -1 });
auditLogSchema.index({ organizationId: 1, success: 1, createdAt: -1 });
// TTL Index for old log cleanup (optional - adjust retention period)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days default

// ==================== REDEMPTION ====================
// Redemption requests: viewers riscattano punti per rewards
const redemptionSchema = new mongoose.Schema({
  // References
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  rewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  viewerUsername: String, // Cache viewer username for readability
  
  // Redemption details
  quantity: { type: Number, default: 1, required: true }, // Numero di volte riscattato
  pointsSpent: { type: Number, required: true }, // Punti totali spesi
  
  // Status workflow
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'fulfilled', 'expired', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  // Timestamps
  requestedAt: { type: Date, default: Date.now, index: true },
  reviewedAt: { type: Date }, // When admin reviewed
  fulfilledAt: { type: Date }, // When admin fulfilled the reward
  expiresAt: { type: Date }, // Auto-expire after 30 days if not fulfilled
  
  // Admin review
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // Admin who reviewed
  approverComments: String, // Admin notes (approval or rejection reason)
  
  // Fulfillment details
  fulfillmentMethod: { // How was reward delivered
    type: String,
    enum: ['digital', 'physical', 'credit', 'voucher', 'other'],
    default: 'digital'
  },
  fulfillmentDetails: {
    trackingNumber: String, // For physical items
    voucherCode: String, // For vouchers
    creditAmount: Number, // For credit
    deliveredTo: String // Email, address, etc.
  },
  
  // Activity log
  activityLog: [{
    action: String, // pending_created, approved, rejected, fulfilled, etc.
    by: mongoose.Schema.Types.ObjectId, // User who performed action
    timestamp: { type: Date, default: Date.now },
    notes: String
  }],
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient querying
redemptionSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
redemptionSchema.index({ userId: 1, organizationId: 1, createdAt: -1 });
redemptionSchema.index({ rewardId: 1, organizationId: 1, status: 1 });
redemptionSchema.index({ status: 1, expiresAt: 1 }); // For expiry processing

// ==================== SMS NOTIFICATION ====================
// SMS notification tracking for viewers and admins
const smsNotificationSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  viewerPhoneNumber: { type: String, required: true }, // E.164 format: +1234567890
  
  // Message details
  type: {
    type: String,
    enum: [
      'redemption_requested',    // When viewer requests reward
      'redemption_approved',      // When admin approves
      'redemption_rejected',      // When admin rejects
      'fulfillment_ready',        // When order ready for pickup
      'low_points_alert',         // When points fall below threshold
      'new_reward_available',     // When new reward added to org
      'achievement_unlocked',     // When viewer earns achievement
      'leaderboard_milestone',    // When viewer reaches leaderboard rank
      'system_alert',             // General system messages
      'custom'                    // Custom admin message
    ],
    required: true,
    index: true
  },
  
  // SMS content
  message: { type: String, required: true },
  templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'SmsTemplate' }, // Reference to template
  
  // Related entity
  relatedRedemptionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Redemption' },
  relatedRewardId: { type: mongoose.Schema.Types.ObjectId, ref: 'Reward' },
  relatedAchievementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Achievement' },
  
  // Delivery tracking
  status: {
    type: String,
    enum: ['pending', 'queued', 'sent', 'delivered', 'failed', 'undelivered', 'bounced'],
    default: 'pending',
    index: true
  },
  provider: { type: String, enum: ['twilio', 'aws-sns', 'nexmo'], default: 'twilio' },
  providerMessageId: { type: String }, // SMS provider's ID for tracking
  
  // Timing
  sendAt: { type: Date, default: Date.now }, // When to send (for scheduled SMS)
  sentAt: { type: Date }, // When actually sent
  deliveredAt: { type: Date }, // Delivery confirmation from provider
  
  // Error handling
  failureReason: { type: String }, // Why it failed (invalid number, provider error, etc.)
  failureCode: { type: String }, // Provider-specific error code
  retryCount: { type: Number, default: 0 },
  maxRetries: { type: Number, default: 3 },
  nextRetryAt: { type: Date },
  
  // User preferences
  userOptedOut: { type: Boolean, default: false }, // If user unsubscribed
  
  // Metrics
  cost: { type: Number, default: 0 }, // In cents
  segmentCount: { type: Number, default: 1 }, // SMS segments (long SMS = multiple segments)
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient querying
smsNotificationSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
smsNotificationSchema.index({ userId: 1, organizationId: 1, createdAt: -1 });
smsNotificationSchema.index({ status: 1, sendAt: 1 }); // For processing pending/queued
smsNotificationSchema.index({ organizationId: 1, type: 1, createdAt: -1 });
smsNotificationSchema.index({ sentAt: 1, deliveredAt: 1 }); // For delivery tracking
smsNotificationSchema.index({ nextRetryAt: 1 }); // For retry processing

// ==================== SMS TEMPLATE ====================
// Reusable SMS message templates for organizations
const smsTemplateSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  
  // Template identity
  name: { type: String, required: true }, // e.g., "Redemption Approved"
  type: {
    type: String,
    enum: [
      'redemption_requested', 'redemption_approved', 'redemption_rejected',
      'fulfillment_ready', 'low_points_alert', 'new_reward_available',
      'achievement_unlocked', 'leaderboard_milestone', 'system_alert', 'custom'
    ],
    required: true
  },
  description: { type: String },
  
  // Template content
  messageTemplate: { type: String, required: true }, // {{rewardName}}, {{points}}, {{expiresAt}} support
  variables: { type: [String], default: [] }, // List of variables like ['rewardName', 'points']
  
  // Configuration
  active: { type: Boolean, default: true },
  charLimit: { type: Number, default: 160 }, // SMS character limit
  currentLength: { type: Number, default: 0 }, // Current message length
  
  // Usage
  usageCount: { type: Number, default: 0 }, // How many times used
  lastUsedAt: { type: Date },
  
  // Scheduling
  autoSend: { type: Boolean, default: false }, // Send automatically on event
  sendDelay: { type: Number, default: 0 }, // Delay in seconds before sending
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

smsTemplateSchema.index({ organizationId: 1, type: 1 });
smsTemplateSchema.index({ organizationId: 1, active: 1 });

// ==================== SMS SETTINGS ====================
// Per-user SMS preferences and settings
const smsSettingsSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Contact info
  phoneNumber: { type: String, required: true }, // E.164 format
  verificationCode: { type: String }, // For phone verification
  isPhoneVerified: { type: Boolean, default: false },
  phoneVerifiedAt: { type: Date },
  
  // Preferences
  smsEnabled: { type: Boolean, default: true },
  optedOutAt: { type: Date }, // When user opted out
  
  // Notification preferences
  notifications: {
    redemptionRequests: { type: Boolean, default: true },
    redemptionApprovals: { type: Boolean, default: true },
    redemptionRejections: { type: Boolean, default: true },
    fulfillmentReady: { type: Boolean, default: true },
    lowPointsAlert: { type: Boolean, default: true },
    newRewards: { type: Boolean, default: true },
    achievements: { type: Boolean, default: true },
    leaderboardUpdates: { type: Boolean, default: false }, // Opt-in only
    systemAlerts: { type: Boolean, default: true }
  },
  
  // Rate limiting
  dailyLimit: { type: Number, default: 10 }, // Max SMS per day
  weeklyLimit: { type: Number, default: 50 }, // Max SMS per week
  smsSentToday: { type: Number, default: 0 },
  smsSentThisWeek: { type: Number, default: 0 },
  lastSmsAt: { type: Date },
  
  // Global settings (admin)
  smsApiKey: { type: String }, // Encrypted 
  smsProvider: { type: String, enum: ['twilio', 'aws-sns', 'nexmo'], default: 'twilio' },
  enabledForOrg: { type: Boolean, default: false }, // Is SMS enabled for this org (admin setting)
  
  // Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

smsSettingsSchema.index({ organizationId: 1, userId: 1 });
smsSettingsSchema.index({ organizationId: 1, smsEnabled: 1 });

// ==================== BATCH JOB ====================
// Track batch operation jobs
const batchJobSchema = new mongoose.Schema({
  _id: { type: String }, // Custom ID generated by batch routes
  type: { 
    type: String, 
    required: true, 
    enum: ['rewards_create', 'rewards_update', 'rewards_delete', 'users_import', 'points_assign', 'redemptions_process'],
    index: true
  },
  status: { 
    type: String, 
    required: true, 
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  
  // Progress tracking
  totalCount: { type: Number, required: true },
  processedCount: { type: Number, default: 0 },
  successCount: { type: Number, default: 0 },
  errorCount: { type: Number, default: 0 },
  progress: { type: Number, default: 0, min: 0, max: 100 }, // Percentage
  
  // Results
  results: {
    processed: Number,
    success: Number,
    errors: Number,
    details: [{
      index: Number,
      status: String,
      id: String,
      error: String,
      data: mongoose.Schema.Types.Mixed
    }]
  },
  
  // Error info
  error: { type: String },
  
  // Metadata
  metadata: { type: mongoose.Schema.Types.Mixed },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now, index: true },
  updatedAt: { type: Date, default: Date.now },
  completedAt: { type: Date },
  
  // Expiration (auto-delete old jobs after 30 days)
  expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }
});

batchJobSchema.index({ organizationId: 1, status: 1 });
batchJobSchema.index({ organizationId: 1, type: 1 });
batchJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL index

// ==================== WEBHOOK ====================
// External webhook configuration for event notifications
const webhookSchema = new mongoose.Schema({
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  
  // Basic info
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true },
  
  // Endpoint
  url: { type: String, required: true, trim: true }, // Must be HTTPS in production
  method: { type: String, enum: ['POST', 'PUT', 'PATCH'], default: 'POST' },
  
  // Authentication
  auth: {
    type: { type: String, enum: ['none', 'bearer', 'basic', 'hmac'], default: 'none' },
    secret: { type: String }, // For bearer token or HMAC
    username: { type: String }, // For basic auth
    password: { type: String }  // For basic auth
  },
  
  // Headers
  headers: [{ key: String, value: String }],
  
  // Events to subscribe to
  events: [{ 
    type: String, 
    enum: [
      'user.created', 'user.updated', 'user.deleted',
      'reward.created', 'reward.updated', 'reward.deleted',
      'redemption.requested', 'redemption.approved', 'redemption.rejected', 'redemption.fulfilled',
      'points.assigned', 'points.redeemed',
      'achievement.unlocked',
      'member.invited', 'member.joined', 'member.left',
      'subscription.created', 'subscription.cancelled', 'subscription.updated',
      'batch.job.completed', 'batch.job.failed'
    ]
  }],
  
  // Status
  active: { type: Boolean, default: true },
  
  // Delivery settings
  retryPolicy: {
    maxRetries: { type: Number, default: 3 },
    initialDelay: { type: Number, default: 1000 }, // ms
    maxDelay: { type: Number, default: 60000 }, // ms
    backoffMultiplier: { type: Number, default: 2 }
  },
  
  // Delivery stats
  stats: {
    totalDeliveries: { type: Number, default: 0 },
    successfulDeliveries: { type: Number, default: 0 },
    failedDeliveries: { type: Number, default: 0 },
    lastDeliveryAt: { type: Date },
    lastFailureAt: { type: Date },
    lastError: { type: String }
  },
  
  // Metadata
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

webhookSchema.index({ organizationId: 1, active: 1 });
webhookSchema.index({ organizationId: 1, events: 1 });

// ==================== WEBHOOK DELIVERY LOG ====================
// Log of webhook delivery attempts
const webhookDeliverySchema = new mongoose.Schema({
  webhookId: { type: mongoose.Schema.Types.ObjectId, ref: 'Webhook', required: true, index: true },
  organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
  
  // Event details
  event: { type: String, required: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  
  // Delivery details
  attemptNumber: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'success', 'failed'], required: true },
  
  // Request/Response
  request: {
    url: String,
    method: String,
    headers: mongoose.Schema.Types.Mixed,
    body: String,
    timestamp: Date
  },
  response: {
    statusCode: Number,
    headers: mongoose.Schema.Types.Mixed,
    body: String,
    timestamp: Date,
    duration: Number // ms
  },
  
  // Error info
  error: { type: String },
  
  // Next retry
  nextRetryAt: { type: Date },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  
  // Expiration (auto-delete after 7 days)
  expiresAt: { type: Date, default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
});

webhookDeliverySchema.index({ webhookId: 1, createdAt: -1 });
webhookDeliverySchema.index({ status: 1, nextRetryAt: 1 });
webhookDeliverySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ==================== MODEL EXPORTS ====================
module.exports = {
  Organization: mongoose.models.Organization || mongoose.model('Organization', organizationSchema),
  TeamMember: mongoose.models.TeamMember || mongoose.model('TeamMember', teamMemberSchema),
  SubscriptionPlan: mongoose.models.SubscriptionPlan || mongoose.model('SubscriptionPlan', subscriptionPlanSchema),
  UsageRecord: mongoose.models.UsageRecord || mongoose.model('UsageRecord', usageRecordSchema),
  Invoice: mongoose.models.Invoice || mongoose.model('Invoice', invoiceSchema),
  ApiKey: mongoose.models.ApiKey || mongoose.model('ApiKey', apiKeySchema),
  User: mongoose.models.User || mongoose.model('User', userSchema),
  Reward: mongoose.models.Reward || mongoose.model('Reward', rewardSchema),
  ViewerPoints: mongoose.models.ViewerPoints || mongoose.model('ViewerPoints', viewerPointsSchema),
  Achievement: mongoose.models.Achievement || mongoose.model('Achievement', achievementSchema),
  UserAchievement: mongoose.models.UserAchievement || mongoose.model('UserAchievement', userAchievementSchema),
  Leaderboard: mongoose.models.Leaderboard || mongoose.model('Leaderboard', leaderboardSchema),
  TwoFactor: mongoose.models.TwoFactor || mongoose.model('TwoFactor', twoFactorSchema),
  AuditLog: mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema),
  Redemption: mongoose.models.Redemption || mongoose.model('Redemption', redemptionSchema),
  SmsNotification: mongoose.models.SmsNotification || mongoose.model('SmsNotification', smsNotificationSchema),
  SmsTemplate: mongoose.models.SmsTemplate || mongoose.model('SmsTemplate', smsTemplateSchema),
  SmsSettings: mongoose.models.SmsSettings || mongoose.model('SmsSettings', smsSettingsSchema),
  BatchJob: mongoose.models.BatchJob || mongoose.model('BatchJob', batchJobSchema),
  Webhook: mongoose.models.Webhook || mongoose.model('Webhook', webhookSchema),
  WebhookDelivery: mongoose.models.WebhookDelivery || mongoose.model('WebhookDelivery', webhookDeliverySchema)
};
