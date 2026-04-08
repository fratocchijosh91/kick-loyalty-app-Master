/**
 * Phase 4 - Batch Operations Routes
 * Bulk create, update, delete operations for efficient data management
 * 
 * Features:
 * - Batch rewards CRUD (bulk create/update/delete)
 * - Batch user imports (CSV/JSON)
 * - Batch points assignment
 * - Batch redemption processing
 * - Job queue with status tracking
 * - Progress monitoring
 */

const express = require('express');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, checkPermission } = require('./middleware');
const { Parser } = require('json2csv');

const router = express.Router();

// Models
const {
  User,
  Reward,
  ViewerPoints,
  RedemptionRequest,
  Organization,
  BatchJob
} = require('./models');

// Rate limiting for batch operations
const batchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 batch operations per minute
  message: { error: 'Troppe operazioni batch, riprova tra un minuto.' }
});

// Validation helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Helper: Generate job ID
const generateJobId = () => new mongoose.Types.ObjectId().toString();

// Helper: Update job progress
const updateJobProgress = async (jobId, progress, results, error = null) => {
  try {
    const update = {
      progress: Math.min(100, Math.max(0, progress)),
      processedCount: results?.processed || 0,
      successCount: results?.success || 0,
      errorCount: results?.errors || 0,
      updatedAt: new Date()
    };
    
    if (progress >= 100) {
      update.status = error ? 'failed' : 'completed';
      update.completedAt = new Date();
      if (error) update.error = error;
    }
    
    await BatchJob.findByIdAndUpdate(jobId, update);
  } catch (err) {
    console.error('Failed to update job progress:', err);
  }
};

// ============================================
// BATCH REWARDS OPERATIONS
// ============================================

/**
 * POST /api/batch/rewards/create
 * Bulk create rewards
 */
router.post('/batch/rewards/create',
  authenticateToken,
  checkPermission('manage_rewards'),
  batchLimiter,
  [
    body('rewards').isArray({ min: 1, max: 100 }).withMessage('Array of 1-100 rewards required'),
    body('rewards.*.name').trim().isLength({ min: 1, max: 100 }),
    body('rewards.*.points').isInt({ min: 0, max: 1000000 }),
    body('rewards.*.description').optional().trim().isLength({ max: 500 }),
    body('organizationId').optional().isMongoId()
  ],
  validate,
  async (req, res) => {
    const jobId = generateJobId();
    
    try {
      const { rewards, organizationId } = req.body;
      
      // Create job record
      const batchJob = new BatchJob({
        _id: jobId,
        type: 'rewards_create',
        status: 'processing',
        totalCount: rewards.length,
        createdBy: req.user.id,
        organizationId: organizationId || req.user.organizationId,
        metadata: { operation: 'bulk_create', entityType: 'rewards' }
      });
      await batchJob.save();

      // Respond immediately with job ID
      res.json({
        success: true,
        message: 'Batch job started',
        jobId,
        status: 'processing'
      });

      // Process asynchronously
      setImmediate(async () => {
        const results = { processed: 0, success: 0, errors: 0, details: [] };
        
        for (let i = 0; i < rewards.length; i++) {
          try {
            const reward = new Reward({
              ...rewards[i],
              organizationId: organizationId || req.user.organizationId,
              createdBy: req.user.id
            });
            await reward.save();
            results.success++;
            results.details.push({ index: i, status: 'success', id: reward._id });
          } catch (error) {
            results.errors++;
            results.details.push({ 
              index: i, 
              status: 'error', 
              error: error.message,
              data: rewards[i]
            });
          }
          results.processed++;
          
          // Update progress every 10 items
          if (i % 10 === 0 || i === rewards.length - 1) {
            await updateJobProgress(jobId, (i + 1) / rewards.length * 100, results);
          }
        }
        
        await updateJobProgress(jobId, 100, results);
      });

    } catch (error) {
      console.error('Batch rewards create error:', error);
      res.status(500).json({ error: 'Errore durante la creazione batch' });
    }
  }
);

/**
 * POST /api/batch/rewards/update
 * Bulk update rewards
 */
