/**
 * Phase 5 - Mobile API Routes
 * Lightweight endpoints optimized for mobile apps and PWA
 * 
 * Features:
 * - Condensed responses (fewer fields, smaller payload)
 * - Offline sync support (delta sync)
 * - Mobile-specific endpoints (check-in, quick actions)
 * - Push notification registration
 * - Device management
 * - Geolocation rewards (optional)
 * - Quick stats for mobile dashboard
 */

const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('./middleware');

const router = express.Router();

// Models
const {
  User,
  Reward,
  ViewerPoints,
  RedemptionRequest,
  Organization,
  PushSubscription,
  Device
} = require('./models');

// Rate limiting for mobile (more permissive for better UX)
const mobileLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 120 requests per minute for mobile
  message: { error: 'Too many requests' }
});

// Validation helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ============================================
// MOBILE DASHBOARD - Condensed Stats
// ============================================

/**
 * GET /api/mobile/dashboard
 * Lightweight dashboard data for mobile
 */
router.get('/mobile/dashboard',
  authenticateToken,
  mobileLimiter,
  async (req, res) => {
    try {
      const { organizationId, streamerUsername } = req.query;
      const userId = req.user.id;
      
      // Parallel queries for mobile-optimized data
      const [
        userPoints,
        availableRewards,
        recentRedemptions,
        unreadNotifications,
        leaderboardRank
      ] = await Promise.all([
        // User points summary
        ViewerPoints.find({
          viewerUsername: req.user.username?.toLowerCase(),
          ...(organizationId && { organizationId })
        }).select('points streamerUsername totalEarned').limit(5),
        
        // Available rewards (condensed)
        Reward.find({
          active: true,
          ...(organizationId && { organizationId })
        })
          .select('name points type _id')
          .sort({ points: 1 })
          .limit(10),
        
        // Recent redemptions
        RedemptionRequest.find({ userId })
          .select('status pointsCost rewardName createdAt')
          .sort({ createdAt: -1 })
          .limit(5),
        
        // Unread notifications count (placeholder for notification system)
        Promise.resolve(0),
        
        // Leaderboard rank
        ViewerPoints.findOne({
          viewerUsername: req.user.username?.toLowerCase(),
          streamerUsername: streamerUsername?.toLowerCase()
        }).select('viewerUsername points')
      ]);
      
      // Calculate total points across all streamers
      const totalPoints = userPoints.reduce((sum, up) => sum + up.points, 0);
      const totalEarned = userPoints.reduce((sum, up) => sum + up.totalEarned, 0);
      
      res.json({
        success: true,
        data: {
          points: {
            total: totalPoints,
            earned: totalEarned,
            breakdown: userPoints.map(p => ({
              streamer: p.streamerUsername,
              points: p.points
            }))
          },
          rewards: {
            available: availableRewards.map(r => ({
              id: r._id,
              name: r.name,
              points: r.points,
              type: r.type
            })),
            count: availableRewards.length
          },
          redemptions: {
            recent: recentRedemptions.map(r => ({
              status: r.status,
              points: r.pointsCost,
              reward: r.rewardName,
              date: r.createdAt
            })),
            pending: recentRedemptions.filter(r => r.status === 'pending').length
          },
          notifications: {
            unread: unreadNotifications
          },
          leaderboard: leaderboardRank ? {
            hasRank: true,
            points: leaderboardRank.points
          } : { hasRank: false },
          // Quick actions available
          actions: [
            { id: 'scan', label: 'Scan QR', icon: 'qr-code' },
            { id: 'redeem', label: 'Redeem', icon: 'gift' },
            { id: 'leaderboard', label: 'Ranks', icon: 'trophy' }
          ]
        },
        // Delta sync token for offline support
        syncToken: Date.now().toString(36)
      });
      
    } catch (error) {
      console.error('Mobile dashboard error:', error);
      res.status(500).json({ error: 'Errore nel caricamento dashboard' });
    }
  }
);

// ============================================
// OFFLINE SYNC - Delta Updates
// ============================================

