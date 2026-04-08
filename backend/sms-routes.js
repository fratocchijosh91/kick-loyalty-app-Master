/**
 * SMS Notifications Routes
 * Manages SMS notifications, templates, and user preferences
 * Integrates with Twilio/AWS-SNS for sending SMS
 */

const express = require('express');
const router = express.Router();
const { 
  SmsNotification, 
  SmsTemplate, 
  SmsSettings, 
  User,
  Organization,
  Redemption,
  Achievement
} = require('./models');
const { 
  authenticateToken, 
  checkPermission, 
  logAuditEvent,
  validatePhoneNumber 
} = require('./middleware');

// ==================== UTILITIES ====================

// Mock Twilio/SMS provider integration
const sendSmsViaTwilio = async (phoneNumber, message) => {
  // In production, use actual Twilio SDK:
  // const twilio = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  // const result = await twilio.messages.create({ body: message, from: process.env.TWILIO_PHONE, to: phoneNumber });
  
  // Mock response
  console.log(`[SMS] Sending to ${phoneNumber}: ${message.substring(0, 50)}...`);
  return { 
    sid: `SM${Date.now()}`, 
    status: 'sent',
    dateCreated: new Date()
  };
};

// Replace template variables
const renderTemplate = (template, variables = {}) => {
  let message = template.messageTemplate;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    message = message.replace(regex, value);
  });
  return message;
};

// Calculate SMS segment count (160 chars per SMS, 153 with unicode)
const calculateSegments = (message) => {
  const hasUnicode = /[^\x00-\x7F]/.test(message);
  const limit = hasUnicode ? 67 : 160;
  return Math.ceil(message.length / limit);
};

// ==================== 1. VERIFY PHONE NUMBER ====================
router.post('/sms/settings/verify-phone', authenticateToken, async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: 'Phone number required' });
    }

    if (!validatePhoneNumber(phoneNumber)) {
      return res.status(400).json({ error: 'Invalid phone number format. Use E.164: +1234567890' });
    }

    // Find organization
    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Update SMS settings
    let smsSettings = await SmsSettings.findOne({ 
      organizationId: org._id, 
      userId: req.user.id 
    });

    if (!smsSettings) {
      smsSettings = new SmsSettings({
        organizationId: org._id,
        userId: req.user.id,
        phoneNumber
      });
    } else {
      smsSettings.phoneNumber = phoneNumber;
    }

    smsSettings.verificationCode = verificationCode;
    smsSettings.isPhoneVerified = false;
    await smsSettings.save();

    // Send verification SMS (mock in development)
    const verifyMessage = `Your Kick Loyalty verification code is: ${verificationCode}. Valid for 10 minutes.`;
    await sendSmsViaTwilio(phoneNumber, verifyMessage);

    // Log audit event
    await logAuditEvent(req, 'SMS_VERIFICATION_INITIATED', 'SmsSettings', smsSettings._id, {
      phoneNumber: phoneNumber.replace(/\d(?=\d{2})/g, '*') // Mask for privacy
    });

    res.status(200).json({
      message: 'Verification code sent',
      expiresIn: '10 minutes'
    });
  } catch (err) {
    console.error('Phone verification error:', err);
    res.status(500).json({ error: 'Failed to initiate phone verification' });
  }
});

// ==================== 2. CONFIRM PHONE VERIFICATION ====================
router.post('/sms/settings/confirm-phone', authenticateToken, async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const { verificationCode } = req.body;

    if (!verificationCode) {
      return res.status(400).json({ error: 'Verification code required' });
    }

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const smsSettings = await SmsSettings.findOne({ 
      organizationId: org._id, 
      userId: req.user.id 
    });

    if (!smsSettings) {
      return res.status(404).json({ error: 'SMS settings not found' });
    }

    if (smsSettings.verificationCode !== verificationCode) {
      return res.status(400).json({ error: 'Invalid verification code' });
    }

    smsSettings.isPhoneVerified = true;
    smsSettings.phoneVerifiedAt = new Date();
    smsSettings.verificationCode = null;
    smsSettings.smsEnabled = true;
    await smsSettings.save();

    // Log audit event
    await logAuditEvent(req, 'SMS_PHONE_VERIFIED', 'SmsSettings', smsSettings._id, {
      phoneNumber: smsSettings.phoneNumber.replace(/\d(?=\d{2})/g, '*')
    });

    res.status(200).json({
      message: 'Phone number verified successfully',
      smsEnabled: true
    });
  } catch (err) {
    console.error('Phone verification confirmation error:', err);
    res.status(500).json({ error: 'Failed to confirm phone verification' });
  }
});