router.post('/batch/rewards/update',
  authenticateToken,
  checkPermission('manage_rewards'),
  batchLimiter,
  [
    body('updates').isArray({ min: 1, max: 100 }),
    body('updates.*.id').isMongoId(),
    body('organizationId').optional().isMongoId()
  ],
  validate,
  async (req, res) => {
    const jobId = generateJobId();
    
    try {
      const { updates, organizationId } = req.body;
      
      const batchJob = new BatchJob({
        _id: jobId,
        type: 'rewards_update',
        status: 'processing',
        totalCount: updates.length,
        createdBy: req.user.id,
        organizationId: organizationId || req.user.organizationId,
        metadata: { operation: 'bulk_update', entityType: 'rewards' }
      });
      await batchJob.save();

      res.json({
        success: true,
        message: 'Batch update started',
        jobId,
        status: 'processing'
      });

      setImmediate(async () => {
        const results = { processed: 0, success: 0, errors: 0, details: [] };
        
        for (let i = 0; i < updates.length; i++) {
          try {
            const { id, ...updateData } = updates[i];
            const reward = await Reward.findOneAndUpdate(
              { 
                _id: id, 
                organizationId: organizationId || req.user.organizationId 
              },
              { $set: updateData },
              { new: true }
            );
            
            if (reward) {
              results.success++;
              results.details.push({ index: i, status: 'success', id });
            } else {
              results.errors++;
              results.details.push({ index: i, status: 'error', error: 'Reward not found', id });
            }
          } catch (error) {
            results.errors++;
            results.details.push({ index: i, status: 'error', error: error.message, id: updates[i].id });
          }
          results.processed++;
          
          if (i % 10 === 0 || i === updates.length - 1) {
            await updateJobProgress(jobId, (i + 1) / updates.length * 100, results);
          }
        }
        
        await updateJobProgress(jobId, 100, results);
      });

    } catch (error) {
      console.error('Batch rewards update error:', error);
      res.status(500).json({ error: 'Errore durante l\'aggiornamento batch' });
    }
  }
);

/**
 * POST /api/batch/rewards/delete
 * Bulk delete rewards
 */
router.post('/batch/rewards/delete',
  authenticateToken,
  checkPermission('manage_rewards'),
  batchLimiter,
  [
    body('ids').isArray({ min: 1, max: 100 }),
    body('ids.*').isMongoId(),
    body('organizationId').optional().isMongoId()
  ],
  validate,
  async (req, res) => {
    const jobId = generateJobId();
    
    try {
      const { ids, organizationId } = req.body;
      
      const batchJob = new BatchJob({
        _id: jobId,
        type: 'rewards_delete',
        status: 'processing',
        totalCount: ids.length,
        createdBy: req.user.id,
        organizationId: organizationId || req.user.organizationId,
        metadata: { operation: 'bulk_delete', entityType: 'rewards', ids }
      });
      await batchJob.save();

      res.json({
        success: true,
        message: 'Batch delete started',
        jobId,
        status: 'processing'
      });

      setImmediate(async () => {
        const results = { processed: 0, success: 0, errors: 0, details: [] };
        
        for (let i = 0; i < ids.length; i++) {
          try {
            const result = await Reward.findOneAndDelete({
              _id: ids[i],
              organizationId: organizationId || req.user.organizationId
            });
            
            if (result) {
              results.success++;
              results.details.push({ index: i, status: 'success', id: ids[i] });
            } else {
              results.errors++;
              results.details.push({ index: i, status: 'error', error: 'Reward not found', id: ids[i] });
            }
          } catch (error) {
            results.errors++;
            results.details.push({ index: i, status: 'error', error: error.message, id: ids[i] });
          }
          results.processed++;
          
          if (i % 10 === 0 || i === ids.length - 1) {
            await updateJobProgress(jobId, (i + 1) / ids.length * 100, results);
          }
        }
        
        await updateJobProgress(jobId, 100, results);
      });

    } catch (error) {
      console.error('Batch rewards delete error:', error);
      res.status(500).json({ error: 'Errore durante l\'eliminazione batch' });
    }
  }
);

// ============================================
// BATCH USER IMPORT
// ============================================

/**
 * POST /api/batch/users/import
 * Bulk import users from CSV/JSON data
 */