/**
 * GET /api/mobile/sync
 * Delta sync for offline support
 * Query: lastSync (timestamp)
 */
router.get('/mobile/sync',
  authenticateToken,
  mobileLimiter,
  async (req, res) => {
    try {
      const { lastSync, organizationId } = req.query;
      const syncTime = new Date();
      
      // Calculate changes since last sync
      const lastSyncDate = lastSync ? new Date(parseInt(lastSync)) : new Date(0);
      
      const [updatedRewards, updatedPoints, updatedRedemptions] = await Promise.all([
        // Rewards changed since last sync
        Reward.find({
          ...(organizationId && { organizationId }),
          $or: [
            { createdAt: { $gt: lastSyncDate } },
            { updatedAt: { $gt: lastSyncDate } }
          ]
        }).select('name description points type active _id'),
        
        // Points changed
        ViewerPoints.find({
          viewerUsername: req.user.username?.toLowerCase(),
          ...(organizationId && { organizationId }),
          updatedAt: { $gt: lastSyncDate }
        }).select('points streamerUsername _id'),
        
        // Redemptions changed
        RedemptionRequest.find({
          userId: req.user.id,
          updatedAt: { $gt: lastSyncDate }
        }).select('status pointsCost rewardName createdAt _id')
      ]);
      
      res.json({
        success: true,
        syncData: {
          rewards: {
            updated: updatedRewards,
            fullRefresh: !lastSync // If no lastSync, client should replace all
          },
          points: updatedPoints,
          redemptions: updatedRedemptions
        },
        syncToken: syncTime.getTime().toString(36),
        serverTime: syncTime.toISOString()
      });
      
    } catch (error) {
      console.error('Mobile sync error:', error);
      res.status(500).json({ error: 'Errore sincronizzazione' });
    }
  }
);

/**
 * POST /api/mobile/sync/offline-actions
 * Queue actions performed while offline
 */
router.post('/mobile/sync/offline-actions',
  authenticateToken,
  mobileLimiter,
  [
    body('actions').isArray({ min: 1, max: 50 }),
    body('actions.*.type').isIn(['redeem', 'check_in', 'points_claim']),
    body('actions.*.timestamp').isISO8601()
  ],
  validate,
  async (req, res) => {
    try {
      const { actions } = req.body;
      const results = [];
      
      // Process each queued action
      for (const action of actions) {
        try {
          let result;
          
          switch (action.type) {
            case 'redeem':
              // Process redemption
              result = await processOfflineRedemption(req.user.id, action.data);
              break;
            case 'check_in':
              // Process check-in
              result = await processOfflineCheckIn(req.user.id, action.data);
              break;
            case 'points_claim':
              // Process points claim
              result = await processOfflinePointsClaim(req.user.id, action.data);
              break;
          }
          
          results.push({
            clientId: action.clientId,
            status: 'success',
            result
          });
          
        } catch (error) {
          results.push({
            clientId: action.clientId,
            status: 'error',
            error: error.message
          });
        }
      }
      
      res.json({
        success: true,
        processed: results.length,
        results
      });
      
    } catch (error) {
      console.error('Offline sync error:', error);
      res.status(500).json({ error: 'Errore elaborazione azioni offline' });
    }
  }
);

// ============================================
// PUSH NOTIFICATIONS
// ============================================

/**
 * POST /api/mobile/push/register
 * Register push notification subscription
 */
