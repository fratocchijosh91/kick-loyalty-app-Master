// Two-Factor Authentication Routes - Phase 2 Security
// TOTP (Time-based One-Time Password) implementation for enhanced security

const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { authenticateToken } = require('./middleware');
const { User, TwoFactor } = require('./models');

const DEV_EPHEMERAL_KEY = process.env.NODE_ENV === 'production' ? null : crypto.randomBytes(32);

const deriveKey = () => {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) return crypto.createHash('sha256').update(String(raw), 'utf8').digest();
  if (DEV_EPHEMERAL_KEY) return DEV_EPHEMERAL_KEY;
  throw new Error('ENCRYPTION_KEY is required in production for 2FA');
};

// AES-256-CBC with random IV per value.
const encryptSecret = (secret) => {
  const key = deriveKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return `v2:${iv.toString('hex')}:${enc.toString('hex')}`;
};

const decryptSecret = (encryptedSecret) => {
  if (typeof encryptedSecret !== 'string') throw new Error('invalid_cipher');
  if (encryptedSecret.startsWith('v2:')) {
    const parts = encryptedSecret.split(':');
    if (parts.length !== 3) throw new Error('invalid_cipher');
    const key = deriveKey();
    const iv = Buffer.from(parts[1], 'hex');
    const data = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  }
  throw new Error('legacy_cipher_not_supported');
};

/**
 * POST /api/2fa/setup
 * Generate 2FA secret and QR code for setup
 * Returns: secret, QR code, backup codes
 */
router.post('/2fa/setup', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if 2FA already enabled
    const existing = await TwoFactor.findOne({ userId });
    if (existing && existing.isEnabled) {
      return res.status(400).json({ error: '2FA already enabled for this user' });
    }
    
    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `Kick Loyalty (${req.user.email || req.user.username})`,
      issuer: 'Kick Loyalty',
      length: 32
    });
    
    // Generate QR code
    const qrCode = await QRCode.toDataURL(secret.otpauth_url);
    
    // Generate backup codes (10 codes)
    const backupCodes = Array.from({ length: 10 }, () => ({
      code: encryptSecret(crypto.randomBytes(4).toString('hex').toUpperCase()),
      used: false
    }));
    
    // Store temporarily (not enabled yet)
    let twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord) {
      twoFactorRecord = new TwoFactor({
        userId,
        organizationId: req.user.organizationId,
        secret: encryptSecret(secret.base32),
        backupCodes,
        isEnabled: false
      });
    } else {
      twoFactorRecord.secret = encryptSecret(secret.base32);
      twoFactorRecord.backupCodes = backupCodes;
      twoFactorRecord.isEnabled = false;
    }
    
    await twoFactorRecord.save();
    
    res.json({
      qrCode,
      secret: secret.base32,
      backupCodes: backupCodes.map(bc => decryptSecret(bc.code)),
      message: 'Scan QR code in authenticator app or enter secret manually. Then verify with a code.'
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to setup 2FA' });
  }
});

/**
 * POST /api/2fa/verify
 * Verify TOTP code to enable 2FA
 * Body: { code }
 */