router.post('/batch/users/import',
  authenticateToken,
  requireAdmin,
  batchLimiter,
  [
    body('users').isArray({ min: 1, max: 500 }),
    body('users.*.kickUsername').trim().isLength({ min: 1, max: 50 }),
    body('users.*.email').optional().isEmail(),
    body('organizationId').optional().isMongoId(),
    body('defaultPoints').optional().isInt({ min: 0 })
  ],
  validate,
  async (req, res) => {
    const jobId = generateJobId();
    
    try {
      const { users, organizationId, defaultPoints = 0 } = req.body;
      
      const batchJob = new BatchJob({
        _id: jobId,
        type: 'users_import',
        status: 'processing',
        totalCount: users.length,
        createdBy: req.user.id,
        organizationId: organizationId || req.user.organizationId,
        metadata: { operation: 'bulk_import', entityType: 'users', defaultPoints }
      });
      await batchJob.save();

      res.json({
        success: true,
        message: 'User import started',
        jobId,
        status: 'processing'
      });

      setImmediate(async () => {
        const results = { processed: 0, success: 0, errors: 0, details: [], duplicates: 0 };
        
        for (let i = 0; i < users.length; i++) {
          try {
            const userData = users[i];
            
            // Check for existing user
            const existingUser = await User.findOne({
              kickUsername: userData.kickUsername.toLowerCase()
            });
            
            if (existingUser) {
              results.duplicates++;
              results.details.push({ 
                index: i, 
                status: 'duplicate', 
                id: existingUser._id,
                username: userData.kickUsername
              });
            } else {
              // Create new user
              const user = new User({
                ...userData,
                kickUsername: userData.kickUsername.toLowerCase(),
                organizationId: organizationId || req.user.organizationId,
                totalPoints: defaultPoints,
                createdAt: new Date()
              });
              await user.save();
              
              // Create viewer points entry if default points
              if (defaultPoints > 0) {
                await ViewerPoints.create({
                  viewerUsername: user.kickUsername,
                  streamerUsername: req.user.username,
                  points: defaultPoints,
                  totalEarned: defaultPoints,
                  organizationId: organizationId || req.user.organizationId
                });
              }
              
              results.success++;
              results.details.push({ 
                index: i, 
                status: 'created', 
                id: user._id,
                username: user.kickUsername
              });
            }
          } catch (error) {
            results.errors++;
            results.details.push({ 
              index: i, 
              status: 'error', 
              error: error.message,
              username: users[i].kickUsername
            });
          }
          results.processed++;
          
          if (i % 10 === 0 || i === users.length - 1) {
            await updateJobProgress(jobId, (i + 1) / users.length * 100, results);
          }
        }
        
        await updateJobProgress(jobId, 100, results);
      });

    } catch (error) {
      console.error('Batch user import error:', error);
      res.status(500).json({ error: 'Errore durante l\'importazione utenti' });
    }
  }
);

// ============================================
// BATCH POINTS ASSIGNMENT
// ============================================

/**
 * POST /api/batch/points/assign
 * Bulk assign points to multiple viewers
 */
router.post('/batch/points/assign',
  authenticateToken,
  checkPermission('manage_points'),
  batchLimiter,
  [
    body('assignments').isArray({ min: 1, max: 200 }),
    body('assignments.*.viewerUsername').trim().isLength({ min: 1 }),
    body('assignments.*.points').isInt({ min: -10000, max: 10000 }),
    body('reason').optional().trim().isLength({ max: 200 }),
    body('organizationId').optional().isMongoId()
  ],
  validate,
  async (req, res) => {
    const jobId = generateJobId();
    
    try {
      const { assignments, reason = 'Batch assignment', organizationId } = req.body;
      
      const batchJob = new BatchJob({
        _id: jobId,
        type: 'points_assign',
        status: 'processing',
        totalCount: assignments.length,
        createdBy: req.user.id,
        organizationId: organizationId || req.user.organizationId,
        metadata: { operation: 'bulk_points', reason, totalPoints: assignments.reduce((s, a) => s + a.points, 0) }
      });
      await batchJob.save();

      res.json({
        success: true,
        message: 'Points assignment started',
        jobId,
        status: 'processing'
      });

      setImmediate(async () => {
        const results = { processed: 0, success: 0, errors: 0, details: [], totalAssigned: 0 };
        
        for (let i = 0; i < assignments.length; i++) {
          try {
            const { viewerUsername, points } = assignments[i];
            const orgId = organizationId || req.user.organizationId;
            
            const vp = await ViewerPoints.findOneAndUpdate(
              { 
                viewerUsername: viewerUsername.toLowerCase(),
                streamerUsername: req.user.username,
                organizationId: orgId
              },
              { 
                $inc: { points: points, totalEarned: points > 0 ? points : 0 },
                lastSeen: new Date()
              },
              { upsert: true, new: true }
            );
            
            results.success++;
            results.totalAssigned += points;
            results.details.push({ 
              index: i, 
              status: 'success', 
              viewerUsername,
              newBalance: vp.points
            });
          } catch (error) {
            results.errors++;
            results.details.push({ 
              index: i, 
              status: 'error', 
              error: error.message,
              viewerUsername: assignments[i].viewerUsername
            });
          }
          results.processed++;
          
          if (i % 20 === 0 || i === assignments.length - 1) {
            await updateJobProgress(jobId, (i + 1) / assignments.length * 100, results);
          }
        }
        
        await updateJobProgress(jobId, 100, results);
      });

    } catch (error) {
      console.error('Batch points assign error:', error);
      res.status(500).json({ error: 'Errore durante l\'assegnazione punti' });
    }
  }
);

// ============================================
// BATCH REDEMPTION PROCESSING
// ============================================

/**
 * POST /api/batch/redemptions/process
 * Bulk approve/reject/fulfill redemptions
 */
