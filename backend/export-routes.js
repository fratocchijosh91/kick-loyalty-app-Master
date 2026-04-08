/**
 * Phase 3 - Advanced Reporting & Export Routes
 * CSV and PDF export functionality for analytics and reports
 * 
 * Features:
 * - CSV exports: Analytics, rewards, users, transactions, audit logs
 * - PDF reports: Professional formatted reports with visualizations
 * - Scheduled exports: Automated recurring reports
 * - Export history: Track all generated exports
 */

const express = require('express');
const mongoose = require('mongoose');
const { Parser } = require('json2csv');
const puppeteer = require('puppeteer');
const rateLimit = require('express-rate-limit');
const { body, query, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin } = require('./middleware');

const router = express.Router();

// Models import
const {
  User,
  Reward,
  ViewerPoints,
  RedemptionRequest,
  AuditLog,
  Organization,
  TeamMember,
  SmsNotification
} = require('./models');

// Rate limiting for exports (prevent abuse)
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 exports per 15 minutes
  message: { error: 'Troppi export, riprova tra 15 minuti.' }
});

// Helper: Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Helper: Generate CSV from data
const generateCSV = (data, fields, fieldNames) => {
  const json2csvParser = new Parser({
    fields: fields.map((field, index) => ({
      label: fieldNames[index] || field,
      value: field
    }))
  });
  return json2csvParser.parse(data);
};

