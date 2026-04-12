// Leaderboard & Achievements Routes - Phase 2 Gamification
// Implement social features and achievement system

const express = require('express');
const router = express.Router();
const { authenticateToken, loadOrganization, requireOrganizationAccess, requirePermissions } = require('./middleware');
const { ViewerPoints, Achievement, UserAchievement, Leaderboard } = require('./models');

// Nota: authenticateToken rimosso da qui, applicato alle route specifiche se necessario

/**
 * GET /api/leaderboards
 * Get leaderboards for the organization
 * Query params: period (all_time|monthly|weekly|daily)
 */
router.get('/leaderboards', async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { period = 'all_time' } = req.query;
    
    // Get leaderboard from cache (or generate if missing)
    let leaderboard = await Leaderboard.findOne({
      organizationId: orgId,
      period: period,
      periodDate: { $gte: getPeriodStart(period) }
    });
    
    // If not found, generate from ViewerPoints
    if (!leaderboard || isLeaderboardStale(leaderboard)) {
      leaderboard = await generateLeaderboard(orgId, period);
    }
    
    res.json({
      organizationId: orgId,
      period,
      entries: leaderboard.entries || [],
      totalParticipants: leaderboard.totalParticipants,
      lastUpdated: leaderboard.lastUpdated,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /api/leaderboards/rank/:username
 * Get specific viewer's rank and position
 */
router.get('/leaderboards/rank/:username', async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { username } = req.params;
    const { period = 'all_time' } = req.query;
    
    // Get viewer's points
    const viewerPoints = await ViewerPoints.findOne({
      organization: orgId,
      viewerUsername: username.toLowerCase()
    });
    
    if (!viewerPoints) {
      return res.status(404).json({ error: 'Viewer not found' });
    }
    
    // Get leaderboard
    const leaderboard = await generateLeaderboard(orgId, period);
    
    // Find rank
    const rankEntry = leaderboard.entries.find(e => e.viewerUsername === username.toLowerCase());
    const rank = rankEntry?.rank || leaderboard.entries.length + 1;
    
    // Get achievements
    const achievements = await UserAchievement.find({
      organizationId: orgId,
      viewerUsername: username.toLowerCase()
    }).lean();
    
    // Get stats
    const totalViewers = leaderboard.totalParticipants;
    const percentile = ((totalViewers - rank) / totalViewers) * 100;
    
    res.json({
      organizationId: orgId,
      viewer: username,
      rank,
      percentile: percentile.toFixed(1),
      points: viewerPoints.points,
      totalEarned: viewerPoints.totalEarned,
      achievements: achievements.map(a => ({
        name: a.achievementName,
        icon: a.icon,
        badge: a.badge,
        unlockedAt: a.unlockedAt
      })),
      totalParticipants: totalViewers,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Rank lookup error:', error);
    res.status(500).json({ error: 'Failed to fetch rank' });
  }
});

/**
 * GET /api/achievements
 * Get all available achievements for organization
 */
router.get('/achievements', async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { category } = req.query;
    
    let query = { organizationId: orgId, isActive: true };
    if (category) query.category = category;
    
    const achievements = await Achievement.find(query)
      .sort({ displayOrder: 1 })
      .lean();
    
    res.json({
      organizationId: orgId,
      achievements: achievements.map(a => ({
        id: a._id,
        name: a.name,
        description: a.description,
        icon: a.icon,
        badge: a.badge,
        category: a.category,
        requirement: {
          type: a.unlockCondition.type,
          value: a.unlockCondition.value
        },
        reward: {
          points: a.pointReward,
          badge: a.badgeReward
        }
      })),
      total: achievements.length,
      categories: ['engagement', 'loyalty', 'spending', 'social', 'milestone', 'special']
    });
  } catch (error) {
    console.error('Achievements fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

/**
 * GET /api/achievements/:username
 * Get achievements unlocked by a viewer
 */
router.get('/achievements/:username', async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { username } = req.params;
    
    const achievements = await UserAchievement.find({
      organizationId: orgId,
      viewerUsername: username.toLowerCase()
    })
      .sort({ unlockedAt: -1 })
      .lean();
    
    const totalAvailable = await Achievement.countDocuments({
      organizationId: orgId,
      isActive: true
    });
    
    res.json({
      organizationId: orgId,
      viewer: username,
      unlockedAchievements: achievements.map(a => ({
        id: a.achievementId,
        name: a.achievementName,
        icon: a.icon,
        badge: a.badge,
        category: a.category,
        unlockedAt: a.unlockedAt,
        pointReward: a.pointReward,
        progress: a.progress
      })),
      totalUnlocked: achievements.length,
      totalAvailable,
      completionRate: ((achievements.length / totalAvailable) * 100).toFixed(1),
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('User achievements error:', error);
    res.status(500).json({ error: 'Failed to fetch user achievements' });
  }
});

/**
 * POST /api/achievements
 * Create new achievement
 * Admin only
 */
router.post('/achievements', requirePermissions(['admin']), async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { name, description, icon, badge, category, unlockCondition, pointReward, badgeReward, displayOrder } = req.body;
    
    // Validation
    if (!name || !unlockCondition || !unlockCondition.type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const achievement = new Achievement({
      organizationId: orgId,
      name,
      description,
      icon,
      badge,
      category: category || 'milestone',
      unlockCondition,
      pointReward: pointReward || 0,
      badgeReward,
      displayOrder: displayOrder || 0
    });
    
    await achievement.save();
    
    res.status(201).json({
      message: 'Achievement created',
      achievement: {
        id: achievement._id,
        name: achievement.name,
        category: achievement.category,
        requirement: achievement.unlockCondition
      }
    });
  } catch (error) {
    console.error('Create achievement error:', error);
    res.status(500).json({ error: 'Failed to create achievement' });
  }
});

/**
 * PATCH /api/achievements/:id
 * Update achievement
 * Admin only
 */
router.patch('/achievements/:id', requirePermissions(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.organization._id;
    const updates = req.body;
    
    // Remove sensitive fields
    delete updates.organizationId;
    delete updates.createdAt;
    
    const achievement = await Achievement.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { ...updates, updatedAt: new Date() },
      { new: true }
    );
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    res.json({
      message: 'Achievement updated',
      achievement: achievement.toObject()
    });
  } catch (error) {
    console.error('Update achievement error:', error);
    res.status(500).json({ error: 'Failed to update achievement' });
  }
});

/**
 * POST /api/achievements/:username/check
 * Check and unlock achievements for viewer
 * Called after significant events (points earned, referral, etc)
 */
router.post('/achievements/:username/check', requirePermissions(['admin']), async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { username } = req.params;
    const usernameLC = username.toLowerCase();
    
    // Get viewer stats
    const viewerPoints = await ViewerPoints.findOne({
      organization: orgId,
      viewerUsername: usernameLC
    });
    
    if (!viewerPoints) {
      return res.status(404).json({ error: 'Viewer not found' });
    }
    
    // Get all active achievements
    const achievements = await Achievement.find({
      organizationId: orgId,
      isActive: true
    });
    
    const unlockedAchievements = [];
    
    // Check each achievement
    for (const achievement of achievements) {
      const alreadyUnlocked = await UserAchievement.findOne({
        organizationId: orgId,
        achievementId: achievement._id,
        viewerUsername: usernameLC
      });
      
      if (alreadyUnlocked) continue;
      
      // Check unlock condition
      let shouldUnlock = false;
      
      switch (achievement.unlockCondition.type) {
        case 'points_milestone':
          shouldUnlock = viewerPoints.totalEarned >= achievement.unlockCondition.value;
          break;
        case 'redemptions':
          // Would need to count redemptions
          const userRedemptions = await UserAchievement.countDocuments({
            organizationId: orgId,
            viewerUsername: usernameLC
          });
          shouldUnlock = userRedemptions >= achievement.unlockCondition.value;
          break;
        case 'consecutive_days':
          // Track last seen - would need more logic
          const daysSinceStart = Math.floor((Date.now() - viewerPoints.createdAt) / (1000 * 60 * 60 * 24));
          shouldUnlock = daysSinceStart >= achievement.unlockCondition.value;
          break;
      }
      
      // Unlock achievement
      if (shouldUnlock) {
        const userAchievement = new UserAchievement({
          organizationId: orgId,
          achievementId: achievement._id,
          viewerUsername: usernameLC,
          achievementName: achievement.name,
          achievementIcon: achievement.icon,
          icon: achievement.icon,
          badge: achievement.badge,
          pointReward: achievement.pointReward,
          unlockedAt: new Date(),
          progress: 100,
          notified: false
        });
        
        await userAchievement.save();
        
        // Award bonus points if any
        if (achievement.pointReward > 0) {
          viewerPoints.points += achievement.pointReward;
          viewerPoints.totalEarned += achievement.pointReward;
          await viewerPoints.save();
        }
        
        unlockedAchievements.push({
          name: achievement.name,
          icon: achievement.icon,
          pointReward: achievement.pointReward
        });
      }
    }
    
    res.json({
      organizationId: orgId,
      viewer: username,
      newAchievements: unlockedAchievements,
      totalUnlocked: unlockedAchievements.length,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Achievement check error:', error);
    res.status(500).json({ error: 'Failed to check achievements' });
  }
});

/**
 * GET /api/achievements/:username/progress
 * Get progress towards unlocking achievements
 */
router.get('/achievements/:username/progress', async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { username } = req.params;
    const usernameLC = username.toLowerCase();
    
    // Get viewer stats
    const viewerPoints = await ViewerPoints.findOne({
      organization: orgId,
      viewerUsername: usernameLC
    });
    
    if (!viewerPoints) {
      return res.status(404).json({ error: 'Viewer not found' });
    }
    
    // Get locked achievements
    const achievements = await Achievement.find({
      organizationId: orgId,
      isActive: true
    });
    
    const lockedAchievements = await UserAchievement.find({
      organizationId: orgId,
      viewerUsername: usernameLC
    }).select('achievementId');
    
    const unlockedIds = lockedAchievements.map(a => a.achievementId.toString());
    
    const progress = achievements
      .filter(a => !unlockedIds.includes(a._id.toString()))
      .map(a => {
        let currentProgress = 0;
        let progressText = '';
        
        switch (a.unlockCondition.type) {
          case 'points_milestone':
            currentProgress = (viewerPoints.totalEarned / a.unlockCondition.value) * 100;
            progressText = `${viewerPoints.totalEarned}/${a.unlockCondition.value} points`;
            break;
          case 'consecutive_days':
            const days = Math.floor((Date.now() - viewerPoints.createdAt) / (1000 * 60 * 60 * 24));
            currentProgress = (days / a.unlockCondition.value) * 100;
            progressText = `${days}/${a.unlockCondition.value} days`;
            break;
        }
        
        return {
          id: a._id,
          name: a.name,
          icon: a.icon,
          progress: Math.min(100, currentProgress),
          progressText,
          requirement: {
            type: a.unlockCondition.type,
            value: a.unlockCondition.value
          }
        };
      });
    
    res.json({
      organizationId: orgId,
      viewer: username,
      achievements: progress,
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Achievement progress error:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

/**
 * DELETE /api/achievements/:id
 * Delete achievement (soft delete)
 * Admin only
 */
router.delete('/achievements/:id', requirePermissions(['admin']), async (req, res) => {
  try {
    const { id } = req.params;
    const orgId = req.organization._id;
    
    const achievement = await Achievement.findOneAndUpdate(
      { _id: id, organizationId: orgId },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );
    
    if (!achievement) {
      return res.status(404).json({ error: 'Achievement not found' });
    }
    
    res.json({ message: 'Achievement deactivated' });
  } catch (error) {
    console.error('Delete achievement error:', error);
    res.status(500).json({ error: 'Failed to delete achievement' });
  }
});

/**
 * Helper Functions
 */

function getPeriodStart(period) {
  const now = new Date();
  
  switch (period) {
    case 'daily':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'weekly':
      const day = now.getDate();
      const diff = now.getDay(); // 0 = Sunday
      return new Date(now.getFullYear(), now.getMonth(), day - diff);
    case 'monthly':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'all_time':
    default:
      return new Date(0);
  }
}

function isLeaderboardStale(leaderboard) {
  const now = Date.now();
  const boardAge = now - leaderboard.lastUpdated.getTime();
  const oneHour = 60 * 60 * 1000;
  return boardAge > oneHour; // Refresh if > 1 hour old
}

async function generateLeaderboard(orgId, period) {
  const periodStart = getPeriodStart(period);
  
  // Get top 100 viewers by points
  const topViewers = await ViewerPoints.aggregate([
    { $match: { organization: orgId } },
    {
      $group: {
        _id: '$viewerUsername',
        points: { $max: '$points' },
        totalEarned: { $max: '$totalEarned' }
      }
    },
    { $sort: { totalEarned: -1 } },
    { $limit: 100 }
  ]);
  
  // Convert to leaderboard entries with ranks
  const entries = topViewers.map((viewer, idx) => ({
    rank: idx + 1,
    viewerUsername: viewer._id,
    points: viewer.points,
    achievements: 0, // Would count UserAchievements
    streaks: 0,
    lastUpdate: new Date()
  }));
  
  // Save to cache
  const leaderboard = new Leaderboard({
    organizationId: orgId,
    period,
    periodDate: periodStart,
    entries,
    lastUpdated: new Date(),
    totalParticipants: topViewers.length
  });
  
  try {
    await leaderboard.save();
  } catch (e) {
    // Update if exists for this period
    await Leaderboard.updateOne(
      { organizationId: orgId, period, periodDate: periodStart },
      {
        entries,
        lastUpdated: new Date(),
        totalParticipants: topViewers.length
      },
      { upsert: true }
    );
  }
  
  return leaderboard;
}

module.exports = router;
