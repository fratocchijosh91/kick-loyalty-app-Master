/**
 * Redemption Routes
 * Gestione del workflow di riscatto punti per reward
 * 
 * Features:
 * - Viewer richiede riscatto di reward
 * - Admin approva/rifiuta riscatti
 * - Tracking fulfillment (consegna)
 * - Auto-expiry dopo 30 giorni
 * - Notifiche email
 */

const express = require('express');
const { Redemption, Reward, ViewerPoints, User, Organization } = require('./models');
const { authenticateToken, requirePermissions } = require('./middleware');
const { logAuditEvent } = require('./audit-routes');

const router = express.Router();

// ==================== PUBLIC ROUTES (Require Token) ====================

/**
 * POST /api/redemptions
 * Viewer richiede il riscatto di un reward
 * 
 * Body: { rewardId, quantity? }
 * Quantity default: 1
 */
router.post('/api/redemptions', authenticateToken, async (req, res) => {
  try {
    const { rewardId, quantity = 1 } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organizationId;

    // Validazione
    if (!rewardId) {
      return res.status(400).json({ error: 'rewardId è obbligatorio' });
    }

    if (quantity < 1) {
      return res.status(400).json({ error: 'Quantità deve essere >= 1' });
    }

    // Fetch reward
    const reward = await Reward.findOne({
      _id: rewardId,
      organizationId
    });

    if (!reward) {
      return res.status(404).json({ error: 'Reward non trovato' });
    }

    // Calcola punti totali necessari
    const pointsNeeded = reward.pointsCost * quantity;

    // Controlla punti del viewer
    const viewerPoints = await ViewerPoints.findOne({
      userId,
      organizationId
    });

    if (!viewerPoints || viewerPoints.balance < pointsNeeded) {
      return res.status(400).json({
        error: 'Punti insufficienti',
        balance: viewerPoints?.balance || 0,
        needed: pointsNeeded,
        shortfall: pointsNeeded - (viewerPoints?.balance || 0)
      });
    }

    // Crea redemption request
    const redemption = new Redemption({
      organizationId,
      rewardId,
      userId,
      viewerUsername: req.user.username,
      quantity,
      pointsSpent: pointsNeeded,
      status: 'pending',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 giorni
      activityLog: [{
        action: 'pending_created',
        timestamp: new Date(),
        notes: `Redemption richiesta per ${quantity}x ${reward.name}`
      }]
    });

    await redemption.save();

    // Decrementa punti del viewer (metti in pending)
    // Nota: i punti vengono veramente consumati solo quando si approva
    // Per ora solo marcamo come "in use"
    viewerPoints.pendingRedemptions = (viewerPoints.pendingRedemptions || 0) + pointsNeeded;
    await viewerPoints.save();

    // Log audit event
    await logAuditEvent({
      userId,
      organizationId,
      username: req.user.username,
      action: 'create',
      resourceType: 'redemption',
      resourceId: redemption._id,
      resourceName: `${quantity}x ${reward.name}`,
      details: `Requested redemption of ${quantity}x ${reward.name} for ${pointsNeeded} points`,
      changes: {
        before: { status: 'none' },
        after: { status: 'pending', pointsSpent: pointsNeeded }
      },
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      success: true
    });

    res.status(201).json({
      success: true,
      message: 'Redemption richiesta creata',
      redemption: {
        _id: redemption._id,
        status: redemption.status,
        pointsSpent: redemption.pointsSpent,
        expiresAt: redemption.expiresAt,
        requestedAt: redemption.requestedAt
      }
    });
  } catch (err) {
    console.error('Errore creazione redemption:', err);
    res.status(500).json({ error: 'Errore creazione redemption' });
  }
});

/**
 * GET /api/redemptions
 * Elenca redemptions (viewer vede solo loro, admin vede tutti)
 * 
 * Query: status, page, limit
 */
router.get('/api/redemptions', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 25 } = req.query;
    const organizationId = req.user.organizationId;
    const userId = req.user.id;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 25);
    const skip = (pageNum - 1) * limitNum;

    // Build filter
    const filter = { organizationId };

    // Se viewer (non admin), vede solo i propri
    const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
    if (!isAdmin) {
      filter.userId = userId;
    }

    if (status) {
      filter.status = status;
    }

    // Query
    const [redemptions, total] = await Promise.all([
      Redemption.find(filter)
        .populate('rewardId', 'name pointsCost description')
        .populate('userId', 'username email')
        .populate('reviewedBy', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Redemption.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: redemptions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Errore fetch redemptions:', err);
    res.status(500).json({ error: 'Errore fetch redemptions' });
  }
});

/**
 * GET /api/redemptions/:id
 * Dettagli dello specifico riscatto
 */
