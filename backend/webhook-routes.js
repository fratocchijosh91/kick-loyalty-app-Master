/**
 * Phase 4 - Webhook Routes
 * External webhook configuration and event delivery system
 * 
 * Features:
 * - Webhook CRUD management
 * - Event subscription configuration
 * - Reliable delivery with retry logic
 * - Delivery logging and monitoring
 * - HMAC signature verification
 * - HTTPS enforcement in production
 */

const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken, requireAdmin, checkPermission } = require('./middleware');

const router = express.Router();

// Models
const { Webhook, WebhookDelivery, Organization } = require('./models');

// Rate limiting
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Troppe richieste webhook, riprova tra un minuto.' }
});

// Validation helper
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Helper: Generate HMAC signature
const generateSignature = (payload, secret) => {
  return crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');
};

// Helper: Verify webhook URL is HTTPS in production
const isValidWebhookUrl = (url) => {
  try {
    const parsed = new URL(url);
    if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:') {
      return false;
    }
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
};

// Helper: Calculate next retry time with exponential backoff
const calculateNextRetry = (attempt, policy) => {
  const delay = Math.min(
    policy.initialDelay * Math.pow(policy.backoffMultiplier, attempt - 1),
    policy.maxDelay
  );
  return new Date(Date.now() + delay);
};

// ============================================
// WEBHOOK MANAGEMENT
// ============================================

/**
 * GET /api/webhooks
 * List all webhooks for organization
 */