// ==================== 3. GET SMS SETTINGS ====================
router.get('/sms/settings', authenticateToken, async (req, res) => {
  try {
    const { organizationSlug } = req.query;

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const smsSettings = await SmsSettings.findOne({ 
      organizationId: org._id, 
      userId: req.user.id 
    });

    if (!smsSettings) {
      return res.status(404).json({ error: 'SMS settings not found' });
    }

    // Don't expose API keys to frontend
    const sanitized = smsSettings.toObject();
    delete sanitized.smsApiKey;

    res.status(200).json(sanitized);
  } catch (err) {
    console.error('Get SMS settings error:', err);
    res.status(500).json({ error: 'Failed to fetch SMS settings' });
  }
});

// ==================== 4. UPDATE SMS SETTINGS ====================
router.post('/sms/settings', authenticateToken, async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const { 
      notifications, 
      dailyLimit, 
      weeklyLimit 
    } = req.body;

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    let smsSettings = await SmsSettings.findOne({ 
      organizationId: org._id, 
      userId: req.user.id 
    });

    if (!smsSettings) {
      return res.status(404).json({ error: 'SMS settings not found. Verify phone first.' });
    }

    if (notifications) {
      smsSettings.notifications = { ...smsSettings.notifications, ...notifications };
    }
    if (dailyLimit !== undefined) smsSettings.dailyLimit = Math.max(1, dailyLimit);
    if (weeklyLimit !== undefined) smsSettings.weeklyLimit = Math.max(1, weeklyLimit);

    smsSettings.updatedAt = new Date();
    await smsSettings.save();

    // Log audit event
    await logAuditEvent(req, 'SMS_SETTINGS_UPDATED', 'SmsSettings', smsSettings._id, {
      notificationsUpdated: !!notifications,
      dailyLimitSet: dailyLimit !== undefined,
      weeklyLimitSet: weeklyLimit !== undefined
    });

    const sanitized = smsSettings.toObject();
    delete sanitized.smsApiKey;

    res.status(200).json({
      message: 'SMS settings updated',
      data: sanitized
    });
  } catch (err) {
    console.error('Update SMS settings error:', err);
    res.status(500).json({ error: 'Failed to update SMS settings' });
  }
});

// ==================== 5. SEND MANUAL SMS (ADMIN) ====================
router.post('/sms/send-manual', authenticateToken, checkPermission('sms:send'), async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const { userId, message } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: 'userId and message required' });
    }

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Get recipient SMS settings
    const smsSettings = await SmsSettings.findOne({
      organizationId: org._id,
      userId: userId,
      isPhoneVerified: true,
      smsEnabled: true
    });

    if (!smsSettings) {
      return res.status(404).json({ error: 'User has not verified phone or SMS disabled' });
    }

    // Check daily limit
    if (smsSettings.smsSentToday >= smsSettings.dailyLimit) {
      return res.status(429).json({ error: 'Daily SMS limit reached for this user' });
    }

    // Calculate segments
    const segments = calculateSegments(message);

    // Send SMS
    const smsResult = await sendSmsViaTwilio(smsSettings.phoneNumber, message);

    // Create notification record
    const notification = new SmsNotification({
      organizationId: org._id,
      userId: userId,
      viewerPhoneNumber: smsSettings.phoneNumber,
      type: 'custom',
      message: message,
      status: 'sent',
      provider: smsSettings.smsProvider,
      providerMessageId: smsResult.sid,
      sentAt: new Date(),
      segmentCount: segments,
      cost: segments * 0.01 // Mock pricing
    });

    await notification.save();

    // Update SMS settings
    smsSettings.smsSentToday += 1;
    smsSettings.smsSentThisWeek += 1;
    smsSettings.lastSmsAt = new Date();
    await smsSettings.save();

    // Log audit event
    await logAuditEvent(req, 'SMS_SENT_MANUAL', 'SmsNotification', notification._id, {
      recipientUserId: userId,
      messageLength: message.length,
      segments: segments
    });

    res.status(201).json({
      message: 'SMS sent successfully',
      notificationId: notification._id,
      segments: segments,
      cost: `$${(segments * 0.01).toFixed(2)}`
    });
  } catch (err) {
    console.error('Send manual SMS error:', err);
    res.status(500).json({ error: 'Failed to send SMS' });
  }
});

