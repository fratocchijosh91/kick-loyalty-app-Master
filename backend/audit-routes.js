/**
 * Audit Logging Routes
 * Immutable append-only audit trail for compliance and security monitoring
 * 
 * Features:
 * - Record all organizational actions (create, update, delete, access, etc.)
 * - Query audit logs with filtering, sorting, pagination
 * - Export audit logs as CSV/JSON
 * - View audit statistics and trends
 * - Search by action, resource, user, date range
 */

const express = require('express');
const { AuditLog } = require('./models');
const { authenticateToken, requirePermission } = require('./middleware');

const router = express.Router();

/**
 * Internal function to log an action
 * Should be called from all route handlers that modify data
 * 
 * @param {Object} logData - Audit log data
 * Usage: await logAuditEvent({
 *   userId, organizationId, action, resourceType, resourceId,
 *   details, changes, ipAddress, userAgent, success, error
 * })
 */
async function logAuditEvent(logData) {
  try {
    const log = new AuditLog({
      userId: logData.userId,
      organizationId: logData.organizationId,
      username: logData.username || 'system',
      action: logData.action,
      resourceType: logData.resourceType,
      resourceId: logData.resourceId || null,
      resourceName: logData.resourceName || null,
      details: logData.details || '',
      changes: logData.changes || null,
      ipAddress: logData.ipAddress || null,
      userAgent: logData.userAgent || null,
      ipCountry: logData.ipCountry || null,
      success: logData.success !== false,
      statusCode: logData.statusCode || 200,
      error: logData.error || null
    });
    await log.save();
    return log;
  } catch (err) {
    console.error('Failed to save audit log:', err);
    // Never throw from audit logging - don't break the main operation
    return null;
  }
}

// Export for use in other route files
module.exports.logAuditEvent = logAuditEvent;

// ==================== PUBLIC ROUTES (Require Token) ====================

/**
 * POST /api/audit/log
 * Manually log an action (for external integrations)
 * 
 * Requires: admin or owner role
 * Body: { action, resourceType, resourceId, resourceName?, details, changes?, success? }
 */
router.post('/api/audit/log', authenticateToken, requirePermission('audit:write'), async (req, res) => {
  try {
    const { action, resourceType, resourceId, resourceName, details, changes, success } = req.body;

    if (!action || !resourceType) {
      return res.status(400).json({ error: 'Missing required fields: action, resourceType' });
    }

    // Only allow specific actions for external logging
    const allowedExternalActions = ['custom_event', 'integration_action', 'webhook_received'];
    if (!allowedExternalActions.includes(action)) {
      return res.status(403).json({ 
        error: 'Only custom_event, integration_action, webhook_received allowed for external logging' 
      });
    }

    const auditLog = await logAuditEvent({
      userId: req.user.id,
      organizationId: req.user.organizationId,
      username: req.user.username,
      action,
      resourceType,
      resourceId,
      resourceName,
      details,
      changes,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: success !== false
    });

    res.status(201).json({ 
      success: true,
      logId: auditLog?._id,
      message: 'Action logged successfully'
    });
  } catch (err) {
    console.error('Error logging action:', err);
    res.status(500).json({ error: 'Failed to log action' });
  }
});

/**
 * GET /api/audit/logs
 * Query audit logs with filtering, pagination, and sorting
 * 
 * Query params:
 * - action: Filter by action type
 * - resourceType: Filter by resource type
 * - userId: Filter by user ID
 * - resourceId: Filter by resource ID
 * - success: Filter by success (true/false)
 * - startDate: ISO date (createdAt >= startDate)
 * - endDate: ISO date (createdAt <= endDate)
 * - search: Search in details field
 * - sortBy: Field to sort by (default: createdAt)
 * - sortOrder: 'asc' or 'desc' (default: desc)
 * - page: Pagination (default: 1)
 * - limit: Items per page (default: 25, max: 500)
 */