router.post('/batch/redemptions/process',
  authenticateToken,
  checkPermission('manage_redemptions'),
  batchLimiter,
  [
    body('ids').isArray({ min: 1, max: 100 }),
    body('ids.*').isMongoId(),
    body('action').isIn(['approve', 'reject', 'fulfill']),
    body('notes').optional().trim().isLength({ max: 500 })
  ],
  validate,
  async (req, res) => {
    const jobId = generateJobId();
    
    try {
      const { ids, action, notes = '' } = req.body;
      
      const batchJob = new BatchJob({
        _id: jobId,
        type: 'redemptions_process',
        status: 'processing',
        totalCount: ids.length,
        createdBy: req.user.id,
        metadata: { operation: action, entityType: 'redemptions', notes }
      });
      await batchJob.save();

      res.json({
        success: true,
        message: `Batch ${action} started`,
        jobId,
        status: 'processing'
      });

      setImmediate(async () => {
        const results = { processed: 0, success: 0, errors: 0, details: [] };
        
        for (let i = 0; i < ids.length; i++) {
          try {
            const updateData = {
              status: action === 'fulfill' ? 'fulfilled' : action === 'approve' ? 'approved' : 'rejected',
              updatedAt: new Date(),
              updatedBy: req.user.id
            };
            
            if (notes) updateData.notes = notes;
            if (action === 'fulfill') {
              updateData.fulfilledAt = new Date();
              updateData.fulfilledBy = req.user.id;
            }
            
            const redemption = await RedemptionRequest.findByIdAndUpdate(
              ids[i],
              { $set: updateData },
              { new: true }
            );
            
            if (redemption) {
              results.success++;
              results.details.push({ index: i, status: 'success', id: ids[i], newStatus: updateData.status });
            } else {
              results.errors++;
              results.details.push({ index: i, status: 'error', error: 'Redemption not found', id: ids[i] });
            }
          } catch (error) {
            results.errors++;
            results.details.push({ index: i, status: 'error', error: error.message, id: ids[i] });
          }
          results.processed++;
          
          if (i % 10 === 0 || i === ids.length - 1) {
            await updateJobProgress(jobId, (i + 1) / ids.length * 100, results);
          }
        }
        
        await updateJobProgress(jobId, 100, results);
      });

    } catch (error) {
      console.error('Batch redemption process error:', error);
      res.status(500).json({ error: 'Errore durante l\'elaborazione batch' });
    }
  }
);

// ============================================
// JOB MONITORING
// ============================================

/**
 * GET /api/batch/jobs
 * List batch jobs for organization
 */
router.get('/batch/jobs',
  authenticateToken,
  async (req, res) => {
    try {
      const { organizationId, status, type, limit = 50 } = req.query;
      
      let query = {};
      if (organizationId) query.organizationId = organizationId;
      if (status) query.status = status;
      if (type) query.type = type;
      
      // Users can see their own jobs, admins can see all org jobs
      if (req.user.role !== 'admin' && req.user.role !== 'owner') {
        query.createdBy = req.user.id;
      }
      
      const jobs = await BatchJob.find(query)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .select('-results.details'); // Exclude detailed results for list view
      
      res.json({
        success: true,
        jobs
      });
    } catch (error) {
      console.error('List jobs error:', error);
      res.status(500).json({ error: 'Errore nel recupero job' });
    }
  }
);

/**
 * GET /api/batch/jobs/:id
 * Get specific job details with results
 */
router.get('/batch/jobs/:id',
  authenticateToken,
  async (req, res) => {
    try {
      const job = await BatchJob.findById(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: 'Job non trovato' });
      }
      
      // Check permissions
      if (job.createdBy.toString() !== req.user.id && 
          req.user.role !== 'admin' && 
          req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      
      res.json({
        success: true,
        job
      });
    } catch (error) {
      console.error('Get job error:', error);
      res.status(500).json({ error: 'Errore nel recupero job' });
    }
  }
);

/**
 * POST /api/batch/jobs/:id/cancel
 * Cancel a running job
 */
router.post('/batch/jobs/:id/cancel',
  authenticateToken,
  async (req, res) => {
    try {
      const job = await BatchJob.findById(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: 'Job non trovato' });
      }
      
      if (job.status !== 'processing') {
        return res.status(400).json({ error: 'Job non è in esecuzione' });
      }
      
      // Check permissions
      if (job.createdBy.toString() !== req.user.id && 
          req.user.role !== 'admin' && 
          req.user.role !== 'owner') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      
      job.status = 'cancelled';
      job.completedAt = new Date();
      await job.save();
      
      res.json({
        success: true,
        message: 'Job cancellato'
      });
    } catch (error) {
      console.error('Cancel job error:', error);
      res.status(500).json({ error: 'Errore durante la cancellazione' });
    }
  }
);

module.exports = router;