// ==================== 6. LIST SMS NOTIFICATIONS ====================
router.get('/sms/notifications', authenticateToken, async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type; // Filter by type
    const status = req.query.status; // Filter by status

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Build filter
    const filter = { organizationId: org._id };
    
    // Viewers see only their own notifications, admins see all
    if (!req.user.isAdmin) {
      filter.userId = req.user.id;
    }
    
    if (type) filter.type = type;
    if (status) filter.status = status;

    const total = await SmsNotification.countDocuments(filter);
    const notifications = await SmsNotification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('relatedRedemptionId', 'reward status requestedAt')
      .populate('relatedRewardId', 'name icon')
      .populate('relatedAchievementId', 'name')
      .lean();

    res.status(200).json({
      data: notifications,
      total,
      page,
      hasMore: page * limit < total
    });
  } catch (err) {
    console.error('List SMS notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch SMS notifications' });
  }
});

// ==================== 7. LIST SMS TEMPLATES ====================
router.get('/sms/templates', authenticateToken, checkPermission('sms:manage'), async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const type = req.query.type; // Filter by type

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const filter = { organizationId: org._id, active: true };
    if (type) filter.type = type;

    const templates = await SmsTemplate.find(filter)
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username email')
      .lean();

    res.status(200).json({
      data: templates,
      total: templates.length
    });
  } catch (err) {
    console.error('List SMS templates error:', err);
    res.status(500).json({ error: 'Failed to fetch SMS templates' });
  }
});

// ==================== 8. CREATE SMS TEMPLATE ====================
router.post('/sms/templates', authenticateToken, checkPermission('sms:manage'), async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const { 
      name, 
      type, 
      messageTemplate, 
      description, 
      autoSend, 
      sendDelay 
    } = req.body;

    if (!name || !type || !messageTemplate) {
      return res.status(400).json({ error: 'name, type, and messageTemplate required' });
    }

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    // Extract variables from template
    const variableRegex = /{{(\w+)}}/g;
    const variables = [];
    let match;
    while ((match = variableRegex.exec(messageTemplate)) !== null) {
      if (!variables.includes(match[1])) variables.push(match[1]);
    }

    const template = new SmsTemplate({
      organizationId: org._id,
      name,
      type,
      messageTemplate,
      description,
      variables,
      currentLength: messageTemplate.length,
      autoSend: autoSend || false,
      sendDelay: sendDelay || 0,
      createdBy: req.user.id
    });

    await template.save();

    // Log audit event
    await logAuditEvent(req, 'SMS_TEMPLATE_CREATED', 'SmsTemplate', template._id, {
      templateName: name,
      templateType: type,
      autoSend,
      variables: variables.join(', ')
    });

    res.status(201).json({
      message: 'SMS template created',
      data: template
    });
  } catch (err) {
    console.error('Create SMS template error:', err);
    res.status(500).json({ error: 'Failed to create SMS template' });
  }
});