router.get('/api/audit/logs', authenticateToken, requirePermission('audit:read'), async (req, res) => {
  try {
    const {
      action,
      resourceType,
      userId,
      resourceId,
      success,
      startDate,
      endDate,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 25
    } = req.query;

    // Build filter query
    const filter = {
      organizationId: req.user.organizationId
    };

    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;
    if (userId) filter.userId = userId;
    if (resourceId) filter.resourceId = resourceId;
    if (success !== undefined) filter.success = success === 'true';

    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    // Text search in details
    if (search) {
      filter.$or = [
        { details: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { resourceName: { $regex: search, $options: 'i' } }
      ];
    }

    // Validate pagination
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(500, Math.max(1, parseInt(limit, 10) || 25));
    const skip = (pageNum - 1) * limitNum;

    // Validate sortBy
    const allowedSortFields = ['createdAt', 'action', 'resourceType', 'userId', 'success'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const sortDir = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .populate('userId', 'username email')
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum),
        hasMore: pageNum < Math.ceil(total / limitNum)
      },
      filters: {
        action,
        resourceType,
        userId,
        resourceId,
        success,
        startDate,
        endDate,
        search
      }
    });
  } catch (err) {
    console.error('Error fetching audit logs:', err);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
});

/**
 * GET /api/audit/logs/:logId
 * Get a specific audit log entry
 */
router.get('/api/audit/logs/:logId', authenticateToken, requirePermission('audit:read'), async (req, res) => {
  try {
    const log = await AuditLog.findOne({
      _id: req.params.logId,
      organizationId: req.user.organizationId
    }).populate('userId', 'username email');

    if (!log) {
      return res.status(404).json({ error: 'Log entry not found' });
    }

    res.json({ success: true, data: log });
  } catch (err) {
    console.error('Error fetching log entry:', err);
    res.status(500).json({ error: 'Failed to fetch log entry' });
  }
});

/**
 * GET /api/audit/export
 * Export audit logs as CSV or JSON
 * 
 * Query params: (same as /logs endpoint)
 * - format: 'csv' or 'json' (default: csv)
 */
router.get('/api/audit/export', authenticateToken, requirePermission('audit:export'), async (req, res) => {
  try {
    const {
      action,
      resourceType,
      userId,
      resourceId,
      success,
      startDate,
      endDate,
      search,
      format = 'csv'
    } = req.query;

    // Build filter (same as logs endpoint, no pagination)
    const filter = {
      organizationId: req.user.organizationId
    };

    if (action) filter.action = action;
    if (resourceType) filter.resourceType = resourceType;
    if (userId) filter.userId = userId;
    if (resourceId) filter.resourceId = resourceId;
    if (success !== undefined) filter.success = success === 'true';

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      filter.$or = [
        { details: { $regex: search, $options: 'i' } },
        { username: { $regex: search, $options: 'i' } },
        { resourceName: { $regex: search, $options: 'i' } }
      ];
    }

    // Fetch all matching logs (limit to 100k to prevent memory issues)
    const logs = await AuditLog.find(filter)
      .populate('userId', 'username email')
      .sort({ createdAt: -1 })
      .limit(100000)
      .lean();

    if (format === 'json') {
      // JSON export
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.json"');
      res.json({ exportedAt: new Date(), organizationId: req.user.organizationId, data: logs });
    } else {
      // CSV export
      const csvHeader = 'Timestamp,User,Action,Resource Type,Resource ID,Resource Name,Details,Success,IP Address,Status Code\n';
      const csvRows = logs.map(log => {
        const timestamp = new Date(log.createdAt).toISOString();
        const user = log.username || 'N/A';
        const details = (log.details || '').replace(/"/g, '""');
        const success = log.success ? 'Yes' : 'No';
        const ip = log.ipAddress || 'N/A';
        const statusCode = log.statusCode || 'N/A';

        return `"${timestamp}","${user}","${log.action}","${log.resourceType}","${log.resourceId || ''}","${log.resourceName || ''}","${details}","${success}","${ip}","${statusCode}"`;
      }).join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      res.send(csvHeader + csvRows);
    }
  } catch (err) {
    console.error('Error exporting audit logs:', err);
    res.status(500).json({ error: 'Failed to export audit logs' });
  }
});

