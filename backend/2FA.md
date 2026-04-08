# Two-Factor Authentication (2FA)

Complete guide to the Two-Factor Authentication system for the Kick Loyalty App.

## Overview

Two-Factor Authentication (2FA) adds an extra layer of security to user accounts using Time-based One-Time Passwords (TOTP). This document covers the implementation, API endpoints, configuration, and best practices.

## Table of Contents

1. [Features](#features)
2. [Architecture](#architecture)
3. [API Endpoints](#api-endpoints)
4. [Setup Flow](#setup-flow)
5. [Verification Flow](#verification-flow)
6. [Backup Codes](#backup-codes)
7. [Trusted Devices](#trusted-devices)
8. [Security Considerations](#security-considerations)
9. [Configuration](#configuration)
10. [Troubleshooting](#troubleshooting)

## Features

### Core 2FA Capabilities

- **TOTP-Based** - Time-based One-Time Passwords using RFC 6238 standard
- **Authenticator Apps** - Compatible with Google Authenticator, Microsoft Authenticator, Authy, and others
- **Backup Codes** - 10 offline recovery codes (encrypted, single-use)
- **Trusted Devices** - Skip 2FA on trusted computers for 30 days
- **Rate Limiting** - Protection against brute force attacks (5 attempts → 5 min lockout)
- **Device Tracking** - IP address and user agent logging for security audit
- **Account Lockout** - Automatic temporary lockout after multiple failed attempts

### User Experience

- Simple QR code setup with manual secret entry fallback
- Mobile-friendly verification interface
- Quick recovery with backup codes
- Device fingerprinting (name, OS, IP address)
- Secure backup code download (CSV format)

## Architecture

### Database Schema

```javascript
TwoFactorSchema {
  userId: ObjectId,           // User reference (unique)
  organizationId: ObjectId,   // Organization reference
  secret: String,             // Encrypted TOTP secret (base32)
  backupCodes: [{
    code: String,             // Encrypted backup code
    usedAt: Date,             // null if unused
  }],
  isEnabled: Boolean,         // 2FA active status
  verifiedAt: Date,           // When 2FA was enabled/verified
  lastVerified: Date,         // Last successful TOTP verification
  failedAttempts: Number,     // Failed verification attempts (resets after success)
  lockedUntil: Date,          // Account locked until this date
  trustedDevices: [{
    deviceId: String,         // UUID v4
    deviceName: String,       // User-provided name
    userAgent: String,        // Browser/device info
    ipAddress: String,        // IP address
    trustedAt: Date,          // When device was trusted
    trustedUntil: Date,       // Expiry date (30 days from trust)
    lastUsed: Date,           // Last login with this device
  }],
  createdAt: Date,
  updatedAt: Date
}
```

### Encryption

**Algorithm:** AES-256-CBC
**Key Source:** `process.env.ENCRYPTION_KEY` (must be 32-byte hex string)
**Implementation:**
- Secrets encrypted before storage
- Backup codes encrypted individually
- Decryption happens in-memory for verification only

### Dependencies

```json
{
  "speakeasy": "^2.0.0",  // TOTP generation/verification
  "qrcode": "^1.5.3",     // QR code generation
  "uuid": "^9.0.1"        // Device ID generation
}
```

## API Endpoints

All endpoints require `Authorization: Bearer {token}` header unless otherwise noted.

### 1. POST /api/2fa/setup

**Purpose:** Generate TOTP secret and QR code for 2FA setup.

**Request:**
```bash
curl -X POST http://localhost:5000/api/2fa/setup \
  -H "Authorization: Bearer {token}"
```

**Response (200 OK):**
```json
{
  "success": true,
  "qrCode": "data:image/png;base64,...",
  "secret": "JBSWY3DPEBLW64TMMQ======",
  "backupCodes": [
    "ABC123DEF456",
    "GHI789JKL012",
    "MNO345PQR678",
    "STU901VWX234",
    "YZA567BCD890",
    "EFG123HIJ456",
    "KLM789NOP012",
    "QRS345TUV678",
    "WXY901ZAB234",
    "CDE567FGH890"
  ]
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "2FA already enabled for this user"
}
```

**Notes:**
- Returns an uncompleted setup (secret encrypted but `isEnabled: false`)
- Backup codes are temporary until verified
- Secret is base32 encoded for easy manual entry

### 2. POST /api/2fa/verify

**Purpose:** Verify TOTP code and enable 2FA on user account.

**Request:**
```bash
curl -X POST http://localhost:5000/api/2fa/verify \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "2FA enabled successfully",
  "backupCodes": [
    { "code": "ABC123DEF456" },
    { "code": "GHI789JKL012" },
    ...
  ]
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Invalid TOTP code",
  "remainingAttempts": 4
}
```

**Rate Limiting:**
- 5 failed attempts → account locked for 5 minutes
- Counter resets on successful verification
- Lockout status returned: `"lockedUntil": "2024-01-15T10:30:00Z"`

### 3. GET /api/2fa/status

**Purpose:** Check 2FA status and statistics for authenticated user.

**Request:**
```bash
curl http://localhost:5000/api/2fa/status \
  -H "Authorization: Bearer {token}"
```

**Response (200 OK):**
```json
{
  "enabled": true,
  "isSetupComplete": true,
  "verifiedAt": "2024-01-01T12:00:00Z",
  "backupCodesRemaining": 8,
  "trustedDevices": 2,
  "lastVerified": "2024-01-15T09:45:00Z"
}
```

**If 2FA not enabled:**
```json
{
  "enabled": false,
  "isSetupComplete": false,
  "backupCodesRemaining": 0,
  "trustedDevices": 0
}
```

### 4. POST /api/2fa/disable

**Purpose:** Disable 2FA and remove all related data (requires verification code).

**Request:**
```bash
curl -X POST http://localhost:5000/api/2fa/disable \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "2FA disabled successfully"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "2FA is not enabled for this user"
}
```

**Notes:**
- Requires valid TOTP code for confirmation
- Deletes secret, backup codes, and all trusted devices
- User must re-enable if they want 2FA again

### 5. GET /api/2fa/backup-codes

**Purpose:** Download unused 2FA backup codes as CSV file.

**Request:**
```bash
curl http://localhost:5000/api/2fa/backup-codes \
  -H "Authorization: Bearer {token}" \
  -o backup-codes.csv
```

**Response (200 OK):**
```
Content-Type: text/csv
Content-Disposition: attachment; filename="backup-codes.csv"

1,ABC123DEF456
2,GHI789JKL012
3,MNO345PQR678
4,STU901VWX234
5,YZA567BCD890
6,EFG123HIJ456
7,KLM789NOP012
8,QRS345TUV678
9,WXY901ZAB234
10,CDE567FGH890
```

**Error Response (400 Bad Request):**
```json
{
  "error": "2FA is not enabled for this user"
}
```

**Notes:**
- Returns only unused codes
- Format: index,code (one per line)
- Can be imported into password managers

### 6. POST /api/2fa/verify-code

**Purpose:** Verify TOTP or backup code during login (most critical endpoint).

**Request:**
```bash
curl -X POST http://localhost:5000/api/2fa/verify-code \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456",
    "deviceName": "Work Laptop",
    "trustDevice": true
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "usedBackupCode": false,
  "remainingCodes": 8,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**If backup code used:**
```json
{
  "success": true,
  "usedBackupCode": true,
  "remainingCodes": 7,
  "message": "Backup code used - you have 7 codes remaining"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Invalid code",
  "lockedUntil": "2024-01-15T10:30:00Z",
  "remainingAttempts": 3
}
```

**Request Parameters:**
- `code` (required) - 6-digit TOTP code OR backup code
- `deviceName` (optional) - Name for this device
- `trustDevice` (optional) - Boolean, default false

**Notes:**
- Verifies TOTP first, then tries backup codes
- Can only verify against encrypted secret stored in 2FA model
- Does NOT verify JWT - used after initial password verification
- Each backup code can only be used once
- Rate limiting: 5 failures → 5 minute lockout

### 7. POST /api/2fa/trust-device

**Purpose:** Mark current device as trusted (skip 2FA for 30 days).

**Request:**
```bash
curl -X POST http://localhost:5000/api/2fa/trust-device \
  -H "Content-Type: application/json" \
  -d '{
    "code": "123456",
    "deviceName": "MacBook Pro"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "deviceId": "550e8400-e29b-41d4-a716-446655440000",
  "trustedUntil": "2024-02-14T10:00:00Z"
}
```

**Error Response (400 Bad Request):**
```json
{
  "error": "Invalid device name"
}
```

**Notes:**
- Must verify TOTP code first
- Generates UUID v4 for device ID
- Client should store deviceId in localStorage
- On subsequent logins, check deviceId to skip 2FA
- 30-day trust duration (hard-coded)

### 8. GET /api/2fa/trusted-devices

**Purpose:** List all trusted devices for current user.

**Request:**
```bash
curl http://localhost:5000/api/2fa/trusted-devices \
  -H "Authorization: Bearer {token}"
```

**Response (200 OK):**
```json
{
  "devices": [
    {
      "deviceId": "550e8400-e29b-41d4-a716-446655440000",
      "deviceName": "Work MacBook Pro",
      "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
      "ipAddress": "192.168.1.100",
      "trustedAt": "2024-01-15T10:00:00Z",
      "trustedUntil": "2024-02-14T10:00:00Z",
      "lastUsed": "2024-01-15T14:30:00Z"
    },
    {
      "deviceId": "660f9511-f40c-52e5-b827-557766551111",
      "deviceName": "iPhone 15",
      "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2_1)...",
      "ipAddress": "203.0.113.45",
      "trustedAt": "2024-01-10T09:00:00Z",
      "trustedUntil": "2024-02-09T09:00:00Z",
      "lastUsed": "2024-01-14T19:20:00Z"
    }
  ]
}
```

### 9. DELETE /api/2fa/trusted-devices/:deviceId

**Purpose:** Remove a trusted device from the list.

**Request:**
```bash
curl -X DELETE http://localhost:5000/api/2fa/trusted-devices/550e8400-e29b-41d4-a716-446655440000 \
  -H "Authorization: Bearer {token}"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Device removed successfully"
}
```

**Error Response (404 Not Found):**
```json
{
  "error": "Device not found"
}
```

## Setup Flow

### Complete User Journey

```
1. User clicks "Enable 2FA" in Settings
   ↓
2. Backend: POST /api/2fa/setup
   - Generate speakeasy TOTP secret
   - Generate 10 backup codes
   - Encrypt & store (but leave isEnabled: false)
   - Return QR code (DataURL) + secret + backup codes
   ↓
3. User scans QR code with authenticator app
   (Or manually enters secret)
   ↓
4. Frontend: Prompt for 6-digit code from app
   ↓
5. User enters code, submit to Backend: POST /api/2fa/verify
   ↓
6. Backend verifies with speakeasy:
   - speakeasy.totp.verify({secret, encoding: 'base32', code})
   - Checks ±2 time window (±60 seconds total)
   - Updates: isEnabled: true, verifiedAt: now()
   ↓
7. Backend returns backup codes to user
   ↓
8. User downloads & stores codes safely
   ↓
9. FLOW COMPLETE - 2FA now active
```

### Code Example

```javascript
// Frontend
const setupResponse = await fetch('/api/2fa/setup', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
const { qrCode, secret, backupCodes } = await setupResponse.json();

// Show QR code image
// Show secret for manual entry
// Show backup codes to save

// After user scans QR and gets code...
const verifyResponse = await fetch('/api/2fa/verify', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ code: '123456' })
});
const verifyData = await verifyResponse.json();
// Download backup codes from verifyData.backupCodes
```

## Verification Flow

### Login with 2FA

```
1. User enters email + password
   ↓
2. Backend verifies password (existing auth)
   ↓
3. Backend checks: SELECT * FROM TwoFactor WHERE userId = ?
   ↓
4. If found AND isEnabled === true:
   - Check if device is trusted: do they have matching deviceId?
   - If trusted device: Skip 2FA, proceed to step 9
   - Else: Require 2FA code
   ↓
5. Frontend: Show 2FA code input modal
   (TwoFactorVerify component)
   ↓
6. User enters 6-digit TOTP code OR backup code
   ↓
7. Frontend: POST /api/2fa/verify-code
   {code, deviceName?, trustDevice?}
   ↓
8. Backend verification:
   a. Check if account is locked (failedAttempts >= 5)
   b. If locked, return error with lockedUntil time
   c. Try speakeasy.totp.verify() with TOTP code
   d. If fails, try backup code (decrypt & compare)
   e. If backup code used: mark as usedAt, decrement counter
   f. On success: Update lastVerified, reset failedAttempts
   ↓
9. If trustDevice is true:
   - POST /api/2fa/trust-device to store device
   - Return deviceId to client
   - Client stores in localStorage
   ↓
10. Backend returns JWT token for login
    ↓
11. Login complete
```

### Device Trust Check (on subsequent logins)

```
// Client has stored deviceId from previous trusted login
const deviceId = localStorage.getItem('deviceId');

// After password verification:
if (deviceId) {
  // Check if device is still trusted
  const res = await fetch('/api/2fa/verify-code', {
    method: 'POST',
    body: JSON.stringify({ 
      code: null,  // Don't need code if device trusted
      deviceId: deviceId
    })
  });
  if (res.ok) {
    // Skip 2FA, proceed to login
  }
}
```

## Backup Codes

### Security Model

- **Generated:** 10 codes at setup time, each ~10 characters alphanumeric
- **Encrypted:** AES-256-CBC before storage
- **Single-Use:** Each code can only be used once (tracked with usedAt field)
- **Recovery:** User downloads as CSV for secure storage (password manager, etc.)
- **Fallback:** If user loses phone, can login with backup code

### Code Format

```
ABC123DEF456
GHI789JKL012
MNO345PQR678
... (10 codes total)
```

### Backup Code Lifecycle

```
1. Setup: 10 codes generated (random, encrypted)
   Status: unused (usedAt = null)
   ↓
2. User needs: Can download at /api/2fa/backup-codes (CSV)
   ↓
3. User loses phone: Use one code during login with /api/2fa/verify-code
   Status: used (usedAt = now())
   ↓
4. Subsequent logins: Only 9 codes remaining
   ↓
5. All used: User should disable & re-enable 2FA to get new codes
   (Or request admin reset)
```

### Download Format (CSV)

```csv
1,ABC123DEF456
2,GHI789JKL012
3,MNO345PQR678
4,STU901VWX234
5,YZA567BCD890
6,EFG123HIJ456
7,KLM789NOP012
8,QRS345TUV678
9,WXY901ZAB234
10,CDE567FGH890
```

## Trusted Devices

### Feature Purpose

- **Convenience:** Users don't need to enter 2FA code on every login from trusted devices
- **Security:** Device must pass verification once before trusting
- **Automatic Expiry:** Trust expires after 30 days (configurable)
- **Revocation:** Users can remove device trust at any time

### Device Identification

```javascript
Device = {
  deviceId: UUID v4,           // Unique per device
  deviceName: "Work Laptop",   // User-provided friendly name
  userAgent: "...",            // Browser info
  ipAddress: "192.168.1.100",  // IP address
  trustedAt: Date,             // When user trusted it
  trustedUntil: Date,          // 30 days after trustedAt
  lastUsed: Date               // Updated on each successful login
}
```

### Trust Lifecycle

```
1. User logs in with 2FA code + checks "Trust this device" box
   ↓
2. Device name input (or auto-generated)
   ↓
3. POST /api/2fa/trust-device with verified TOTP code
   ↓
4. Backend:
   - Verify code is correct
   - Generate UUID v4 as deviceId
   - Store device info (name, userAgent, IP, timestamps)
   - Return deviceId to client
   ↓
5. Client: Store deviceId in localStorage
   ↓
6. Next login: Client submits deviceId with password
   ↓
7. Backend: If deviceId is valid + not expired:
   - Skip 2FA requirement
   - Update lastUsed timestamp
   - Return JWT token
   ↓
8. After 30 days: Device trust expires
   - Next login will require 2FA again
   - User can re-trust device for another 30 days
```

### Client Implementation

```javascript
// On login page
const deviceId = localStorage.getItem('2fa_device_id');

// After password verification
const twoFaResponse = await fetch('/api/2fa/verify-code', {
  method: 'POST',
  body: JSON.stringify({
    code: userEnteredCode,
    deviceName: deviceName,  // Only if trustDevice checked
    trustDevice: trustDevice,
    deviceId: deviceId  // For checking if still trusted
  })
});

if (twoFaResponse.ok) {
  const data = await twoFaResponse.json();
  if (data.deviceId) {
    localStorage.setItem('2fa_device_id', data.deviceId);
  }
}
```

## Security Considerations

### Encryption at Rest

```javascript
// AES-256-CBC encryption/decryption
const crypto = require('crypto');

function encryptSecret(secret) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32 bytes
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(secret, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptSecret(encrypted) {
  const [iv, secret] = encrypted.split(':');
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'hex'));
  let decrypted = decipher.update(secret, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}
```

### TOTP Verification (RFC 6238)

```javascript
// speakeasy TOTP verification with time window
const speakeasy = require('speakeasy');

const verified = speakeasy.totp.verify({
  secret: decryptedSecret,
  encoding: 'base32',
  token: userProvidedCode,
  window: 2  // ±2 windows = ±60 seconds
});
```

### Rate Limiting Strategy

```
Failed Login Attempts:
- Attempt 1: Fails
- Attempt 2: Fails
- Attempt 3: Fails
- Attempt 4: Fails
- Attempt 5: Fails → LOCKED for 5 minutes
  - Set lockedUntil = now() + 5 minutes
  - Return error message
  - Block further attempts until lockedUntil

On Successful Verification:
  - Reset failedAttempts to 0
  - Clear lockedUntil
```

### Backup Code Protection

- Each code is encrypted separately
- Decryption happens only in-memory
- Used codes marked with timestamp
- Never return all codes in unencrypted form
- Download function returns plaintext (user responsibility)

### Device Trust Risks & Mitigations

**Risk:** Trusted device is stolen
**Mitigation:** User can revoke from settings, expires after 30 days

**Risk:** IP spoofing to use existing deviceId
**Mitigation:** Store user agent + IP, consider re-verification if major device change

**Risk:** Attacker gains access to localStorage
**Mitigation:** 30-day expiry limits exposure, backend verifies device during login

### Audit Logging Recommendations

Consider logging:
```
- 2FA setup/enable events
- 2FA disable events
- Successful TOTP verifications
- Failed verification attempts (rate limit breaches)
- Backup code usage
- Device trust events
- Trusted device revocation
```

## Configuration

### Environment Variables

```bash
# Required for 2FA encryption
ENCRYPTION_KEY=<32-byte hex string>

# Example: Generate with OpenSSL
# openssl rand -hex 32
ENCRYPTION_KEY=a7f6c8e5d2a1b9f4c6e3d1a8f9b2c5e7a4d6c8f1e2a3b4c5d6e7f8a9b0c1d2

# Optional tuning parameters (in 2fa-routes.js)
MAX_FAILED_ATTEMPTS=5  # Defaults to 5
LOCKOUT_DURATION_MS=300000  # Defaults to 5 minutes
TOTP_WINDOW=2  # Defaults to ±2 (±60 seconds)
DEVICE_TRUST_DAYS=30  # Defaults to 30 days
```

### Database Indexes

```javascript
// In models.js
twoFactorSchema.index({ userId: 1, isEnabled: 1 });
twoFactorSchema.index({ organizationId: 1, isEnabled: 1 });
```

## Troubleshooting

### Issue: "2FA already enabled for this user"

**Cause:** User already has 2FA setup
**Solution:**
```javascript
// Check 2FA status first
const status = await fetch('/api/2fa/status', {
  headers: { Authorization: `Bearer ${token}` }
});
if (status.enabled) {
  // Show 2FA management options, not setup
}
```

### Issue: TOTP code always fails

**Cause 1:** Time synchronization between server and user's phone
**Solution:** Ensure server and client are using NTP time sync

**Cause 2:** Secret was encrypted incorrectly
**Solution:** Verify ENCRYPTION_KEY is 32 bytes hex

**Cause 3:** Wrong secret shown to user
**Solution:** Use QR code (preferred), or verify base32 secret manually

### Issue: User locked out (5 failed attempts)

**Cause:** Too many incorrect codes entered
**Solution:**
```bash
# Wait 5 minutes for automatic unlock, OR
# Admin: Reset manually in MongoDB
db.twofactors.updateOne(
  { userId: ObjectId("...") },
  {
    $set: { failedAttempts: 0, lockedUntil: null }
  }
);
```

### Issue: Backup code used but counter didn't decrease

**Cause:** Race condition or code already used
**Solution:**
```javascript
// Check backup code status
const status = await fetch('/api/2fa/status', {
  headers: { Authorization: `Bearer ${token}` }
});
console.log(status.backupCodesRemaining);
```

### Issue: Device not recognized as trusted on next login

**Cause 1:** localStorage was cleared or deviceId lost
**Solution:** User must re-verify with 2FA code

**Cause 2:** Device trust expired (30+ days)
**Solution:** Expires automatically, user can re-trust

**Cause 3:** User changed browsers/incognito mode
**Solution:** deviceId stored in localStorage, must be same browser

### Issue: QR code not scannable

**Cause:** Image not rendering properly
**Solution:**
```javascript
// Verify QR code format
const qrCode = data.qrCode; // Should be data:image/png;base64,...
// Test with QR scanner app directly
```

## Common Queries

### Get all users with 2FA enabled

```javascript
db.twofactors.find({ isEnabled: true }).count()
```

### Find users with expired trusted devices

```javascript
db.twofactors.find({
  "trustedDevices.trustedUntil": { $lt: new Date() }
})
```

### Reset user's 2FA

```javascript
db.twofactors.deleteOne({ userId: ObjectId("...") })
// User can re-enable by going through setup again
```

### List users who never used backup codes

```javascript
db.twofactors.find({
  isEnabled: true,
  "backupCodes": { $not: { $elemMatch: { usedAt: { $ne: null } } } }
}).count()
```

## Performance Considerations

### Database Queries

- Always index on (userId, isEnabled) for quick 2FA status checks
- Use organizationId index for multi-tenant lookup
- Trusted devices array (max 10 devices per user) - keep array small

### API Performance

- Setup endpoint: O(n) for secret generation + QR code creation (~200ms)
- Verify endpoint: O(1) for speakeasy verification (~5ms)
- Trusted devices: O(1) array lookup on login

### Caching Opportunities

- Cache 2FA status for 5 minutes post-login (reduce DB hits on subsequent API calls)
- Pre-verify device trust during password verification (avoid extra call)

## Related Documentation

- [ANALYTICS.md](./ANALYTICS.md) - Analytics dashboard system
- [LEADERBOARDS.md](./LEADERBOARDS.md) - Gamification system
- [AUDIT.md](./AUDIT.md) - Audit logging (when available)

## References

- [RFC 6238 - TOTP](https://tools.ietf.org/html/rfc6238)
- [Speakeasy.js Documentation](https://github.com/speakeasy-api/speakeasy)
- [QRCode.js Documentation](https://davidshimjs.github.io/qrcodejs/)
- [OWASP 2FA Best Practices](https://owasp.org/www-community/attacks/Brute_force_attack)

---

**Last Updated:** January 2024
**Version:** 1.0
**Status:** Production Ready