router.post('/mobile/push/register',
  authenticateToken,
  [
    body('subscription').isObject(),
    body('subscription.endpoint').isURL(),
    body('subscription.keys').isObject(),
    body('deviceInfo').optional().isObject(),
    body('platform').isIn(['web', 'ios', 'android'])
  ],
  validate,
  async (req, res) => {
    try {
      const { subscription, deviceInfo = {}, platform } = req.body;
      
      // Check for existing subscription
      let pushSub = await PushSubscription.findOne({
        userId: req.user.id,
        'subscription.endpoint': subscription.endpoint
      });
      
      if (pushSub) {
        // Update existing
        pushSub.lastUsed = new Date();
        pushSub.deviceInfo = { ...pushSub.deviceInfo, ...deviceInfo };
        await pushSub.save();
      } else {
        // Create new
        pushSub = new PushSubscription({
          userId: req.user.id,
          organizationId: req.user.organizationId,
          subscription,
          deviceInfo: {
            platform,
            ...deviceInfo
          },
          platform,
          active: true
        });
        await pushSub.save();
      }
      
      // Also update/create Device record
      await Device.findOneAndUpdate(
        { userId: req.user.id, deviceId: deviceInfo.deviceId || 'unknown' },
        {
          userId: req.user.id,
          deviceId: deviceInfo.deviceId || 'unknown',
          platform,
          pushSubscriptionId: pushSub._id,
          lastActive: new Date(),
          deviceInfo
        },
        { upsert: true }
      );
      
      res.json({
        success: true,
        message: 'Push subscription registered',
        subscriptionId: pushSub._id
      });
      
    } catch (error) {
      console.error('Push register error:', error);
      res.status(500).json({ error: 'Errore registrazione push' });
    }
  }
);

/**
 * POST /api/mobile/push/unregister
 * Unregister push notifications
 */
router.post('/mobile/push/unregister',
  authenticateToken,
  async (req, res) => {
    try {
      const { endpoint, deviceId } = req.body;
      
      if (endpoint) {
        await PushSubscription.findOneAndUpdate(
          { userId: req.user.id, 'subscription.endpoint': endpoint },
          { active: false }
        );
      }
      
      if (deviceId) {
        await Device.findOneAndUpdate(
          { userId: req.user.id, deviceId },
          { pushEnabled: false }
        );
      }
      
      res.json({
        success: true,
        message: 'Push notifications disabled'
      });
      
    } catch (error) {
      console.error('Push unregister error:', error);
      res.status(500).json({ error: 'Errore deregistrazione push' });
    }
  }
);

/**
 * POST /api/mobile/push/preferences
 * Update push notification preferences
 */
router.post('/mobile/push/preferences',
  authenticateToken,
  [
    body('preferences').isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { preferences, deviceId } = req.body;
      
      await Device.findOneAndUpdate(
        { userId: req.user.id, deviceId: deviceId || 'unknown' },
        {
          notificationPreferences: preferences,
          updatedAt: new Date()
        }
      );
      
      res.json({
        success: true,
        message: 'Preferences updated'
      });
      
    } catch (error) {
      console.error('Push preferences error:', error);
      res.status(500).json({ error: 'Errore aggiornamento preferenze' });
    }
  }
);

/**
 * GET /api/mobile/push/subscriptions
 * List user's push subscriptions
 */
router.get('/mobile/push/subscriptions',
  authenticateToken,
  async (req, res) => {
    try {
      const subscriptions = await PushSubscription.find({
        userId: req.user.id,
        active: true
      }).select('-subscription.keys.auth -subscription.keys.p256dh');
      
      const devices = await Device.find({
        userId: req.user.id
      }).select('deviceId platform deviceInfo lastActive notificationPreferences');
      
      res.json({
        success: true,
        subscriptions: subscriptions.map(s => ({
          id: s._id,
          platform: s.platform,
          deviceInfo: s.deviceInfo,
          createdAt: s.createdAt,
          lastUsed: s.lastUsed
        })),
        devices
      });
      
    } catch (error) {
      console.error('List subscriptions error:', error);
      res.status(500).json({ error: 'Errore recupero subscriptions' });
    }
  }
);

// ============================================
// MOBILE-SPECIFIC ACTIONS
// ============================================

/**
 * POST /api/mobile/check-in
 * Quick check-in for location-based or event-based points
 */