router.post('/2fa/verify', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;
    
    if (!code || code.length < 6) {
      return res.status(400).json({ error: 'Invalid code format' });
    }
    
    const twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord || !twoFactorRecord.secret) {
      return res.status(400).json({ error: '2FA not setup. Call /setup first.' });
    }
    
    // Decrypt secret
    const decryptedSecret = decryptSecret(twoFactorRecord.secret);
    
    // Verify code with 30-second window (current, +1, -1)
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code.toString(),
      window: 2 // Allow ±30 seconds
    });
    
    if (!isValid) {
      twoFactorRecord.failedAttempts += 1;
      
      // Lock after 5 failed attempts for 5 minutes
      if (twoFactorRecord.failedAttempts >= 5) {
        twoFactorRecord.lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
      }
      
      await twoFactorRecord.save();
      return res.status(401).json({ error: 'Invalid code' });
    }
    
    // Code is valid - mark as verified and enabled
    twoFactorRecord.isEnabled = true;
    twoFactorRecord.verifiedAt = new Date();
    twoFactorRecord.lastVerified = new Date();
    twoFactorRecord.failedAttempts = 0;
    twoFactorRecord.lockedUntil = null;
    
    await twoFactorRecord.save();
    
    res.json({
      message: '2FA enabled successfully',
      backupCodes: twoFactorRecord.backupCodes.map(bc => ({
        code: decryptSecret(bc.code),
        used: bc.used
      }))
    });
  } catch (error) {
    console.error('2FA verify error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

/**
 * GET /api/2fa/status
 * Get current 2FA status
 */
router.get('/2fa/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord) {
      return res.json({
        enabled: false,
        setup: false,
        message: '2FA not configured'
      });
    }
    
    const unusedBackupCodes = twoFactorRecord.backupCodes.filter(bc => !bc.used).length;
    
    res.json({
      enabled: twoFactorRecord.isEnabled,
      setup: !!twoFactorRecord.secret,
      verifiedAt: twoFactorRecord.verifiedAt,
      lastVerified: twoFactorRecord.lastVerified,
      backupCodesRemaining: unusedBackupCodes,
      trustedDevices: twoFactorRecord.trustedDevices.length,
      createdAt: twoFactorRecord.createdAt
    });
  } catch (error) {
    console.error('2FA status error:', error);
    res.status(500).json({ error: 'Failed to get 2FA status' });
  }
});

/**
 * POST /api/2fa/disable
 * Disable 2FA for user
 * Body: { password } - Require password confirmation
 */
router.post('/2fa/disable', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;
    
    const twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord || !twoFactorRecord.isEnabled) {
      return res.status(400).json({ error: '2FA not enabled' });
    }
    
    // Require valid TOTP code to disable (security measure)
    if (code) {
      const decryptedSecret = decryptSecret(twoFactorRecord.secret);
      const isValid = speakeasy.totp.verify({
        secret: decryptedSecret,
        encoding: 'base32',
        token: code.toString(),
        window: 2
      });
      
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid code. Cannot disable 2FA without valid code.' });
      }
    }
    
    // Disable 2FA
    twoFactorRecord.isEnabled = false;
    twoFactorRecord.secret = null;
    twoFactorRecord.backupCodes = [];
    twoFactorRecord.trustedDevices = [];
    twoFactorRecord.failedAttempts = 0;
    
    await twoFactorRecord.save();
    
    res.json({ message: '2FA disabled successfully' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ error: 'Failed to disable 2FA' });
  }
});

/**
 * GET /api/2fa/backup-codes
 * Get unused backup codes (regenerate and download)
 */
router.get('/2fa/backup-codes', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord || !twoFactorRecord.isEnabled) {
      return res.status(400).json({ error: '2FA not enabled' });
    }
    
    const unusedCodes = twoFactorRecord.backupCodes
      .filter(bc => !bc.used)
      .map(bc => decryptSecret(bc.code));
    
    // Format for download
    const csv = unusedCodes.map((code, idx) => `${idx + 1},${code}`).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="backup-codes.csv"');
    res.send(`Index,Code\n${csv}`);
  } catch (error) {
    console.error('Backup codes error:', error);
    res.status(500).json({ error: 'Failed to fetch backup codes' });
  }
});

/**
 * POST /api/2fa/verify-code
 * Verify either TOTP code or backup code during login
 * Used in login flow after username/password
 * Body: { code, deviceName, trustDevice }
 */
