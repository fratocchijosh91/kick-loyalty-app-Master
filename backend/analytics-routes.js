// Analytics Routes - Phase 2
// Advanced analytics endpoints for dashboard insights

const express = require('express');
const router = express.Router();
const { authenticateToken, loadOrganization, requireOrganizationAccess, requirePermissions } = require('./middleware');
const { Organization, Reward, ViewerPoints, UsageRecord, Subscription } = require('./models');

// Nota: authenticateToken rimosso da qui, applicato alle route specifiche se necessario

/**
 * GET /api/analytics/overview
 * Overview statistics for organization dashboard
 * Requires: admin+ permissions
 * Returns: org stats, MRR, retention, etc
 */
router.get('/overview', requirePermissions(['admin']), async (req, res) => {
  try {
    const orgId = req.organization._id;
    
    // Total rewards created
    const totalRewards = await Reward.countDocuments({ organizationId: orgId });
    
    // Active rewards (with points awarded this month)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const activeRewards = await Reward.countDocuments({
      organizationId: orgId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Total viewers with points
    const viewersWithPoints = await ViewerPoints.countDocuments({ organizationId: orgId });
    
    // Total points distributed
    const pointsDistributed = await ViewerPoints.aggregate([
      { $match: { organizationId: req.organization._id } },
      { $group: { _id: null, total: { $sum: '$points' } } }
    ]);
    
    // Total points redeemed
    const pointsRedeemed = await ViewerPoints.aggregate([
      { $match: { organizationId: req.organization._id } },
      { $group: { _id: null, total: { $sum: '$redeemedPoints' } } }
    ]);
    
    // MRR (Monthly Recurring Revenue) from Stripe
    const subscription = await Subscription.findOne({ 
      organizationId: orgId,
      status: 'active' 
    }).populate('planId');
    
    const mrr = subscription?.planId?.price || 0;
    
    // Churn rate (canceled subscriptions last 30 days)
    const canceledSubs = await Subscription.countDocuments({
      organizationId: orgId,
      status: 'canceled',
      updatedAt: { $gte: thirtyDaysAgo }
    });
    
    const churnRate = subscription ? (canceledSubs / 1) * 100 : 0;
    
    res.json({
      organizationId: orgId,
      organizationName: req.organization.name,
      metrics: {
        totalRewards,
        activeRewards,
        viewersWithPoints,
        pointsDistributed: pointsDistributed[0]?.total || 0,
        pointsRedeemed: pointsRedeemed[0]?.total || 0,
        mrr,
        churnRate: Math.min(100, churnRate)
      },
      currentPlan: subscription?.planId?.name || 'Free',
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    res.status(500).json({ error: 'Failed to generate overview' });
  }
});

/**
 * GET /api/analytics/rewards
 * Detailed reward performance analytics
 * Query params: startDate, endDate, rewardId
 */
router.get('/rewards', requirePermissions(['admin']), async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { startDate, endDate, rewardId } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    // Get rewards with usage stats
    let rewardQuery = { organizationId: orgId };
    if (rewardId) rewardQuery._id = rewardId;
    
    const rewards = await Reward.find(rewardQuery);
    
    // Enrich with performance data
    const rewardStats = await Promise.all(
      rewards.map(async (reward) => {
        // Count viewers who earned this reward
        const earnedCount = await ViewerPoints.countDocuments({
          organizationId: orgId,
          rewardId: reward._id,
          pointsEarned: { $gt: 0 }
        });
        
        // Count redemptions
        const redeemedCount = await ViewerPoints.countDocuments({
          organizationId: orgId,
          rewardId: reward._id,
          redeemedPoints: { $gt: 0 }
        });
        
        // Redemption rate
        const redemptionRate = earnedCount > 0 ? (redeemedCount / earnedCount) * 100 : 0;
        
        // Total points earned from this reward
        const pointsEarned = await ViewerPoints.aggregate([
          { $match: { organizationId: orgId, rewardId: reward._id } },
          { $group: { _id: null, total: { $sum: '$pointsEarned' } } }
        ]);
        
        return {
          rewardId: reward._id,
          name: reward.name,
          pointValue: reward.pointsRequired,
          description: reward.description,
          earnedCount,
          redeemedCount,
          redemptionRate: Math.min(100, redemptionRate),
          totalPointsEarned: pointsEarned[0]?.total || 0,
          createdAt: reward.createdAt
        };
      })
    );
    
    res.json({
      organizationId: orgId,
      rewards: rewardStats.sort((a, b) => b.earnedCount - a.earnedCount),
      dateRange: { startDate, endDate },
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Rewards analytics error:', error);
    res.status(500).json({ error: 'Failed to generate rewards analytics' });
  }
});

/**
 * GET /api/analytics/engagement
 * User engagement metrics over time
 * Query params: granularity (day|week|month), days (default 30)
 */
router.get('/engagement', requirePermissions(['editor']), async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { granularity = 'day', days = 30 } = req.query;
    const daysNum = parseInt(days);
    
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);
    
    // Group usage records by time period
    let dateFormat;
    switch(granularity) {
      case 'week':
        dateFormat = '%Y-W%U'; // ISO week number
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      case 'day':
      default:
        dateFormat = '%Y-%m-%d';
    }
    
    const engagementData = await UsageRecord.aggregate([
      {
        $match: {
          organizationId: orgId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: dateFormat, date: '$createdAt' }
          },
          apiCalls: { $sum: '$apiCallsUsed' },
          viewersEngaged: { $sum: 1 },
          pointsDistributed: { $sum: '$pointsUsed' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Count unique viewers per period for retention
    const viewerData = await UsageRecord.aggregate([
      {
        $match: {
          organizationId: orgId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            period: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            viewerId: '$viewerId'
          }
        }
      },
      {
        $group: {
          _id: '$_id.period',
          uniqueViewers: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Merge viewer data with engagement data
    const mergedData = engagementData.map(eng => {
      const viewer = viewerData.find(v => v._id === eng._id) || {};
      return {
        date: eng._id,
        apiCalls: eng.apiCalls,
        pointsDistributed: eng.pointsDistributed,
        uniqueViewers: viewer.uniqueViewers || 0,
        engagementRate: viewer.uniqueViewers ? (viewer.uniqueViewers / 100) * 100 : 0 // % of org's viewers
      };
    });
    
    res.json({
      organizationId: orgId,
      granularity,
      days: daysNum,
      data: mergedData,
      totals: {
        totalApiCalls: mergedData.reduce((sum, d) => sum + d.apiCalls, 0),
        totalPointsDistributed: mergedData.reduce((sum, d) => sum + d.pointsDistributed, 0),
        avgUniqueViewersPerPeriod: Math.round(
          mergedData.reduce((sum, d) => sum + d.uniqueViewers, 0) / mergedData.length
        )
      },
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Engagement analytics error:', error);
    res.status(500).json({ error: 'Failed to generate engagement analytics' });
  }
});

/**
 * GET /api/analytics/cohort
 * Cohort analysis - viewer behavior by signup date
 * Query params: startDate, endDate
 */
router.get('/cohort', requirePermissions(['admin']), async (req, res) => {
  try {
    const orgId = req.organization._id;
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    
    // Group viewers by signup month
    const cohorts = await ViewerPoints.aggregate([
      {
        $match: {
          organizationId: orgId,
          createdAt: dateFilter
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m', date: '$createdAt' }
          },
          cohortSize: { $sum: 1 },
          totalPointsEarned: { $sum: '$pointsEarned' },
          totalPointsRedeemed: { $sum: '$redeemedPoints' }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);
    
    // Calculate retention metrics per cohort
    const cohortMetrics = await Promise.all(
      cohorts.map(async (cohort) => {
        const cohortDate = new Date(cohort._id + '-01');
        const nextMonth = new Date(cohortDate);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        // Viewers still active in next month
        const retainedCount = await ViewerPoints.countDocuments({
          organizationId: orgId,
          createdAt: { $gte: cohortDate, $lt: cohortDate },
          updatedAt: { $gte: nextMonth }
        });
        
        const retentionRate = (retainedCount / cohort.cohortSize) * 100;
        
        return {
          cohortMonth: cohort._id,
          size: cohort.cohortSize,
          totalPointsEarned: cohort.totalPointsEarned,
          totalPointsRedeemed: cohort.totalPointsRedeemed,
          retentionRate: Math.min(100, retentionRate),
          avgPointsPerUser: Math.round(cohort.totalPointsEarned / cohort.cohortSize)
        };
      })
    );
    
    res.json({
      organizationId: orgId,
      cohorts: cohortMetrics,
      dateRange: { startDate, endDate },
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Cohort analytics error:', error);
    res.status(500).json({ error: 'Failed to generate cohort analytics' });
  }
});

/**
 * GET /api/analytics/export
 * Export analytics data as CSV
 * Query params: format (csv|json), type (overview|rewards|engagement), days
 */
router.get('/export', requirePermissions(['admin']), async (req, res) => {
  try {
    const { format = 'csv', type = 'overview', days = 30 } = req.query;
    const orgId = req.organization._id;
    
    let data = [];
    
    if (type === 'engagement') {
      // Get engagement data for export
      const response = await (async () => {
        const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
        
        return await UsageRecord.aggregate([
          {
            $match: {
              organizationId: orgId,
              createdAt: { $gte: startDate }
            }
          },
          {
            $project: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              viewerId: 1,
              apiCallsUsed: 1,
              pointsUsed: 1
            }
          }
        ]);
      })();
      
      data = response;
    } else if (type === 'rewards') {
      // Get rewards data for export
      const rewards = await Reward.find({ organizationId: orgId });
      
      data = await Promise.all(
        rewards.map(async (reward) => {
          const pointsData = await ViewerPoints.aggregate([
            { $match: { organizationId: orgId, rewardId: reward._id } },
            { $group: { _id: null, earned: { $sum: '$pointsEarned' }, redeemed: { $sum: '$redeemedPoints' } } }
          ]);
          
          return {
            rewardId: reward._id.toString(),
            name: reward.name,
            pointsRequired: reward.pointsRequired,
            pointsEarned: pointsData[0]?.earned || 0,
            pointsRedeemed: pointsData[0]?.redeemed || 0
          };
        })
      );
    } else {
      // Overview data
      const overviewRes = await fetch(`http://localhost:${process.env.PORT}/api/analytics/overview`, {
        headers: { Authorization: req.headers.authorization }
      });
      data = await overviewRes.json();
    }
    
    if (format === 'csv') {
      // Convert to CSV
      if (!Array.isArray(data) && data.metrics) {
        // Overview format
        const csv = `Organization,Rewards,Active Rewards,Viewers,Points Distributed,Points Redeemed,MRR,Churn Rate
${data.organizationName},${data.metrics.totalRewards},${data.metrics.activeRewards},${data.metrics.viewersWithPoints},${data.metrics.pointsDistributed},${data.metrics.pointsRedeemed},${data.metrics.mrr},${data.metrics.churnRate}%`;
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
        res.send(csv);
      } else {
        // Array format
        const headers = Object.keys(data[0] || {});
        const csv = [
          headers.join(','),
          ...data.map(row => headers.map(h => row[h]).join(','))
        ].join('\n');
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="analytics.csv"');
        res.send(csv);
      }
    } else {
      // JSON format
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="analytics.json"');
      res.json({
        organizationId: orgId,
        type,
        exportDate: new Date(),
        data
      });
    }
  } catch (error) {
    console.error('Analytics export error:', error);
    res.status(500).json({ error: 'Failed to export analytics' });
  }
});

/**
 * GET /api/analytics/health
 * Organization health score (0-100) based on multiple factors
 * Considers: engagement, retention, revenue, etc
 */
router.get('/health', requirePermissions(['editor']), async (req, res) => {
  try {
    const orgId = req.organization._id;
    
    let healthScore = 50; // Start at 50
    
    // Engagement factor (active rewards + viewer activity)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentActivity = await UsageRecord.countDocuments({
      organizationId: orgId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    if (recentActivity > 100) healthScore += 15;
    else if (recentActivity > 50) healthScore += 10;
    else if (recentActivity > 10) healthScore += 5;
    
    // Reward diversity (multiple reward types)
    const rewardCount = await Reward.countDocuments({ organizationId: orgId });
    if (rewardCount > 10) healthScore += 15;
    else if (rewardCount > 5) healthScore += 10;
    else if (rewardCount > 0) healthScore += 5;
    
    // Viewer retention (points redeemed vs earned)
    const pointsData = await ViewerPoints.aggregate([
      { $match: { organizationId: orgId } },
      { $group: { _id: null, earned: { $sum: '$pointsEarned' }, redeemed: { $sum: '$redeemedPoints' } } }
    ]);
    
    if (pointsData[0]) {
      const redemptionRate = pointsData[0].earned > 0 
        ? (pointsData[0].redeemed / pointsData[0].earned) * 100 
        : 0;
      
      if (redemptionRate > 50) healthScore += 20;
      else if (redemptionRate > 25) healthScore += 10;
    }
    
    // Subscription status
    const subscription = await Subscription.findOne({
      organizationId: orgId,
      status: 'active'
    });
    
    if (subscription) healthScore += 15;
    
    res.json({
      organizationId: orgId,
      healthScore: Math.min(100, healthScore),
      factors: {
        engagement: recentActivity > 100 ? 'Excellent' : recentActivity > 50 ? 'Good' : 'Needs Improvement',
        diversity: rewardCount > 10 ? 'Excellent' : rewardCount > 5 ? 'Good' : 'Needs Improvement',
        retention: healthScore > 75 ? 'Excellent' : healthScore > 50 ? 'Good' : 'Needs Improvement',
        subscription: subscription ? 'Active' : 'Inactive'
      },
      recommendations: [
        ...(rewardCount < 5 ? ['Create more reward types to increase engagement'] : []),
        ...(recentActivity < 50 ? ['Promote rewards to increase viewer participation'] : []),
        ...(redemptionRate < 25 ? ['Review reward value - points may be too hard to earn'] : []),
        ...(!subscription ? ['Upgrade to a paid plan to unlock advanced features'] : [])
      ],
      generatedAt: new Date()
    });
  } catch (error) {
    console.error('Health score error:', error);
    res.status(500).json({ error: 'Failed to calculate health score' });
  }
});

module.exports = router;