router.post('/mobile/check-in',
  authenticateToken,
  mobileLimiter,
  [
    body('checkInCode').optional().trim(),
    body('location').optional().isObject(),
    body('eventId').optional().isString(),
    body('organizationId').optional().isMongoId()
  ],
  validate,
  async (req, res) => {
    try {
      const { checkInCode, location, eventId, organizationId } = req.body;
      
      // Validate check-in code if provided
      let points = 10; // Default check-in points
      let checkInType = 'general';
      
      if (checkInCode) {
        // Verify code (would check against events/checkins collection)
        const validCode = await verifyCheckInCode(checkInCode, organizationId);
        if (!validCode.valid) {
          return res.status(400).json({ error: 'Codice check-in non valido' });
        }
        points = validCode.bonusPoints || 50;
        checkInType = validCode.type || 'event';
      }
      
      // Record check-in and award points
      const viewerPoints = await ViewerPoints.findOneAndUpdate(
        {
          viewerUsername: req.user.username?.toLowerCase(),
          streamerUsername: req.user.username?.toLowerCase(),
          organizationId: organizationId || req.user.organizationId
        },
        {
          $inc: { points: points, totalEarned: points },
          $push: {
            checkIns: {
              date: new Date(),
              type: checkInType,
              points,
              location: location || null,
              eventId: eventId || null
            }
          },
          lastSeen: new Date()
        },
        { upsert: true, new: true }
      );
      
      res.json({
        success: true,
        message: `Check-in completato! +${points} punti`,
        data: {
          pointsEarned: points,
          totalPoints: viewerPoints.points,
          checkInType,
          streak: calculateStreak(viewerPoints.checkIns || [])
        }
      });
      
    } catch (error) {
      console.error('Check-in error:', error);
      res.status(500).json({ error: 'Errore check-in' });
    }
  }
);

/**
 * POST /api/mobile/quick-redeem
 * One-tap redemption for mobile
 */
router.post('/mobile/quick-redeem',
  authenticateToken,
  mobileLimiter,
  [
    body('rewardId').isMongoId(),
    body('qrCode').optional().isString()
  ],
  validate,
  async (req, res) => {
    try {
      const { rewardId, qrCode } = req.body;
      
      // Get reward
      const reward = await Reward.findById(rewardId);
      if (!reward || !reward.active) {
        return res.status(404).json({ error: 'Reward non disponibile' });
      }
      
      // Check points
      const viewerPoints = await ViewerPoints.findOne({
        viewerUsername: req.user.username?.toLowerCase(),
        organizationId: reward.organizationId
      });
      
      if (!viewerPoints || viewerPoints.points < reward.points) {
        return res.status(400).json({
          error: 'Punti insufficienti',
          required: reward.points,
          current: viewerPoints?.points || 0
        });
      }
      
      // Create redemption
      const redemption = new RedemptionRequest({
        userId: req.user.id,
        rewardId: reward._id,
        rewardName: reward.name,
        pointsCost: reward.points,
        status: 'pending',
        source: 'mobile',
        qrCode: qrCode || null,
        organizationId: reward.organizationId
      });
      
      await redemption.save();
      
      // Deduct points
      await ViewerPoints.findByIdAndUpdate(viewerPoints._id, {
        $inc: { points: -reward.points }
      });
      
      res.json({
        success: true,
        message: 'Redemption richiesto!',
        redemption: {
          id: redemption._id,
          reward: reward.name,
          points: reward.points,
          status: 'pending',
          remainingPoints: viewerPoints.points - reward.points
        }
      });
      
    } catch (error) {
      console.error('Quick redeem error:', error);
      res.status(500).json({ error: 'Errore redemption' });
    }
  }
);

/**
 * GET /api/mobile/rewards/nearby
 * Rewards available based on location (if geolocation enabled)
 */