router.post('/2fa/verify-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, deviceName, trustDevice } = req.body;
    
    const twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord || !twoFactorRecord.isEnabled) {
      return res.status(400).json({ error: '2FA not enabled' });
    }
    
    // Check if locked
    if (twoFactorRecord.lockedUntil && new Date() < twoFactorRecord.lockedUntil) {
      const timeRemaining = Math.ceil((twoFactorRecord.lockedUntil - new Date()) / 1000);
      return res.status(429).json({ 
        error: `Too many failed attempts. Try again in ${timeRemaining} seconds.` 
      });
    }
    
    let isValid = false;
    let isBackupCode = false;
    
    // Try TOTP verification first
    const decryptedSecret = decryptSecret(twoFactorRecord.secret);
    isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code.toString(),
      window: 2
    });
    
    // If TOTP fails, try backup code
    if (!isValid) {
      const backupCode = twoFactorRecord.backupCodes.find(bc => 
        !bc.used && decryptSecret(bc.code) === code.toString()
      );
      
      if (backupCode) {
        backupCode.used = true;
        backupCode.usedAt = new Date();
        isValid = true;
        isBackupCode = true;
      }
    }
    
    if (!isValid) {
      twoFactorRecord.failedAttempts += 1;
      
      if (twoFactorRecord.failedAttempts >= 5) {
        twoFactorRecord.lockedUntil = new Date(Date.now() + 5 * 60 * 1000);
      }
      
      await twoFactorRecord.save();
      return res.status(401).json({ error: 'Invalid code' });
    }
    
    // Valid code - update record
    twoFactorRecord.lastVerified = new Date();
    twoFactorRecord.failedAttempts = 0;
    twoFactorRecord.lockedUntil = null;
    
    // Add trusted device if requested
    if (trustDevice && deviceName) {
      const deviceId = uuidv4();
      twoFactorRecord.trustedDevices.push({
        deviceId,
        deviceName,
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        addedAt: new Date(),
        lastUsedAt: new Date()
      });
    }
    
    await twoFactorRecord.save();
    
    const remainingBackupCodes = twoFactorRecord.backupCodes.filter(bc => !bc.used).length;
    
    res.json({
      success: true,
      message: isBackupCode ? 'Backup code used successfully' : 'Code verified',
      usedBackupCode: isBackupCode,
      remainingBackupCodes,
      deviceAdded: !!(trustDevice && deviceName),
      deviceId: trustDevice ? twoFactorRecord.trustedDevices[twoFactorRecord.trustedDevices.length - 1]?.deviceId : null
    });
  } catch (error) {
    console.error('Code verification error:', error);
    res.status(500).json({ error: 'Failed to verify code' });
  }
});

/**
 * POST /api/2fa/trust-device
 * Mark device as trusted (skip 2FA on this device)
 * Body: { deviceName, code } - Verify with code first
 */
router.post('/2fa/trust-device', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceName, code } = req.body;
    
    const twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord || !twoFactorRecord.isEnabled) {
      return res.status(400).json({ error: '2FA not enabled' });
    }
    
    // Verify code
    const decryptedSecret = decryptSecret(twoFactorRecord.secret);
    const isValid = speakeasy.totp.verify({
      secret: decryptedSecret,
      encoding: 'base32',
      token: code.toString(),
      window: 2
    });
    
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid code' });
    }
    
    // Add trusted device
    const deviceId = uuidv4();
    twoFactorRecord.trustedDevices.push({
      deviceId,
      deviceName: deviceName || 'Unknown Device',
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
      addedAt: new Date(),
      lastUsedAt: new Date()
    });
    
    await twoFactorRecord.save();
    
    res.json({
      message: 'Device trusted successfully',
      deviceId,
      totalTrustedDevices: twoFactorRecord.trustedDevices.length
    });
  } catch (error) {
    console.error('Trust device error:', error);
    res.status(500).json({ error: 'Failed to trust device' });
  }
});

/**
 * GET /api/2fa/trusted-devices
 * List all trusted devices
 */
router.get('/2fa/trusted-devices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord) {
      return res.json({ devices: [] });
    }
    
    res.json({
      devices: twoFactorRecord.trustedDevices.map(device => ({
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        ipAddress: device.ipAddress,
        userAgent: device.userAgent,
        addedAt: device.addedAt,
        lastUsedAt: device.lastUsedAt
      }))
    });
  } catch (error) {
    console.error('Trusted devices error:', error);
    res.status(500).json({ error: 'Failed to fetch trusted devices' });
  }
});

/**
 * DELETE /api/2fa/trusted-devices/:deviceId
 * Remove trusted device
 */
router.delete('/2fa/trusted-devices/:deviceId', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { deviceId } = req.params;
    
    const twoFactorRecord = await TwoFactor.findOne({ userId });
    
    if (!twoFactorRecord) {
      return res.status(404).json({ error: 'No trusted devices found' });
    }
    
    twoFactorRecord.trustedDevices = twoFactorRecord.trustedDevices.filter(d => d.deviceId !== deviceId);
    await twoFactorRecord.save();
    
    res.json({ message: 'Device removed from trusted list' });
  } catch (error) {
    console.error('Remove device error:', error);
    res.status(500).json({ error: 'Failed to remove device' });
  }
});

module.exports = router;