// ==================== 9. UPDATE SMS TEMPLATE ====================
router.patch('/sms/templates/:id', authenticateToken, checkPermission('sms:manage'), async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const { id } = req.params;
    const { name, messageTemplate, description, active, autoSend, sendDelay } = req.body;

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const template = await SmsTemplate.findOne({ _id: id, organizationId: org._id });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    if (name) template.name = name;
    if (messageTemplate) {
      template.messageTemplate = messageTemplate;
      template.currentLength = messageTemplate.length;
      
      // Re-extract variables
      const variableRegex = /{{(\w+)}}/g;
      const variables = [];
      let match;
      while ((match = variableRegex.exec(messageTemplate)) !== null) {
        if (!variables.includes(match[1])) variables.push(match[1]);
      }
      template.variables = variables;
    }
    if (description !== undefined) template.description = description;
    if (active !== undefined) template.active = active;
    if (autoSend !== undefined) template.autoSend = autoSend;
    if (sendDelay !== undefined) template.sendDelay = sendDelay;

    template.updatedAt = new Date();
    await template.save();

    // Log audit event
    await logAuditEvent(req, 'SMS_TEMPLATE_UPDATED', 'SmsTemplate', template._id, {
      updatedFields: Object.keys(req.body)
    });

    res.status(200).json({
      message: 'SMS template updated',
      data: template
    });
  } catch (err) {
    console.error('Update SMS template error:', err);
    res.status(500).json({ error: 'Failed to update SMS template' });
  }
});

// ==================== 10. DELETE SMS TEMPLATE ====================
router.delete('/sms/templates/:id', authenticateToken, checkPermission('sms:manage'), async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const { id } = req.params;

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const template = await SmsTemplate.findOne({ _id: id, organizationId: org._id });
    if (!template) return res.status(404).json({ error: 'Template not found' });

    // Soft delete or hard delete?
    template.active = false;
    template.updatedAt = new Date();
    await template.save();

    // Log audit event
    await logAuditEvent(req, 'SMS_TEMPLATE_DELETED', 'SmsTemplate', template._id, {
      templateName: template.name
    });

    res.status(200).json({ message: 'SMS template deleted' });
  } catch (err) {
    console.error('Delete SMS template error:', err);
    res.status(500).json({ error: 'Failed to delete SMS template' });
  }
});

// ==================== 11. SMS STATISTICS ====================
router.get('/sms/stats', authenticateToken, checkPermission('sms:manage'), async (req, res) => {
  try {
    const { organizationSlug } = req.query;
    const daysBack = parseInt(req.query.daysBack) || 30;

    const org = await Organization.findOne({ slug: organizationSlug });
    if (!org) return res.status(404).json({ error: 'Organization not found' });

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);

    // Aggregate statistics
    const stats = await SmsNotification.aggregate([
      {
        $match: {
          organizationId: org._id,
          createdAt: { $gte: startDate }
        }
      },
      {
        $facet: {
          byStatus: [
            { $group: { _id: '$status', count: { $sum: 1 } } }
          ],
          byType: [
            { $group: { _id: '$type', count: { $sum: 1 } } }
          ],
          totalCost: [
            { $group: { _id: null, total: { $sum: '$cost' } } }
          ],
          totalSegments: [
            { $group: { _id: null, total: { $sum: '$segmentCount' } } }
          ]
        }
      }
    ]);

    // Format response
    const statusSummary = {};
    stats[0].byStatus.forEach(item => {
      statusSummary[item._id] = item.count;
    });

    const typeSummary = {};
    stats[0].byType.forEach(item => {
      typeSummary[item._id] = item.count;
    });

    res.status(200).json({
      timeRange: `Last ${daysBack} days`,
      statuses: statusSummary,
      types: typeSummary,
      totalCost: stats[0].totalCost[0]?.total || 0,
      totalSegments: stats[0].totalSegments[0]?.total || 0,
      averageCostPerMessage: stats[0].totalCost[0]?.total ? 
        (stats[0].totalCost[0].total / (statsbyStatus.reduce((a,b) => a + b.count, 0) || 1)).toFixed(2) : 0
    });
  } catch (err) {
    console.error('Get SMS stats error:', err);
    res.status(500).json({ error: 'Failed to fetch SMS statistics' });
  }
});

module.exports = router;