router.get('/webhooks',
  authenticateToken,
  checkPermission('manage_webhooks'),
  async (req, res) => {
    try {
      const { organizationId } = req.query;
      const orgId = organizationId || req.user.organizationId;
      
      // Check permissions
      if (orgId !== req.user.organizationId && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      
      const webhooks = await Webhook.find({ organizationId: orgId })
        .select('-auth.secret -auth.password') // Hide sensitive data
        .sort({ createdAt: -1 });
      
      res.json({
        success: true,
        webhooks
      });
    } catch (error) {
      console.error('List webhooks error:', error);
      res.status(500).json({ error: 'Errore nel recupero webhook' });
    }
  }
);

/**
 * GET /api/webhooks/:id
 * Get single webhook details
 */
router.get('/webhooks/:id',
  authenticateToken,
  checkPermission('manage_webhooks'),
  async (req, res) => {
    try {
      const webhook = await Webhook.findById(req.params.id)
        .select('-auth.secret -auth.password');
      
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook non trovato' });
      }
      
      // Check organization access
      if (webhook.organizationId.toString() !== req.user.organizationId && 
          req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      
      // Get recent deliveries
      const recentDeliveries = await WebhookDelivery.find({ 
        webhookId: webhook._id 
      })
        .sort({ createdAt: -1 })
        .limit(20)
        .select('-request.body -response.body'); // Truncate large fields
      
      res.json({
        success: true,
        webhook: {
          ...webhook.toObject(),
          recentDeliveries
        }
      });
    } catch (error) {
      console.error('Get webhook error:', error);
      res.status(500).json({ error: 'Errore nel recupero webhook' });
    }
  }
);

/**
 * POST /api/webhooks
 * Create new webhook
 */
router.post('/webhooks',
  authenticateToken,
  checkPermission('manage_webhooks'),
  webhookLimiter,
  [
    body('name').trim().isLength({ min: 1, max: 100 }),
    body('url').isURL(),
    body('events').isArray({ min: 1 }).withMessage('At least one event required'),
    body('events.*').isIn([
      'user.created', 'user.updated', 'user.deleted',
      'reward.created', 'reward.updated', 'reward.deleted',
      'redemption.requested', 'redemption.approved', 'redemption.rejected', 'redemption.fulfilled',
      'points.assigned', 'points.redeemed',
      'achievement.unlocked',
      'member.invited', 'member.joined', 'member.left',
      'subscription.created', 'subscription.cancelled', 'subscription.updated',
      'batch.job.completed', 'batch.job.failed'
    ]),
    body('method').optional().isIn(['POST', 'PUT', 'PATCH']),
    body('auth.type').optional().isIn(['none', 'bearer', 'basic', 'hmac']),
    body('organizationId').optional().isMongoId()
  ],
  validate,
  async (req, res) => {
    try {
      const {
        name,
        description,
        url,
        method = 'POST',
        events,
        auth = { type: 'none' },
        headers = [],
        retryPolicy,
        organizationId
      } = req.body;
      
      // Validate URL
      if (!isValidWebhookUrl(url)) {
        return res.status(400).json({ 
          error: process.env.NODE_ENV === 'production' 
            ? 'HTTPS required in production' 
            : 'Invalid URL' 
        });
      }
      
      const orgId = organizationId || req.user.organizationId;
      
      // Check webhook limit per org (e.g., max 10)
      const existingCount = await Webhook.countDocuments({ 
        organizationId: orgId,
        active: true 
      });
      
      if (existingCount >= 10) {
        return res.status(400).json({ 
          error: 'Maximum 10 active webhooks allowed per organization' 
        });
      }
      
      const webhook = new Webhook({
        organizationId: orgId,
        name,
        description,
        url,
        method,
        events,
        auth,
        headers,
        retryPolicy: retryPolicy || {
          maxRetries: 3,
          initialDelay: 1000,
          maxDelay: 60000,
          backoffMultiplier: 2
        },
        createdBy: req.user.id
      });
      
      await webhook.save();
      
      // Send test ping
      setImmediate(() => deliverWebhook(webhook._id, 'ping', { test: true }));
      
      res.status(201).json({
        success: true,
        message: 'Webhook creato',
        webhook: {
          ...webhook.toObject(),
          auth: undefined // Hide auth details
        }
      });
    } catch (error) {
      console.error('Create webhook error:', error);
      res.status(500).json({ error: 'Errore nella creazione webhook' });
    }
  }
);

/**
 * PATCH /api/webhooks/:id
 * Update webhook
 */
router.patch('/webhooks/:id',
  authenticateToken,
  checkPermission('manage_webhooks'),
  webhookLimiter,
  [
    param('id').isMongoId(),
    body('name').optional().trim().isLength({ min: 1, max: 100 }),
    body('url').optional().isURL(),
    body('events').optional().isArray({ min: 1 }),
    body('active').optional().isBoolean()
  ],
  validate,
  async (req, res) => {
    try {
      const webhook = await Webhook.findById(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook non trovato' });
      }
      
      // Check permissions
      if (webhook.organizationId.toString() !== req.user.organizationId && 
          req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      
      // Validate URL if provided
      if (req.body.url && !isValidWebhookUrl(req.body.url)) {
        return res.status(400).json({ 
          error: process.env.NODE_ENV === 'production' 
            ? 'HTTPS required in production' 
            : 'Invalid URL' 
        });
      }
      
      const allowedUpdates = [
        'name', 'description', 'url', 'method', 'events', 
        'auth', 'headers', 'retryPolicy', 'active'
      ];
      
      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          webhook[field] = req.body[field];
        }
      });
      
      webhook.updatedAt = new Date();
      await webhook.save();
      
      res.json({
        success: true,
        message: 'Webhook aggiornato',
        webhook: {
          ...webhook.toObject(),
          auth: undefined
        }
      });
    } catch (error) {
      console.error('Update webhook error:', error);
      res.status(500).json({ error: 'Errore nell\'aggiornamento webhook' });
    }
  }
);

/**
 * DELETE /api/webhooks/:id
 * Delete webhook
 */