/**
 * GET /api/audit/stats
 * Get audit statistics and trends
 * 
 * Returns: Actions by type, users with most activity, failed operations, etc.
 */
router.get('/api/audit/stats', authenticateToken, requirePermission('audit:read'), async (req, res) => {
  try {
    const { daysBack = 30 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(daysBack, 10));

    const orgId = req.user.organizationId;

    // Aggregation for statistics
    const [actionStats, resourceStats, userStats, successStats, failedActions] = await Promise.all([
      // Actions distribution
      AuditLog.aggregate([
        {
          $match: {
            organizationId: orgId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Resource types distribution
      AuditLog.aggregate([
        {
          $match: {
            organizationId: orgId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$resourceType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),

      // Most active users
      AuditLog.aggregate([
        {
          $match: {
            organizationId: orgId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$username',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),

      // Success/Failure rates
      AuditLog.aggregate([
        {
          $match: {
            organizationId: orgId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$success',
            count: { $sum: 1 }
          }
        }
      ]),

      // Failed operations detail
      AuditLog.find({
        organizationId: orgId,
        success: false,
        createdAt: { $gte: startDate }
      })
        .select('action resourceType error createdAt username')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
    ]);

    // Calculate percentages
    const totalEvents = actionStats.reduce((sum, a) => sum + a.count, 0);
    const successCount = successStats.find(s => s._id === true)?.count || 0;
    const failureCount = successStats.find(s => s._id === false)?.count || 0;

    res.json({
      success: true,
      period: {
        days: parseInt(daysBack, 10),
        startDate,
        endDate: new Date()
      },
      summary: {
        totalEvents,
        successfulEvents: successCount,
        failedEvents: failureCount,
        successRate: totalEvents > 0 ? ((successCount / totalEvents) * 100).toFixed(2) + '%' : 'N/A'
      },
      actionDistribution: actionStats,
      resourceDistribution: resourceStats,
      topUsers: userStats,
      failedOperations: failedActions
    });
  } catch (err) {
    console.error('Error calculating audit stats:', err);
    res.status(500).json({ error: 'Failed to calculate statistics' });
  }
});

/**
 * GET /api/audit/timeline
 * Get audit events in timeline format
 * Useful for visualization of events over time
 */
router.get('/api/audit/timeline', authenticateToken, requirePermission('audit:read'), async (req, res) => {
  try {
    const { daysBack = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(daysBack, 10));

    // Group by day and count
    const timeline = await AuditLog.aggregate([
      {
        $match: {
          organizationId: req.user.organizationId,
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: 1 },
          successful: {
            $sum: { $cond: ['$success', 1, 0] }
          },
          failed: {
            $sum: { $cond: ['$success', 0, 1] }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      period: {
        days: parseInt(daysBack, 10),
        startDate,
        endDate: new Date()
      },
      data: timeline
    });
  } catch (err) {
    console.error('Error fetching timeline:', err);
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
});

/**
 * GET /api/audit/user/:userId/activity
 * Get activity log for a specific user
 */
router.get('/api/audit/user/:userId/activity', authenticateToken, requirePermission('audit:read'), async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    const limitNum = Math.min(100, parseInt(limit, 10) || 50);
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const skip = (pageNum - 1) * limitNum;

    const [logs, total] = await Promise.all([
      AuditLog.find({
        organizationId: req.user.organizationId,
        userId: req.params.userId
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AuditLog.countDocuments({
        organizationId: req.user.organizationId,
        userId: req.params.userId
      })
    ]);

    res.json({
      success: true,
      data: logs,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Error fetching user activity:', err);
    res.status(500).json({ error: 'Failed to fetch user activity' });
  }
});

module.exports = router;