router.get('/api/redemptions/:id', authenticateToken, async (req, res) => {
  try {
    const redemption = await Redemption.findOne({
      _id: req.params.id,
      organizationId: req.user.organizationId
    })
      .populate('rewardId', 'name pointsCost description')
      .populate('userId', 'username email')
      .populate('reviewedBy', 'username')
      .lean();

    if (!redemption) {
      return res.status(404).json({ error: 'Redemption non trovato' });
    }

    // Authorization check per viewer
    const isAdmin = req.user.role === 'admin' || req.user.role === 'owner';
    if (!isAdmin && redemption.userId._id.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Non sei autorizzato' });
    }

    res.json({ success: true, data: redemption });
  } catch (err) {
    console.error('Errore fetch redemption:', err);
    res.status(500).json({ error: 'Errore fetch redemption' });
  }
});

/**
 * PATCH /api/redemptions/:id/approve
 * Admin approva il riscatto
 * 
 * Body: { approverComments? }
 */
router.patch(
  '/api/redemptions/:id/approve',
  authenticateToken,
  requirePermissions('redemptions:approve'),
  async (req, res) => {
    try {
      const { approverComments = '' } = req.body;
      const redemption = await Redemption.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId
      });

      if (!redemption) {
        return res.status(404).json({ error: 'Redemption non trovato' });
      }

      if (redemption.status !== 'pending') {
        return res.status(400).json({
          error: `Redemption non può essere approvato (status: ${redemption.status})`
        });
      }

      // Aggiorna redemption
      redemption.status = 'approved';
      redemption.reviewedAt = new Date();
      redemption.reviewedBy = req.user.id;
      redemption.approverComments = approverComments;
      redemption.activityLog.push({
        action: 'approved',
        by: req.user.id,
        timestamp: new Date(),
        notes: `Approvato da ${req.user.username}: ${approverComments}`
      });

      await redemption.save();

      // Log audit event
      await logAuditEvent({
        userId: req.user.id,
        organizationId: req.user.organizationId,
        username: req.user.username,
        action: 'permission_change',
        resourceType: 'redemption',
        resourceId: redemption._id,
        resourceName: `Approved ${redemption.quantity}x reward`,
        details: `Admin approvò il riscatto #${redemption._id}`,
        success: true
      });

      res.json({
        success: true,
        message: 'Redemption approvato',
        status: redemption.status
      });
    } catch (err) {
      console.error('Errore approvazione:', err);
      res.status(500).json({ error: 'Errore approvazione' });
    }
  }
);

/**
 * PATCH /api/redemptions/:id/reject
 * Admin rifiuta il riscatto
 * 
 * Body: { reason }
 */
router.patch(
  '/api/redemptions/:id/reject',
  authenticateToken,
  requirePermissions('redemptions:approve'),
  async (req, res) => {
    try {
      const { reason = 'Nessun motivo fornito' } = req.body;
      const redemption = await Redemption.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId
      });

      if (!redemption) {
        return res.status(404).json({ error: 'Redemption non trovato' });
      }

      if (redemption.status !== 'pending') {
        return res.status(400).json({
          error: `Redemption non può essere rifiutato (status: ${redemption.status})`
        });
      }

      // Aggiorna redemption
      redemption.status = 'rejected';
      redemption.reviewedAt = new Date();
      redemption.reviewedBy = req.user.id;
      redemption.approverComments = reason;
      redemption.activityLog.push({
        action: 'rejected',
        by: req.user.id,
        timestamp: new Date(),
        notes: `Rifiutato da ${req.user.username}: ${reason}`
      });

      await redemption.save();

      // Restore pending points
      const viewerPoints = await ViewerPoints.findOne({
        userId: redemption.userId,
        organizationId: req.user.organizationId
      });
      
      if (viewerPoints) {
        viewerPoints.pendingRedemptions = Math.max(
          0,
          (viewerPoints.pendingRedemptions || 0) - redemption.pointsSpent
        );
        await viewerPoints.save();
      }

      // Log audit event
      await logAuditEvent({
        userId: req.user.id,
        organizationId: req.user.organizationId,
        username: req.user.username,
        action: 'update',
        resourceType: 'redemption',
        resourceId: redemption._id,
        details: `Redemption rifiutato: ${reason}`,
        success: true
      });

      res.json({
        success: true,
        message: 'Redemption rifiutato',
        status: redemption.status
      });
    } catch (err) {
      console.error('Errore rifiuto:', err);
      res.status(500).json({ error: 'Errore rifiuto' });
    }
  }
);

/**
 * PATCH /api/redemptions/:id/fulfill
 * Admin marca il riscatto come consegnato
 * 
 * Body: { fulfillmentMethod, fulfillmentDetails? }
 */