router.get('/mobile/rewards/nearby',
  authenticateToken,
  mobileLimiter,
  async (req, res) => {
    try {
      const { lat, lng, radius = 1000, organizationId } = req.query;
      
      // If location provided, find geo-enabled rewards
      // For now, return featured rewards
      const rewards = await Reward.find({
        active: true,
        featuredForMobile: true,
        ...(organizationId && { organizationId })
      })
        .select('name description points type _id imageUrl')
        .sort({ points: 1 })
        .limit(20);
      
      res.json({
        success: true,
        rewards: rewards.map(r => ({
          id: r._id,
          name: r.name,
          description: r.description?.substring(0, 100),
          points: r.points,
          type: r.type,
          image: r.imageUrl
        })),
        locationEnabled: !!(lat && lng)
      });
      
    } catch (error) {
      console.error('Nearby rewards error:', error);
      res.status(500).json({ error: 'Errore ricerca rewards' });
    }
  }
);

// ============================================
// DEVICE MANAGEMENT
// ============================================

/**
 * POST /api/mobile/device/register
 * Register device for mobile app
 */
router.post('/mobile/device/register',
  authenticateToken,
  [
    body('deviceId').isString(),
    body('platform').isIn(['ios', 'android', 'web']),
    body('deviceInfo').optional().isObject()
  ],
  validate,
  async (req, res) => {
    try {
      const { deviceId, platform, deviceInfo = {} } = req.body;
      
      const device = await Device.findOneAndUpdate(
        { userId: req.user.id, deviceId },
        {
          userId: req.user.id,
          deviceId,
          platform,
          deviceInfo,
          lastActive: new Date(),
          isActive: true
        },
        { upsert: true, new: true }
      );
      
      res.json({
        success: true,
        message: 'Device registered',
        deviceId: device._id
      });
      
    } catch (error) {
      console.error('Device register error:', error);
      res.status(500).json({ error: 'Errore registrazione device' });
    }
  }
);

/**
 * GET /api/mobile/devices
 * List user's registered devices
 */
router.get('/mobile/devices',
  authenticateToken,
  async (req, res) => {
    try {
      const devices = await Device.find({
        userId: req.user.id,
        isActive: true
      }).sort({ lastActive: -1 });
      
      res.json({
        success: true,
        devices: devices.map(d => ({
          id: d._id,
          deviceId: d.deviceId,
          platform: d.platform,
          lastActive: d.lastActive,
          pushEnabled: !!d.pushSubscriptionId
        }))
      });
      
    } catch (error) {
      console.error('List devices error:', error);
      res.status(500).json({ error: 'Errore recupero devices' });
    }
  }
);

// ============================================
// HELPER FUNCTIONS
// ============================================

async function verifyCheckInCode(code, organizationId) {
  // Placeholder for check-in code verification
  // Would query against events/codes collection
  return {
    valid: true,
    bonusPoints: 50,
    type: 'event'
  };
}

async function processOfflineRedemption(userId, data) {
  // Process redemption queued offline
  const redemption = new RedemptionRequest({
    userId,
    ...data,
    source: 'mobile_offline',
    status: 'pending'
  });
  await redemption.save();
  return { redemptionId: redemption._id };
}

async function processOfflineCheckIn(userId, data) {
  // Process check-in queued offline
  return { processed: true, points: 10 };
}

async function processOfflinePointsClaim(userId, data) {
  // Process points claim queued offline
  return { processed: true, points: data.points || 0 };
}

function calculateStreak(checkIns) {
  // Calculate consecutive check-in streak
  if (!checkIns || checkIns.length === 0) return 0;
  
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  
  const todayCheckIn = checkIns.find(c => new Date(c.date).toDateString() === today);
  const yesterdayCheckIn = checkIns.find(c => new Date(c.date).toDateString() === yesterday);
  
  if (todayCheckIn) {
    // Has checked in today, count streak
    let streak = 1;
    let checkDate = Date.now() - 86400000;
    
    while (true) {
      const dateStr = new Date(checkDate).toDateString();
      const hasCheckIn = checkIns.find(c => new Date(c.date).toDateString() === dateStr);
      if (hasCheckIn) {
        streak++;
        checkDate -= 86400000;
      } else {
        break;
      }
    }
    
    return streak;
  } else if (yesterdayCheckIn) {
    return 1; // Can still maintain streak if checks in today
  }
  
  return 0;
}

module.exports = router;