router.delete('/webhooks/:id',
  authenticateToken,
  checkPermission('manage_webhooks'),
  async (req, res) => {
    try {
      const webhook = await Webhook.findById(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook non trovato' });
      }
      
      // Check permissions
      if (webhook.organizationId.toString() !== req.user.organizationId && 
          req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      
      await Webhook.findByIdAndDelete(req.params.id);
      
      // Clean up old deliveries
      await WebhookDelivery.deleteMany({ webhookId: req.params.id });
      
      res.json({
        success: true,
        message: 'Webhook eliminato'
      });
    } catch (error) {
      console.error('Delete webhook error:', error);
      res.status(500).json({ error: 'Errore nell\'eliminazione webhook' });
    }
  }
);

/**
 * POST /api/webhooks/:id/test
 * Send test event to webhook
 */
router.post('/webhooks/:id/test',
  authenticateToken,
  checkPermission('manage_webhooks'),
  async (req, res) => {
    try {
      const webhook = await Webhook.findById(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook non trovato' });
      }
      
      if (webhook.organizationId.toString() !== req.user.organizationId && 
          req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      
      // Create test delivery
      const delivery = await deliverWebhook(webhook._id, 'test', {
        message: 'This is a test event',
        timestamp: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Test webhook inviato',
        delivery: {
          id: delivery._id,
          status: delivery.status,
          response: delivery.response
        }
      });
    } catch (error) {
      console.error('Test webhook error:', error);
      res.status(500).json({ error: 'Errore nel test webhook' });
    }
  }
);

// ============================================
// WEBHOOK DELIVERY
// ============================================

/**
 * Core webhook delivery function with retry logic
 */
const deliverWebhook = async (webhookId, event, payload) => {
  try {
    const webhook = await Webhook.findById(webhookId);
    if (!webhook || !webhook.active) {
      console.log(`Webhook ${webhookId} not found or inactive`);
      return null;
    }
    
    // Create delivery record
    const delivery = new WebhookDelivery({
      webhookId,
      organizationId: webhook.organizationId,
      event,
      payload,
      attemptNumber: 1,
      status: 'pending'
    });
    
    await delivery.save();
    
    // Prepare request
    const timestamp = new Date().toISOString();
    const body = {
      event,
      timestamp,
      data: payload
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'KickLoyalty-Webhook/1.0',
      'X-Webhook-ID': webhookId.toString(),
      'X-Event-ID': delivery._id.toString(),
      'X-Event-Type': event,
      'X-Timestamp': timestamp
    };
    
    // Add custom headers
    webhook.headers.forEach(h => {
      if (h.key && h.value) headers[h.key] = h.value;
    });
    
    // Add authentication
    if (webhook.auth.type === 'bearer' && webhook.auth.secret) {
      headers['Authorization'] = `Bearer ${webhook.auth.secret}`;
    } else if (webhook.auth.type === 'basic' && webhook.auth.username) {
      const credentials = Buffer.from(
        `${webhook.auth.username}:${webhook.auth.password || ''}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (webhook.auth.type === 'hmac' && webhook.auth.secret) {
      headers['X-Signature'] = generateSignature(body, webhook.auth.secret);
    }
    
    // Record request
    delivery.request = {
      url: webhook.url,
      method: webhook.method,
      headers: { ...headers },
      body: JSON.stringify(body),
      timestamp: new Date()
    };
    
    // Send request
    const startTime = Date.now();
    try {
      const response = await axios({
        method: webhook.method.toLowerCase(),
        url: webhook.url,
        headers,
        data: body,
        timeout: 30000, // 30 second timeout
        validateStatus: () => true // Don't throw on any status
      });
      
      const duration = Date.now() - startTime;
      
      // Record response
      delivery.response = {
        statusCode: response.status,
        headers: response.headers,
        body: typeof response.data === 'string' 
          ? response.data 
          : JSON.stringify(response.data).substring(0, 10000), // Limit size
        timestamp: new Date(),
        duration
      };
      
      // Check if successful (2xx status)
      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'success';
        
        // Update webhook stats
        webhook.stats.successfulDeliveries++;
        webhook.stats.lastDeliveryAt = new Date();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
      
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error.message;
      
      // Schedule retry if applicable
      if (delivery.attemptNumber < webhook.retryPolicy.maxRetries) {
        delivery.nextRetryAt = calculateNextRetry(
          delivery.attemptNumber + 1,
          webhook.retryPolicy
        );
      }
      
      // Update webhook stats
      webhook.stats.failedDeliveries++;
      webhook.stats.lastFailureAt = new Date();
      webhook.stats.lastError = error.message;
    }
    
    webhook.stats.totalDeliveries++;
    await webhook.save();
    await delivery.save();
    
    return delivery;
    
  } catch (error) {
    console.error('Webhook delivery error:', error);
    return null;
  }
};

/**
 * Retry failed webhook delivery
 */
const retryDelivery = async (deliveryId) => {
  try {
    const delivery = await WebhookDelivery.findById(deliveryId);
    if (!delivery || delivery.status !== 'failed' || !delivery.nextRetryAt) {
      return null;
    }
    
    const webhook = await Webhook.findById(delivery.webhookId);
    if (!webhook || !webhook.active) {
      return null;
    }
    
    // Increment attempt
    delivery.attemptNumber++;
    delivery.status = 'pending';
    delivery.error = null;
    delivery.nextRetryAt = null;
    
    // Prepare request (same as original)
    const timestamp = new Date().toISOString();
    const body = {
      event: delivery.event,
      timestamp,
      data: delivery.payload
    };
    
    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'KickLoyalty-Webhook/1.0',
      'X-Webhook-ID': webhook._id.toString(),
      'X-Event-ID': delivery._id.toString(),
      'X-Event-Type': delivery.event,
      'X-Timestamp': timestamp,
      'X-Retry-Attempt': delivery.attemptNumber.toString()
    };
    
    webhook.headers.forEach(h => {
      if (h.key && h.value) headers[h.key] = h.value;
    });
    
    if (webhook.auth.type === 'bearer' && webhook.auth.secret) {
      headers['Authorization'] = `Bearer ${webhook.auth.secret}`;
    } else if (webhook.auth.type === 'basic' && webhook.auth.username) {
      const credentials = Buffer.from(
        `${webhook.auth.username}:${webhook.auth.password || ''}`
      ).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    } else if (webhook.auth.type === 'hmac' && webhook.auth.secret) {
      headers['X-Signature'] = generateSignature(body, webhook.auth.secret);
    }
    
    delivery.request = {
      url: webhook.url,
      method: webhook.method,
      headers: { ...headers },
      body: JSON.stringify(body),
      timestamp: new Date()
    };
    
    // Send
    const startTime = Date.now();
    try {
      const response = await axios({
        method: webhook.method.toLowerCase(),
        url: webhook.url,
        headers,
        data: body,
        timeout: 30000,
        validateStatus: () => true
      });
      
      const duration = Date.now() - startTime;
      
      delivery.response = {
        statusCode: response.status,
        headers: response.headers,
        body: typeof response.data === 'string' 
          ? response.data 
          : JSON.stringify(response.data).substring(0, 10000),
        timestamp: new Date(),
        duration
      };
      
      if (response.status >= 200 && response.status < 300) {
        delivery.status = 'success';
        webhook.stats.successfulDeliveries++;
        webhook.stats.lastDeliveryAt = new Date();
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
      
    } catch (error) {
      delivery.status = 'failed';
      delivery.error = error.message;
      
      if (delivery.attemptNumber < webhook.retryPolicy.maxRetries) {
        delivery.nextRetryAt = calculateNextRetry(
          delivery.attemptNumber + 1,
          webhook.retryPolicy
        );
      }
      
      webhook.stats.failedDeliveries++;
      webhook.stats.lastFailureAt = new Date();
      webhook.stats.lastError = error.message;
    }
    
    await webhook.save();
    await delivery.save();
    
    return delivery;
    
  } catch (error) {
    console.error('Retry delivery error:', error);
    return null;
  }
};

// ============================================
// DELIVERY MONITORING
// ============================================

/**
 * GET /api/webhooks/:id/deliveries
 * Get delivery history for webhook
 */
router.get('/webhooks/:id/deliveries',
  authenticateToken,
  checkPermission('manage_webhooks'),
  async (req, res) => {
    try {
      const webhook = await Webhook.findById(req.params.id);
      
      if (!webhook) {
        return res.status(404).json({ error: 'Webhook non trovato' });
      }
      
      if (webhook.organizationId.toString() !== req.user.organizationId && 
          req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Accesso negato' });
      }
      
      const { status, event, limit = 50, offset = 0 } = req.query;
      
      let query = { webhookId: req.params.id };
      if (status) query.status = status;
      if (event) query.event = event;
      
      const deliveries = await WebhookDelivery.find(query)
        .sort({ createdAt: -1 })
        .skip(parseInt(offset))
        .limit(parseInt(limit))
        .select('-request.body -response.body'); // Reduce payload size
      
      const total = await WebhookDelivery.countDocuments(query);
      
      res.json({
        success: true,
        deliveries,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });
    } catch (error) {
      console.error('List deliveries error:', error);
      res.status(500).json({ error: 'Errore nel recupero deliveries' });
    }
  }
);

/**
 * POST /api/webhooks/:webhookId/deliveries/:deliveryId/retry
 * Manually retry a failed delivery
 */
router.post('/webhooks/:webhookId/deliveries/:deliveryId/retry',
  authenticateToken,
  checkPermission('manage_webhooks'),
  async (req, res) => {
    try {
      const delivery = await WebhookDelivery.findOne({
        _id: req.params.deliveryId,
        webhookId: req.params.webhookId
      });
      
      if (!delivery) {
        return res.status(404).json({ error: 'Delivery non trovato' });
      }
      
      if (delivery.status !== 'failed') {
        return res.status(400).json({ error: 'Solo delivery fallite possono essere riprovate' });
      }
      
      const retried = await retryDelivery(delivery._id);
      
      res.json({
        success: true,
        message: 'Retry eseguito',
        delivery: {
          id: retried._id,
          status: retried.status,
          attemptNumber: retried.attemptNumber
        }
      });
    } catch (error) {
      console.error('Manual retry error:', error);
      res.status(500).json({ error: 'Errore nel retry' });
    }
  }
);

// ============================================
// EVENT TRIGGERS (to be called from other routes)
// ============================================

/**
 * Trigger webhooks for an event
 * This function should be called when events occur in the system
 */
const triggerWebhooks = async (organizationId, event, payload) => {
  try {
    // Find active webhooks subscribed to this event
    const webhooks = await Webhook.find({
      organizationId,
      active: true,
      events: event
    });
    
    // Deliver to all matching webhooks
    const deliveries = await Promise.all(
      webhooks.map(webhook => deliverWebhook(webhook._id, event, payload))
    );
    
    return deliveries.filter(d => d !== null);
  } catch (error) {
    console.error('Trigger webhooks error:', error);
    return [];
  }
};

/**
 * GET /api/webhooks/events
 * List available event types
 */
router.get('/webhooks/events',
  authenticateToken,
  (req, res) => {
    res.json({
      success: true,
      events: [
        { id: 'user.created', name: 'User Created', description: 'Triggered when a new user is created' },
        { id: 'user.updated', name: 'User Updated', description: 'Triggered when user data is updated' },
        { id: 'user.deleted', name: 'User Deleted', description: 'Triggered when a user is deleted' },
        { id: 'reward.created', name: 'Reward Created', description: 'Triggered when a new reward is created' },
        { id: 'reward.updated', name: 'Reward Updated', description: 'Triggered when a reward is updated' },
        { id: 'reward.deleted', name: 'Reward Deleted', description: 'Triggered when a reward is deleted' },
        { id: 'redemption.requested', name: 'Redemption Requested', description: 'Triggered when a user requests a reward redemption' },
        { id: 'redemption.approved', name: 'Redemption Approved', description: 'Triggered when a redemption is approved' },
        { id: 'redemption.rejected', name: 'Redemption Rejected', description: 'Triggered when a redemption is rejected' },
        { id: 'redemption.fulfilled', name: 'Redemption Fulfilled', description: 'Triggered when a redemption is marked as fulfilled' },
        { id: 'points.assigned', name: 'Points Assigned', description: 'Triggered when points are assigned to a user' },
        { id: 'points.redeemed', name: 'Points Redeemed', description: 'Triggered when points are spent for a redemption' },
        { id: 'achievement.unlocked', name: 'Achievement Unlocked', description: 'Triggered when a user unlocks an achievement' },
        { id: 'member.invited', name: 'Member Invited', description: 'Triggered when a team member is invited' },
        { id: 'member.joined', name: 'Member Joined', description: 'Triggered when a member joins an organization' },
        { id: 'member.left', name: 'Member Left', description: 'Triggered when a member leaves an organization' },
        { id: 'subscription.created', name: 'Subscription Created', description: 'Triggered when a subscription is created' },
        { id: 'subscription.cancelled', name: 'Subscription Cancelled', description: 'Triggered when a subscription is cancelled' },
        { id: 'subscription.updated', name: 'Subscription Updated', description: 'Triggered when a subscription is updated' },
        { id: 'batch.job.completed', name: 'Batch Job Completed', description: 'Triggered when a batch job completes' },
        { id: 'batch.job.failed', name: 'Batch Job Failed', description: 'Triggered when a batch job fails' }
      ]
    });
  }
);

// Export trigger function for use in other routes
module.exports = router;
module.exports.triggerWebhooks = triggerWebhooks;