router.patch(
  '/api/redemptions/:id/fulfill',
  authenticateToken,
  requirePermissions('redemptions:approve'),
  async (req, res) => {
    try {
      const { fulfillmentMethod = 'digital', fulfillmentDetails = {} } = req.body;
      const redemption = await Redemption.findOne({
        _id: req.params.id,
        organizationId: req.user.organizationId
      });

      if (!redemption) {
        return res.status(404).json({ error: 'Redemption non trovato' });
      }

      if (redemption.status !== 'approved') {
        return res.status(400).json({
          error: `Redemption deve essere approvato prima (status: ${redemption.status})`
        });
      }

      // Aggiorna redemption
      redemption.status = 'fulfilled';
      redemption.fulfilledAt = new Date();
      redemption.fulfillmentMethod = fulfillmentMethod;
      redemption.fulfillmentDetails = fulfillmentDetails;
      redemption.activityLog.push({
        action: 'fulfilled',
        by: req.user.id,
        timestamp: new Date(),
        notes: `Consegnato via ${fulfillmentMethod}`
      });

      await redemption.save();

      // Consuma i punti dal viewer (ora che è fulfilled)
      const viewerPoints = await ViewerPoints.findOne({
        userId: redemption.userId,
        organizationId: req.user.organizationId
      });

      if (viewerPoints) {
        viewerPoints.balance -= redemption.pointsSpent;
        viewerPoints.pendingRedemptions = Math.max(
          0,
          (viewerPoints.pendingRedemptions || 0) - redemption.pointsSpent
        );
        viewerPoints.totalRedeemed = (viewerPoints.totalRedeemed || 0) + redemption.pointsSpent;
        await viewerPoints.save();
      }

      // Log audit event
      await logAuditEvent({
        userId: req.user.id,
        organizationId: req.user.organizationId,
        username: req.user.username,
        action: 'update',
        resourceType: 'redemption',
        resourceId: redemption._id,
        details: `Redemption consegnato via ${fulfillmentMethod}`,
        success: true
      });

      res.json({
        success: true,
        message: 'Redemption consegnato',
        status: redemption.status
      });
    } catch (err) {
      console.error('Errore fulfillment:', err);
      res.status(500).json({ error: 'Errore fulfillment' });
    }
  }
);

/**
 * GET /api/redemptions/pending
 * Admin view - tutti i riscatti in pending
 */
router.get(
  '/api/redemptions/pending',
  authenticateToken,
  requirePermissions('redemptions:approve'),
  async (req, res) => {
    try {
      const { page = 1, limit = 25 } = req.query;

      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, parseInt(limit, 10) || 25);
      const skip = (pageNum - 1) * limitNum;

      const [pending, total] = await Promise.all([
        Redemption.find({
          organizationId: req.user.organizationId,
          status: 'pending'
        })
          .populate('rewardId', 'name pointsCost description')
          .populate('userId', 'username email')
          .sort({ requestedAt: 1 }) // Oldest first
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Redemption.countDocuments({
          organizationId: req.user.organizationId,
          status: 'pending'
        })
      ]);

      res.json({
        success: true,
        data: pending,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
          awaitingReview: total
        }
      });
    } catch (err) {
      console.error('Errore fetch pending:', err);
      res.status(500).json({ error: 'Errore fetch pending' });
    }
  }
);

/**
 * GET /api/rewards/:rewardId/redemptions
 * Tutte le redemption per uno specifico reward
 */
router.get('/api/rewards/:rewardId/redemptions', authenticateToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 25 } = req.query;

    const filter = {
      organizationId: req.user.organizationId,
      rewardId: req.params.rewardId
    };

    if (status) {
      filter.status = status;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, parseInt(limit, 10) || 25);
    const skip = (pageNum - 1) * limitNum;

    const [redemptions, total] = await Promise.all([
      Redemption.find(filter)
        .populate('userId', 'username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Redemption.countDocuments(filter)
    ]);

    res.json({
      success: true,
      data: redemptions,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error('Errore fetch reward redemptions:', err);
    res.status(500).json({ error: 'Errore fetch' });
  }
});

/**
 * GET /api/redemptions/stats
 * Statistiche redemption (admin only)
 */
router.get(
  '/api/redemptions/stats',
  authenticateToken,
  requirePermissions('redemptions:approve'),
  async (req, res) => {
    try {
      const { daysBack = 30 } = req.query;

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(daysBack, 10));

      const stats = await Redemption.aggregate([
        {
          $match: {
            organizationId: req.user.organizationId,
            createdAt: { $gte: startDate }
          }
        },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPoints: { $sum: '$pointsSpent' }
          }
        }
      ]);

      const pending = stats.find(s => s._id === 'pending')?.count || 0;
      const approved = stats.find(s => s._id === 'approved')?.count || 0;
      const fulfilled = stats.find(s => s._id === 'fulfilled')?.count || 0;
      const rejected = stats.find(s => s._id === 'rejected')?.count || 0;

      res.json({
        success: true,
        period: { days: parseInt(daysBack, 10), startDate },
        summary: {
          total: pending + approved + fulfilled + rejected,
          pending,
          approved,
          fulfilled,
          rejected,
          totalPointsRedeemed: fulfilled > 0
            ? (stats.find(s => s._id === 'fulfilled')?.totalPoints || 0)
            : 0
        }
      });
    } catch (err) {
      console.error('Errore stats:', err);
      res.status(500).json({ error: 'Errore calcolo statistiche' });
    }
  }
);

module.exports = router;