// Helper: Generate PDF HTML template
const generatePDFHTML = (title, data, summary, orgName) => {
  const now = new Date().toLocaleString('it-IT');
  const rows = data.rows.map(row => `
    <tr>
      ${row.map(cell => `<td style="padding: 8px; border: 1px solid #ddd;">${cell}</td>`).join('')}
    </tr>
  `).join('');

  const summaryCards = summary.map(item => `
    <div style="background: #3b82f6; color: white; padding: 15px; border-radius: 8px; text-align: center;">
      <div style="font-size: 24px; font-weight: bold;">${item.value}</div>
      <div style="font-size: 12px; opacity: 0.9;">${item.label}</div>
    </div>
  `).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${title}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 40px; color: #333; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #3b82f6; }
        .header h1 { color: #1f2937; margin: 0 0 10px 0; }
        .header .meta { color: #6b7280; font-size: 14px; }
        .summary { display: grid; grid-template-columns: repeat(${summary.length}, 1fr); gap: 15px; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th { background: #3b82f6; color: white; padding: 12px 8px; text-align: left; font-weight: 600; }
        tr:nth-child(even) { background: #f9fafb; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center; color: #9ca3af; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${title}</h1>
        <div class="meta">
          <strong>${orgName || 'KickLoyalty'}</strong> • Generato il ${now}
        </div>
      </div>
      
      <div class="summary" style="display: grid; grid-template-columns: repeat(${Math.min(summary.length, 4)}, 1fr); gap: 15px; margin-bottom: 30px;">
        ${summaryCards}
      </div>
      
      <table>
        <thead>
          <tr>
            ${data.headers.map(h => `<th style="padding: 12px 8px; background: #3b82f6; color: white; text-align: left;">${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
      
      <div class="footer">
        <p>Questo report è stato generato automaticamente da KickLoyalty</p>
        <p>Per supporto: support@kickloyalty.com</p>
      </div>
    </body>
    </html>
  `;
};

// ============================================
// CSV EXPORTS
// ============================================

/**
 * GET /api/exports/csv/analytics
 * Export analytics data to CSV
 * Query params: startDate, endDate, organizationId
 */
router.get('/exports/csv/analytics', 
  authenticateToken,
  exportLimiter,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('organizationId').optional().isMongoId()
  ],
  validate,
  async (req, res) => {
    try {
      const { startDate, endDate, organizationId } = req.query;
      
      const matchStage = {};
      if (startDate || endDate) {
        matchStage.createdAt = {};
        if (startDate) matchStage.createdAt.$gte = new Date(startDate);
        if (endDate) matchStage.$lte = new Date(endDate);
      }
      if (organizationId) {
        matchStage.organizationId = new mongoose.Types.ObjectId(organizationId);
      }

      // Fetch analytics data
      const rewards = await Reward.find(matchStage.organizationId ? { organizationId: matchStage.organizationId } : {});
      const users = await User.find(matchStage);
      const redemptions = await RedemptionRequest.find(matchStage);

      // Prepare CSV data
      const csvData = [
        ['Metric', 'Value', 'Period'],
        ['Total Users', users.length, startDate ? `${startDate} to ${endDate}` : 'All time'],
        ['Active Rewards', rewards.filter(r => r.active).length, ''],
        ['Total Redemptions', redemptions.length, ''],
        ['Completed Redemptions', redemptions.filter(r => r.status === 'completed').length, ''],
        ['Pending Redemptions', redemptions.filter(r => r.status === 'pending').length, ''],
        ['Points Redeemed', redemptions.reduce((sum, r) => sum + (r.pointsCost || 0), 0), '']
      ];

      const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.csv"`);
      res.send(csv);

    } catch (error) {
      console.error('CSV Analytics Export Error:', error);
      res.status(500).json({ error: 'Errore durante l\'export CSV' });
    }
  }
);

/**
 * GET /api/exports/csv/users
 * Export users data to CSV
 * Query params: organizationId, active, sortBy
 */
router.get('/exports/csv/users',
  authenticateToken,
  requireAdmin,
  exportLimiter,
  [
    query('organizationId').optional().isMongoId(),
    query('active').optional().isBoolean(),
    query('sortBy').optional().isIn(['points', 'createdAt', 'lastLogin'])
  ],
  validate,
  async (req, res) => {
    try {
      const { organizationId, active, sortBy = 'createdAt' } = req.query;

      let query = {};
      if (organizationId) query.organizationId = organizationId;
      if (active !== undefined) query.active = active === 'true';

      const users = await User.find(query)
        .select('kickUsername kickDisplayName email totalPoints createdAt lastLogin active plan')
        .sort({ [sortBy]: -1 });

      const fields = ['kickUsername', 'kickDisplayName', 'email', 'totalPoints', 'plan', 'active', 'createdAt', 'lastLogin'];
      const fieldNames = ['Username', 'Display Name', 'Email', 'Points', 'Plan', 'Active', 'Created', 'Last Login'];

      const csvData = users.map(user => ({
        kickUsername: user.kickUsername || '',
        kickDisplayName: user.kickDisplayName || '',
        email: user.email || '',
        totalPoints: user.totalPoints || 0,
        plan: user.plan || 'free',
        active: user.active ? 'Yes' : 'No',
        createdAt: user.createdAt ? user.createdAt.toISOString() : '',
        lastLogin: user.lastLogin ? user.lastLogin.toISOString() : ''
      }));

      const csv = generateCSV(csvData, fields, fieldNames);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="users-export-${Date.now()}.csv"`);
      res.send(csv);

    } catch (error) {
      console.error('CSV Users Export Error:', error);
      res.status(500).json({ error: 'Errore durante l\'export CSV' });
    }
  }
);

/**
 * GET /api/exports/csv/rewards
 * Export rewards data to CSV
 */
router.get('/exports/csv/rewards',
  authenticateToken,
  requireAdmin,
  exportLimiter,
  [
    query('organizationId').optional().isMongoId(),
    query('active').optional().isBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const { organizationId, active } = req.query;

      let query = {};
      if (organizationId) query.organizationId = organizationId;
      if (active !== undefined) query.active = active === 'true';

      const rewards = await Reward.find(query)
        .select('name description points type active redeemedCount createdAt')
        .sort({ redeemedCount: -1 });

      const fields = ['name', 'description', 'points', 'type', 'active', 'redeemedCount', 'createdAt'];
      const fieldNames = ['Name', 'Description', 'Points Cost', 'Type', 'Active', 'Times Redeemed', 'Created'];

      const csvData = rewards.map(reward => ({
        name: reward.name || '',
        description: reward.description || '',
        points: reward.points || 0,
        type: reward.type || 'other',
        active: reward.active ? 'Yes' : 'No',
        redeemedCount: reward.redeemedCount || 0,
        createdAt: reward.createdAt ? reward.createdAt.toISOString() : ''
      }));

      const csv = generateCSV(csvData, fields, fieldNames);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="rewards-export-${Date.now()}.csv"`);
      res.send(csv);

    } catch (error) {
      console.error('CSV Rewards Export Error:', error);
      res.status(500).json({ error: 'Errore durante l\'export CSV' });
    }
  }
);

/**
 * GET /api/exports/csv/redemptions
 * Export redemption transactions to CSV
 */
router.get('/exports/csv/redemptions',
  authenticateToken,
  requireAdmin,
  exportLimiter,
  [
    query('organizationId').optional().isMongoId(),
    query('status').optional().isIn(['pending', 'approved', 'rejected', 'completed', 'cancelled']),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validate,
  async (req, res) => {
    try {
      const { organizationId, status, startDate, endDate } = req.query;

      let query = {};
      if (organizationId) query.organizationId = organizationId;
      if (status) query.status = status;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const redemptions = await RedemptionRequest.find(query)
        .populate('rewardId', 'name points')
        .populate('userId', 'kickUsername')
        .sort({ createdAt: -1 });

      const fields = ['requestId', 'username', 'rewardName', 'pointsCost', 'status', 'notes', 'createdAt', 'completedAt'];
      const fieldNames = ['Request ID', 'User', 'Reward', 'Points', 'Status', 'Notes', 'Created', 'Completed'];

      const csvData = redemptions.map(r => ({
        requestId: r._id.toString(),
        username: r.userId?.kickUsername || r.viewerUsername || 'Unknown',
        rewardName: r.rewardId?.name || r.rewardName || 'Unknown',
        pointsCost: r.pointsCost || r.rewardId?.points || 0,
        status: r.status,
        notes: r.notes || '',
        createdAt: r.createdAt ? r.createdAt.toISOString() : '',
        completedAt: r.completedAt ? r.completedAt.toISOString() : ''
      }));

      const csv = generateCSV(csvData, fields, fieldNames);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="redemptions-export-${Date.now()}.csv"`);
      res.send(csv);

    } catch (error) {
      console.error('CSV Redemptions Export Error:', error);
      res.status(500).json({ error: 'Errore durante l\'export CSV' });
    }
  }
);

/**
 * GET /api/exports/csv/audit
 * Export audit logs to CSV
 */
router.get('/exports/csv/audit',
  authenticateToken,
  requireAdmin,
  exportLimiter,
  [
    query('organizationId').optional().isMongoId(),
    query('action').optional().isString(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601()
  ],
  validate,
  async (req, res) => {
    try {
      const { organizationId, action, startDate, endDate } = req.query;

      let query = {};
      if (organizationId) query.organizationId = organizationId;
      if (action) query.action = action;
      if (startDate || endDate) {
        query.createdAt = {};
        if (startDate) query.createdAt.$gte = new Date(startDate);
        if (endDate) query.createdAt.$lte = new Date(endDate);
      }

      const logs = await AuditLog.find(query)
        .populate('userId', 'kickUsername')
        .sort({ createdAt: -1 })
        .limit(10000); // Max 10k records for CSV

      const fields = ['timestamp', 'action', 'username', 'resource', 'details', 'ipAddress'];
      const fieldNames = ['Timestamp', 'Action', 'User', 'Resource', 'Details', 'IP Address'];

      const csvData = logs.map(log => ({
        timestamp: log.createdAt ? log.createdAt.toISOString() : '',
        action: log.action,
        username: log.userId?.kickUsername || log.userId?.toString() || 'System',
        resource: `${log.resourceType}:${log.resourceId || ''}`,
        details: log.details ? JSON.stringify(log.details) : '',
        ipAddress: log.ipAddress || ''
      }));

      const csv = generateCSV(csvData, fields, fieldNames);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.csv"`);
      res.send(csv);

    } catch (error) {
      console.error('CSV Audit Export Error:', error);
      res.status(500).json({ error: 'Errore durante l\'export CSV' });
    }
  }
);

// ============================================
// PDF EXPORTS
// ============================================

/**
 * GET /api/exports/pdf/analytics
 * Generate PDF analytics report
 */
router.get('/exports/pdf/analytics',
  authenticateToken,
  requireAdmin,
  exportLimiter,
  [
    query('organizationId').optional().isMongoId(),
    query('period').optional().isIn(['7d', '30d', '90d', '1y'])
  ],
  validate,
  async (req, res) => {
    let browser;
    try {
      const { organizationId, period = '30d' } = req.query;

      // Calculate date range
      const days = parseInt(period);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      let query = { createdAt: { $gte: startDate } };
      if (organizationId) query.organizationId = organizationId;

      // Fetch data
      const [userCount, rewardCount, redemptionCount, totalPoints] = await Promise.all([
        User.countDocuments(query),
        Reward.countDocuments(organizationId ? { organizationId } : {}),
        RedemptionRequest.countDocuments(query),
        User.aggregate([
          { $match: query },
          { $group: { _id: null, total: { $sum: '$totalPoints' } } }
        ])
      ]);

      // Get organization name
      let orgName = 'KickLoyalty';
      if (organizationId) {
        const org = await Organization.findById(organizationId);
        if (org) orgName = org.name;
      }

      // Generate summary
      const summary = [
        { label: 'Total Users', value: userCount.toLocaleString() },
        { label: 'Active Rewards', value: rewardCount.toLocaleString() },
        { label: 'Redemptions', value: redemptionCount.toLocaleString() },
        { label: 'Points Earned', value: (totalPoints[0]?.total || 0).toLocaleString() }
      ];

      // Generate table data
      const recentRedemptions = await RedemptionRequest.find(query)
        .populate('rewardId', 'name')
        .populate('userId', 'kickUsername')
        .sort({ createdAt: -1 })
        .limit(20);

      const tableData = {
        headers: ['Date', 'User', 'Reward', 'Points', 'Status'],
        rows: recentRedemptions.map(r => [
          r.createdAt.toLocaleDateString('it-IT'),
          r.userId?.kickUsername || 'Unknown',
          r.rewardId?.name || r.rewardName || 'Unknown',
          (r.pointsCost || 0).toString(),
          r.status
        ])
      };

      // Generate PDF
      const html = generatePDFHTML('Analytics Report', tableData, summary, orgName);

      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="analytics-report-${Date.now()}.pdf"`);
      res.send(pdf);

    } catch (error) {
      console.error('PDF Analytics Export Error:', error);
      res.status(500).json({ error: 'Errore durante la generazione PDF' });
    } finally {
      if (browser) await browser.close();
    }
  }
);

/**
 * GET /api/exports/pdf/leaderboard
 * Generate PDF leaderboard report
 */
router.get('/exports/pdf/leaderboard',
  authenticateToken,
  exportLimiter,
  [
    query('organizationId').optional().isMongoId(),
    query('streamerUsername').optional().isString(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validate,
  async (req, res) => {
    let browser;
    try {
      const { organizationId, streamerUsername, limit = 50 } = req.query;

      let query = {};
      if (organizationId) query.organizationId = organizationId;
      if (streamerUsername) query.streamerUsername = streamerUsername.toLowerCase();

      const leaderboard = await ViewerPoints.find(query)
        .sort({ points: -1 })
        .limit(parseInt(limit));

      // Get org/streamer name
      let titleName = 'Global';
      if (organizationId) {
        const org = await Organization.findById(organizationId);
        if (org) titleName = org.name;
      } else if (streamerUsername) {
        titleName = streamerUsername;
      }

      const totalParticipants = await ViewerPoints.countDocuments(query);
      const totalPoints = leaderboard.reduce((sum, item) => sum + item.points, 0);
      const avgPoints = totalParticipants > 0 ? Math.round(totalPoints / totalParticipants) : 0;

      const summary = [
        { label: 'Participants', value: totalParticipants.toLocaleString() },
        { label: 'Total Points', value: totalPoints.toLocaleString() },
        { label: 'Avg Points', value: avgPoints.toLocaleString() },
        { label: 'Top Score', value: leaderboard[0]?.points?.toLocaleString() || '0' }
      ];

      const tableData = {
        headers: ['Rank', 'Viewer', 'Points', 'Total Earned', 'Last Active'],
        rows: leaderboard.map((item, index) => [
          (index + 1).toString(),
          item.viewerUsername,
          item.points.toLocaleString(),
          item.totalEarned.toLocaleString(),
          item.lastSeen ? item.lastSeen.toLocaleDateString('it-IT') : 'Never'
        ])
      };

      const html = generatePDFHTML(`Leaderboard - ${titleName}`, tableData, summary, titleName);

      browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="leaderboard-report-${Date.now()}.pdf"`);
      res.send(pdf);

    } catch (error) {
      console.error('PDF Leaderboard Export Error:', error);
      res.status(500).json({ error: 'Errore durante la generazione PDF' });
    } finally {
      if (browser) await browser.close();
    }
  }
);

// ============================================
// EXPORT MANAGEMENT
// ============================================

// In-memory storage for export history (in production, use database)
const exportHistory = new Map();

/**
 * GET /api/exports/history
 * Get export history for current user
 */
router.get('/exports/history',
  authenticateToken,
  async (req, res) => {
    try {
      const userExports = exportHistory.get(req.user.id) || [];
      res.json({
        success: true,
        exports: userExports.slice(-50).reverse() // Last 50, newest first
      });
    } catch (error) {
      console.error('Export History Error:', error);
      res.status(500).json({ error: 'Errore nel recupero storico export' });
    }
  }
);

/**
 * POST /api/exports/scheduled
 * Create a scheduled export
 */
router.post('/exports/scheduled',
  authenticateToken,
  requireAdmin,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('type').isIn(['analytics', 'users', 'rewards', 'redemptions', 'audit']),
    body('format').isIn(['csv', 'pdf']),
    body('frequency').isIn(['daily', 'weekly', 'monthly']),
    body('recipients').isArray({ min: 1 }),
    body('recipients.*').isEmail()
  ],
  validate,
  async (req, res) => {
    try {
      const { name, type, format, frequency, recipients, filters } = req.body;

      const scheduledExport = {
        id: new mongoose.Types.ObjectId().toString(),
        name,
        type,
        format,
        frequency,
        recipients,
        filters: filters || {},
        createdBy: req.user.id,
        createdAt: new Date(),
        lastRun: null,
        nextRun: calculateNextRun(frequency),
        active: true
      };

      // Store scheduled export (in production, save to DB)
      let userExports = exportHistory.get(req.user.id) || [];
      userExports.push({
        ...scheduledExport,
        isScheduled: true
      });
      exportHistory.set(req.user.id, userExports);

      res.json({
        success: true,
        message: 'Scheduled export created',
        export: scheduledExport
      });

    } catch (error) {
      console.error('Scheduled Export Error:', error);
      res.status(500).json({ error: 'Errore nella creazione export programmato' });
    }
  }
);

// Helper: Calculate next run time
function calculateNextRun(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(9, 0, 0, 0); // 9 AM
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      now.setHours(9, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      now.setDate(1);
      now.setHours(9, 0, 0, 0);
      break;
  }
  return now;
}

/**
 * GET /api/exports/formats
 * Get available export formats and options
 */
router.get('/exports/formats',
  authenticateToken,
  (req, res) => {
    res.json({
      success: true,
      formats: {
        csv: {
          name: 'CSV',
          description: 'Comma-separated values, ideal for Excel/spreadsheet analysis',
          mimeType: 'text/csv',
          extensions: ['csv'],
          availableFor: ['analytics', 'users', 'rewards', 'redemptions', 'audit', 'leaderboard']
        },
        pdf: {
          name: 'PDF',
          description: 'Professional formatted report with visualizations',
          mimeType: 'application/pdf',
          extensions: ['pdf'],
          availableFor: ['analytics', 'leaderboard']
        }
      },
      types: [
        { id: 'analytics', name: 'Analytics Overview', description: 'Summary of platform metrics and KPIs' },
        { id: 'users', name: 'Users Directory', description: 'Complete user list with details' },
        { id: 'rewards', name: 'Rewards Catalog', description: 'All rewards and their performance' },
        { id: 'redemptions', name: 'Redemption History', description: 'All redemption transactions' },
        { id: 'audit', name: 'Audit Logs', description: 'Security and action logs' },
        { id: 'leaderboard', name: 'Leaderboard', description: 'Top viewers ranking' }
      ]
    });
  }
);

module.exports = router;
