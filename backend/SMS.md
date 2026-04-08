# SMS Notifications System

Complete SMS notification management system integrated with Twilio, AWS SNS, or custom providers. Supports phone verification, template-based messaging, rate limiting, and comprehensive analytics.

## Architecture Overview

### Core Components

**Database Schemas (3 total):**
- `SmsNotification` - SMS records with delivery tracking
- `SmsTemplate` - Reusable message templates with variable support  
- `SmsSettings` - User SMS preferences and phone verification

**API Routes (11 endpoints):**
- Phone verification (2-step: send code → confirm)
- Settings management (retrieve/update preferences)
- Template CRUD (admin only)
- Manual SMS sending (admin)
- Notifications listing with filtering
- Statistics and cost tracking

**Features:**
- Phone verification via SMS OTP
- SMS rate limiting (daily/weekly caps)
- Template variable substitution ({{rewardName}}, {{points}}, etc.)
- SMS segment counting (160 standard / 67 unicode)
- Provider abstraction (Twilio, AWS-SNS ready)
- Retry logic with exponential backoff
- Comprehensive audit logging
- Cost tracking and statistics

## Database Schemas

### SmsNotificationSchema

Represents a single SMS message with full delivery lifecycle tracking.

**Fields:**

```javascript
{
  organizationId: ObjectId,        // Organization owner
  userId: ObjectId,               // Recipient viewer
  viewerPhoneNumber: String,      // E.164 format: +1234567890
  type: String,                   // Enum: see SMS Types section
  message: String,                // Final rendered message
  status: String,                 // pending | sent | delivered | failed | bounced
  
  // Delivery Tracking
  provider: String,               // twilio | aws-sns | nexmo
  providerMessageId: String,      // ID from SMS provider
  sentAt: Date,                   // When provider confirmed send
  deliveredAt: Date,              // When delivery confirmation received
  
  // Error Handling
  failureReason: String,          // Human-readable error
  failureCode: String,            // Provider error code
  retryCount: Number,             // Current retry attempt
  nextRetryAt: Date,              // Scheduled retry time
  
  // Message Properties
  segmentCount: Number,           // SMS segments (1 = 160 chars)
  cost: Number,                   // EUR cost for provider
  userOptedOut: Boolean,          // True if user has opted out of this type
  
  // Relationships
  relatedRedemptionId: ObjectId,  // Link to Redemption if applicable
  relatedRewardId: ObjectId,      // Link to Reward if applicable
  relatedAchievementId: ObjectId, // Link to Achievement if applicable
  templateId: ObjectId,           // Original template used
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `(organizationId, status, createdAt)` - Query by status in org
- `(userId, organizationId, createdAt)` - User SMS history
- `(status, sendAt)` - Find pending sends
- `(organizationId, type, createdAt)` - Type breakdown stats
- `(sentAt, deliveredAt)` - No delivery validation
- `(nextRetryAt)` - Find items to retry

### SmsTemplateSchema

Reusable message templates with variable support and scheduling.

**Fields:**

```javascript
{
  organizationId: ObjectId,      // Organization owner
  name: String,                  // Template name (e.g., "Redemption Approved")
  type: String,                  // Message type enum (must match SmsNotification types)
  
  // Message Content
  messageTemplate: String,       // Template with {{variable}} placeholders
  variables: [String],           // Extracted variables (auto-generated)
  charLimit: Number,             // Character limit (default 160)
  currentLength: Number,          // Message length auto-calculated
  
  // Configuration
  active: Boolean,               // Is template available for use
  usageCount: Number,            // How many times used
  lastUsedAt: Date,              // Last usage timestamp
  
  // Auto-send Configuration
  autoSend: Boolean,             // Should trigger automatically
  sendDelay: Number,             // Milliseconds delay (optional)
  
  // Metadata
  createdBy: ObjectId,           // Admin who created template
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `(organizationId, type)` - Get templates by type
- `(organizationId, active)` - Get active templates

### SmsSettingsSchema

Per-user SMS settings, preferences, and rate limits.

**Fields:**

```javascript
{
  organizationId: ObjectId,      // Organization owner
  userId: ObjectId,              // Settings owner
  
  // Phone Verification
  phoneNumber: String,           // E.164 format (validated)
  verificationCode: String,      // 6-digit code (encrypted)
  isPhoneVerified: Boolean,      // Phone number confirmed
  phoneVerifiedAt: Date,         // Verification timestamp
  
  // User Preferences
  smsEnabled: Boolean,           // Global SMS on/off toggle
  optedOutAt: Date,              // When opted out (if applicable)
  
  // Notification Type Toggles (9 types)
  notificationPreferences: {
    redemption_approved: Boolean,
    redemption_rejected: Boolean,
    achievement_unlocked: Boolean,
    reward_available: Boolean,
    low_points_warning: Boolean,
    points_earned: Boolean,
    system_notification: Boolean,
    fulfillment_update: Boolean,
    special_offer: Boolean
  },
  
  // Rate Limiting
  dailyLimit: Number,            // Max SMS per day (default 10, max 100)
  weeklyLimit: Number,           // Max SMS per week (default 50, max 500)
  smsSentToday: Number,          // Counter for today
  smsSentThisWeek: Number,       // Counter for this week
  lastSmsAt: Date,               // Last SMS timestamp
  smsLimitResetTime: Date,       // When daily limit resets
  
  // Admin Settings
  smsApiKey: String,             // Encrypted provider API key (optional per-user)
  smsProvider: String,           // User's preferred provider
  enabledForOrg: Boolean,        // Admin toggle for organization-wide SMS
  
  // Metadata
  createdAt: Date,
  updatedAt: Date
}
```

**Indexes:**
- `(organizationId, userId)` - Settings lookup
- `(organizationId, smsEnabled)` - Find enabled users

## SMS Types

Enumeration of message types and their applicable variables:

```javascript
1. redemption_approved
   Variables: {{rewardName}}, {{points}}, {{estimatedDelivery}}, {{claimCode}}
   Use: Notify user when redemption request is approved

2. redemption_rejected  
   Variables: {{rewardName}}, {{reason}}, {{supportContact}}
   Use: Notify user when redemption is rejected

3. achievement_unlocked
   Variables: {{achievementName}}, {{description}}, {{rewardPoints}}
   Use: Celebrate user achievement unlock

4. reward_available
   Variables: {{rewardName}}, {{pointsRequired}}, {{expiresAt}}
   Use: Announce new reward availability

5. low_points_warning
   Variables: {{currentPoints}}, {{threshold}}, {{nextActionUrl}}
   Use: Alert user when points drop below threshold

6. points_earned
   Variables: {{pointsEarned}}, {{action}}, {{totalPoints}}
   Use: Confirm points credited to account

7. system_notification
   Variables: {{message}}, {{actionUrl}}, {{priority}}
   Use: Critical system/maintenance announcements

8. fulfillment_update
   Variables: {{rewardName}}, {{status}}, {{trackingInfo}}, {{estimatedDate}}
   Use: Update on redemption fulfillment

9. special_offer
   Variables: {{offerName}}, {{discount}}, {{expiresAt}}, {{cta}}
   Use: Promote limited-time offers
```

## API Endpoints

### 1. Send Phone Verification Code

**Endpoint:** `POST /api/sms/settings/verify-phone`

**Description:** Initiate phone verification by sending SMS code.

**Request:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Verification code sent to +1234567890",
  "expiresIn": 600
}
```

**Status Codes:**
- `200 OK` - Code sent successfully
- `400 Bad Request` - Invalid phone format (must be E.164)
- `429 Too Many Requests` - Too many verification attempts
- `500 Server Error` - SMS provider error

**Notes:**
- Code expires after 10 minutes
- Maximum 3 verification attempts per 24 hours
- Phone in E.164 format: +[country code][number]

---

### 2. Confirm Phone Verification

**Endpoint:** `POST /api/sms/settings/confirm-phone`

**Description:** Verify the 6-digit code sent to phone.

**Request:**
```json
{
  "verificationCode": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Phone verified successfully",
  "phoneNumber": "+1234567890"
}
```

**Status Codes:**
- `200 OK` - Phone verified
- `400 Bad Request` - Invalid or expired code
- `401 Unauthorized` - No verification in progress
- `429 Too Many Requests` - Too many failed attempts

**Notes:**
- Code is 6 digits, case-insensitive
- Max 5 failed attempts before lockout
- Lockout duration: 30 minutes

---

### 3. Get SMS Settings

**Endpoint:** `GET /api/sms/settings`

**Description:** Retrieve current user's SMS settings and preferences.

**Response:**
```json
{
  "success": true,
  "settings": {
    "phoneNumber": "+1234567890",
    "isPhoneVerified": true,
    "phoneVerifiedAt": "2024-01-15T10:30:00Z",
    "smsEnabled": true,
    "dailyLimit": 10,
    "weeklyLimit": 50,
    "smsSentToday": 3,
    "smsSentThisWeek": 25,
    "notificationPreferences": {
      "redemption_approved": true,
      "reward_available": true,
      "achievement_unlocked": true,
      "low_points_warning": false,
      "points_earned": true,
      "redemption_rejected": true,
      "system_notification": true,
      "fulfillment_update": true,
      "special_offer": false
    }
  }
}
```

**Status Codes:**
- `200 OK` - Settings retrieved
- `401 Unauthorized` - Not authenticated

---

### 4. Update SMS Settings

**Endpoint:** `POST /api/sms/settings`

**Description:** Update SMS preferences, limits, and notification toggles.

**Request:**
```json
{
  "smsEnabled": true,
  "dailyLimit": 15,
  "weeklyLimit": 75,
  "notificationPreferences": {
    "redemption_approved": true,
    "achievement_unlocked": true,
    "low_points_warning": false,
    "reward_available": true,
    "points_earned": true,
    "redemption_rejected": true,
    "system_notification": true,
    "fulfillment_update": true,
    "special_offer": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Settings updated",
  "settings": { /* updated settings */ }
}
```

**Status Codes:**
- `200 OK` - Settings updated
- `400 Bad Request` - Invalid values (limit range: 1-100 daily, 1-500 weekly)
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Phone not verified yet

**Notes:**
- Phone verification required before SMS can be enabled
- Daily limit: 1-100 (default 10)
- Weekly limit: 1-500 (default 50)

---

### 5. Send Manual SMS (Admin Only)

**Endpoint:** `POST /api/sms/send-manual`

**Permission:** `sms:send`

**Description:** Admin endpoint to manually send SMS to specific user.

**Request:**
```json
{
  "userId": "507f1f77bcf86cd799439011",
  "message": "Custom message content",
  "type": "system_notification"
}
```

**Response:**
```json
{
  "success": true,
  "notificationId": "507f1f77bcf86cd799439012",
  "message": "SMS queued for delivery"
}
```

**Status Codes:**
- `201 Created` - SMS created and queued
- `400 Bad Request` - Missing required fields
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - User or organization not found

**Notes:**
- Message checked against user rate limits
- Counts toward user's daily/weekly limits
- Audit logged with admin ID

---

### 6. List SMS Notifications

**Endpoint:** `GET /api/sms/notifications`

**Query Parameters:**
- `page` (default: 1) - Page number
- `limit` (default: 10) - Results per page
- `type` - Filter by SMS type
- `status` - Filter by status (pending, sent, delivered, failed, bounced)
- `userId` - Filter by user (admin can see any, regular users see own)

**Description:** List SMS notifications with filtering and pagination.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "507f1f77bcf86cd799439013",
      "type": "redemption_approved",
      "message": "Your redemption has been approved!",
      "status": "delivered",
      "sentAt": "2024-01-15T10:30:00Z",
      "deliveredAt": "2024-01-15T10:30:05Z",
      "segmentCount": 1,
      "cost": 0.05,
      "createdAt": "2024-01-15T10:29:55Z"
    }
    // ... more notifications
  ],
  "total": 42,
  "page": 1,
  "pages": 5
}
```

**Status Codes:**
- `200 OK` - Notifications retrieved
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Cannot view other users' data

**Notes:**
- Regular users see only their own notifications
- Admin users can filter by any user
- Results sorted by newest first

---

### 7. Get SMS Templates

**Endpoint:** `GET /api/sms/templates`

**Permission:** `sms:manage`

**Query Parameters:**
- `active` (boolean) - Filter by active status
- `type` - Filter by SMS type

**Description:** Retrieve SMS templates (admin only).

**Response:**
```json
{
  "success": true,
  "templates": [
    {
      "_id": "507f1f77bcf86cd799439014",
      "name": "Redemption Approved",
      "type": "redemption_approved",
      "messageTemplate": "Great! Your {{rewardName}} is ready! Claim code: {{claimCode}}. Valid until {{expiresAt}}.",
      "variables": ["rewardName", "claimCode", "expiresAt"],
      "charLimit": 160,
      "currentLength": 92,
      "active": true,
      "usageCount": 145,
      "lastUsedAt": "2024-01-15T10:30:00Z",
      "autoSend": true,
      "sendDelay": 0
    }
    // ... more templates
  ]
}
```

**Status Codes:**
- `200 OK` - Templates retrieved
- `403 Forbidden` - Insufficient permissions

---

### 8. Create SMS Template

**Endpoint:** `POST /api/sms/templates`

**Permission:** `sms:manage`

**Description:** Create new SMS template.

**Request:**
```json
{
  "name": "Redemption Approved",
  "type": "redemption_approved",
  "messageTemplate": "Great! Your {{rewardName}} is ready! Claim code: {{claimCode}}. Valid until {{expiresAt}}.",
  "active": true,
  "autoSend": true,
  "sendDelay": 0
}
```

**Response:**
```json
{
  "success": true,
  "template": {
    "_id": "507f1f77bcf86cd799439015",
    "name": "Redemption Approved",
    "type": "redemption_approved",
    "messageTemplate": "Great! Your {{rewardName}} is ready!...",
    "variables": ["rewardName", "claimCode", "expiresAt"],
    "charLimit": 160,
    "currentLength": 92,
    "active": true,
    "usageCount": 0,
    "autoSend": true,
    "sendDelay": 0
  }
}
```

**Status Codes:**
- `201 Created` - Template created
- `400 Bad Request` - Invalid message or type
- `403 Forbidden` - Insufficient permissions
- `409 Conflict` - Template already exists

**Notes:**
- Variables extracted automatically from {{variable}} syntax
- Character count validated against SMS limits
- Message length must be ≤ 160 chars (will span multiple segments if longer)

---

### 9. Update SMS Template

**Endpoint:** `PATCH /api/sms/templates/:id`

**Permission:** `sms:manage`

**Description:** Update existing SMS template.

**Request:**
```json
{
  "name": "Redemption Approved (Updated)",
  "messageTemplate": "Updated message with {{variable}}...",
  "active": true,
  "autoSend": false,
  "sendDelay": 5000
}
```

**Response:**
```json
{
  "success": true,
  "template": { /* updated template */ }
}
```

**Status Codes:**
- `200 OK` - Template updated
- `400 Bad Request` - Invalid data
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Template not found

---

### 10. Delete SMS Template

**Endpoint:** `DELETE /api/sms/templates/:id`

**Permission:** `sms:manage`

**Description:** Soft-delete SMS template (sets `active: false`).

**Response:**
```json
{
  "success": true,
  "message": "Template deleted"
}
```

**Status Codes:**
- `200 OK` - Template deleted
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Template not found

**Notes:**
- Soft-delete only (data retained)
- Template no longer available for new messages
- Historical records preserved

---

### 11. Get SMS Statistics

**Endpoint:** `GET /api/sms/stats`

**Permission:** `sms:manage`

**Query Parameters:**
- `range` - Time range: `7days`, `30days`, `90days`, `all` (default: `7days`)

**Description:** Retrieve SMS statistics and usage metrics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalSms": 1250,
    "totalCost": 62.50,
    "avgSegments": 1.2,
    "byStatus": {
      "pending": 15,
      "sent": 1100,
      "delivered": 1080,
      "failed": 40,
      "bounced": 15
    },
    "byType": {
      "redemption_approved": 450,
      "achievement_unlocked": 280,
      "reward_available": 220,
      "low_points_warning": 180,
      "points_earned": 120,
      "system_notification": 0,
      "fulfillment_update": 0,
      "redemption_rejected": 0,
      "special_offer": 0
    },
    "deliveryRate": 0.864,
    "failureRate": 0.032,
    "bounceRate": 0.012,
    "costPerSms": 0.050
  }
}
```

**Status Codes:**
- `200 OK` - Statistics retrieved
- `403 Forbidden` - Insufficient permissions

**Metrics Explained:**
- `totalSms` - Total SMS sent in period
- `totalCost` - EUR cost to organization
- `avgSegments` - Average message length (segments)
- `deliveryRate` - Successful delivery percentage
- `failureRate` - Failed send percentage
- `bounceRate` - Invalid number percentage
- `costPerSms` - Average cost per message sent

## Phone Verification Workflow

### Step 1: Request Code
```
User inputs phone number
→ POST /api/sms/settings/verify-phone
→ System generates 6-digit code
→ SMS provider sends to phone
→ Code stored (encrypted, 10-min expiry)
```

### Step 2: Confirm Code
```
User enters received code
→ POST /api/sms/settings/confirm-phone
→ System verifies code match
→ Set isPhoneVerified: true
→ SMS now enabled for user
```

### Step 3: Account Confirmed
```
User can now receive SMS
→ Configure preferences via POST /api/sms/settings
→ SMS will be sent according to preferences
```

## Template Variable System

### Variable Syntax
Variables are inserted using double curly brackets: `{{variableName}}`

### Available Variables by Type

**redemption_approved:**
- `{{rewardName}}` - Name of redeemed reward
- `{{points}}` - Points deducted
- `{{estimatedDelivery}}` - ETA for fulfillment
- `{{claimCode}}` - Code to claim reward

**redemption_rejected:**
- `{{rewardName}}` - Reward requested
- `{{reason}}` - Rejection reason
- `{{supportContact}}` - Support email/phone

**achievement_unlocked:**
- `{{achievementName}}` - Achievement title
- `{{description}}` - What user did
- `{{rewardPoints}}` - Points earned

**reward_available:**
- `{{rewardName}}` - Reward title
- `{{pointsRequired}}` - Points needed
- `{{expiresAt}}` - Offer expiration

**low_points_warning:**
- `{{currentPoints}}` - Current balance
- `{{threshold}}` - Alert threshold
- `{{nextActionUrl}}` - Link to earn points

**points_earned:**
- `{{pointsEarned}}` - Quantity
- `{{action}}` - What earned them
- `{{totalPoints}}` - New balance

**system_notification:**
- `{{message}}` - Notification text
- `{{actionUrl}}` - Action link
- `{{priority}}` - Importance level

**fulfillment_update:**
- `{{rewardName}}` - Item being shipped
- `{{status}}` - Current status
- `{{trackingInfo}}` - Tracking number
- `{{estimatedDate}}` - Delivery date

**special_offer:**
- `{{offerName}}` - Offer title
- `{{discount}}` - Discount % or amount
- `{{expiresAt}}` - Ends when
- `{{cta}}` - Call-to-action text

### Template Rendering Example

**Template:**
```
Congratulations {{userName}}! Your redemption for {{rewardName}} has been approved. 
Claim code: {{claimCode}}. Valid until {{expiresAt}}.
```

**Variables Passed:**
```json
{
  "userName": "John",
  "rewardName": "Premium Coffee Cup",
  "claimCode": "ABC123XYZ",
  "expiresAt": "2024-02-15"
}
```

**Final Message:**
```
Congratulations John! Your redemption for Premium Coffee Cup has been approved.
Claim code: ABC123XYZ. Valid until 2024-02-15.
```

## Rate Limiting

### Daily Limits
- Default: 10 SMS per user per calendar day
- Configurable: 1-100 SMS
- Resets at: 00:00 UTC

### Weekly Limits
- Default: 50 SMS per user per week
- Configurable: 1-500 SMS
- Resets at: Monday 00:00 UTC

### Checking Limits

**Before sending SMS:**
1. Get user's `SmsSettings`
2. Check `smsSentToday` vs `dailyLimit`
3. Check `smsSentThisWeek` vs `weeklyLimit`
4. If at limit, reject with HTTP 429

**Example:**
```javascript
if (settings.smsSentToday >= settings.dailyLimit) {
  return res.status(429).json({
    error: 'Daily SMS limit reached',
    retryAfter: 86400 // seconds until reset
  });
}
```

### Resetting Counters
- Daily counter: Reset automatically at UTC midnight
- Weekly counter: Reset automatically Monday morning (UTC)
- Manual reset available via admin API (if implemented)

## SMS Provider Integration

### Supported Providers

Currently implemented:
- **Twilio** - `sendSmsViaTwilio()`

Ready for integration:
- **AWS SNS** - `sendSmsViaAwsSns()`
- **Nexmo** - `sendSmsViaNexmo()`

### Provider Abstraction Layer

```javascript
async function sendSmsViaTwilio(phoneNumber, message) {
  // Implementation
  // Returns: { success: true, messageId: "...", cost: 0.05 }
}
```

**Interface:**
- Input: `phoneNumber` (E.164), `message` (string)
- Output: `{ success: boolean, messageId: string, cost: number }`

### Adding New Provider

1. Create new function `sendSmsVia[Provider]()`
2. Implement same interface
3. Update `provider` field options in schema
4. Update `switch` statement in route handler

### Configuration

Provider settings stored in `SmsSettings`:
- `smsProvider` - Selected provider (twilio, aws-sns, nexmo)
- `smsApiKey` - Encrypted API key
- `enabledForOrg` - Organization override toggle

## Error Handling & Retry Logic

### Retry Strategy

**Automatic Retries:**
1. **First retry:** After 5 minutes (if failed)
2. **Second retry:** After 30 minutes
3. **Third retry:** After 2 hours
4. **Max retries:** 3 attempts, then mark failed

**Status Progression:**
```
pending → (retry loop) → sent → (delivery wait) → delivered
                              → failed (after max retries)
```

### Error Codes

```
INVALID_PHONE      - Phone number format invalid
RATE_LIMIT_EXCEEDED - User has hit daily/weekly limit
PROVIDER_ERROR     - SMS provider returned error
DELIVERY_FAILED    - SMS could not be delivered
INVALID_CODE       - Verification code incorrect
PHONE_NOT_VERIFIED - User must verify phone first
SMS_DISABLED       - SMS disabled for this user/org
TEMPLATE_NOT_FOUND - Referenced template doesn't exist
```

### Handling Provider Errors

```javascript
try {
  const result = await sendSmsViaTwilio(phone, message);
  // Update to 'sent'
  notification.status = 'sent';
} catch (error) {
  // Schedule retry
  notification.nextRetryAt = calculateRetryTime();
  notification.failureCode = error.code;
  notification.status = 'pending'; // Will retry
}
```

## Audit Logging

All SMS operations logged via `logAuditEvent()`:

**Logged Events:**
- SMS sent (type, user, cost)
- Phone verified (user, phone)
- Settings changed (preferences, limits)
- Template CRUD (template name, action)
- Manual sends (admin, recipient, message)
- Rate limit enforcement
- Verification code sent/confirmed

**Log Format:**
```json
{
  "organizationId": "...",
  "userId": "...",
  "action": "sms:send",
  "resource": "SmsNotification",
  "resourceId": "...",
  "changes": {
    "status": ["pending", "sent"],
    "sentAt": [null, "2024-01-15T10:30:00Z"]
  },
  "metadata": {
    "provider": "twilio",
    "cost": 0.05,
    "segmentCount": 1
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Cost Tracking

### Cost Per SMS

Varies by provider:
- **Twilio:** €0.04-0.10 per SMS (depends on country)
- **AWS SNS:** €0.03-0.08 per SMS
- **Nexmo:** €0.03-0.10 per SMS

### Segment Calculation

**Standard SMS (ASCII):**
- 160 characters = 1 segment
- 161-306 chars = 2 segments
- 307-459 chars = 3 segments
- Formula: `Math.ceil(message.length / 160)`

**Unicode SMS (Emoji, special characters):**
- 67 characters = 1 segment
- 68-134 chars = 2 segments
- Formula: `Math.ceil(message.length / 67)`

### Cost Calculation

```
Cost = Segment Count × Cost Per Segment × 1.1 (10% margin)
```

Example:
```
Message: "Hello! 👋" (9 chars, unicode)
Segments: 1
Cost: 1 × €0.05 × 1.1 = €0.055
```

### Tracking in System

Each SMS record stores:
- `segmentCount` - Number of SMS segments
- `cost` - EUR cost to organization
- Used for billing, analytics, budget monitoring

## Best Practices

### Message Composition

1. **Keep messages concise**
   - Aim for 1 segment (160 chars)
   - Avoid unnecessary words
   - Use abbreviations where clear

2. **Use variables wisely**
   - Personalize with user names
   - Include specific details (reward name, points)
   - Always provide clear CTAs

3. **Variable substitution**
   - Test with realistic data
   - Ensure no variable is undefined
   - Max 9 variables per template

### Template Design

```javascript
// ❌ Poor template
"Hi {{userName}}, you have {{points}} points! Check {{appUrl}} for details about {{offerName}} offer that expires {{expiresAt}}. Contact {{supportEmail}} for help. {{extraInfo}}"

// ✅ Good template  
"Hi {{userName}}! Your {{rewardName}} is ready. Claim code: {{claimCode}}. Valid until {{expiresAt}}."
```

### Rate Limiting Strategy

1. Set appropriate limits for user segments
   - Heavy users: 20-50 daily
   - Regular users: 5-15 daily
   - Inactive users: 1-5 daily

2. Monitor usage patterns
   - Check SMS stats regularly
   - Alert if approaching budget
   - Adjust limits as needed

### Timing & Scheduling

1. **Send at user-friendly times**
   - Morning (8-10am): promotions
   - Evening (6-8pm): redemptions
   - Avoid: midnight-6am

2. **Use sendDelay in templates**
   - Redemptions: 0-5 seconds (immediate)
   - Promotions: 30-60 seconds (batch)
   - System: 0 seconds (urgent)

## Testing & Debugging

### Manual SMS Testing

```bash
# Send test SMS
curl -X POST http://localhost:3000/api/sms/send-manual \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "507f1f77bcf86cd799439011",
    "message": "Test message",
    "type": "system_notification"
  }'
```

### Template Testing

```bash
# Verify template variable extraction
curl -X POST http://localhost:3000/api/sms/templates \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test",
    "type": "redemption_approved",
    "messageTemplate": "Hello {{userName}}, your {{rewardName}} is {{status}}.",
    "active": true
  }'
```

### Verification Code Testing

```bash
# Request verification code
curl -X POST http://localhost:3000/api/sms/settings/verify-phone \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "+1234567890"
  }'

# In development, check logs for verification code
# Then confirm it:
curl -X POST http://localhost:3000/api/sms/settings/confirm-phone \
  -H "Authorization: Bearer USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "verificationCode": "123456"
  }'
```

### Statistics Verification

```bash
curl -X GET http://localhost:3000/api/sms/stats?range=7days \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

## Environment Variables

Required in `.env`:

```bash
# SMS Provider
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Alternative providers
# AWS_SNS_ACCESS_KEY_ID=...
# AWS_SNS_SECRET_ACCESS_KEY=...
# AWS_SNS_REGION=eu-west-1

# SMS Settings
SMS_VERIFICATION_CODE_EXPIRY=600000  # 10 minutes in ms
SMS_MAX_VERIFY_ATTEMPTS=3
SMS_DEFAULT_DAILY_LIMIT=10
SMS_DEFAULT_WEEKLY_LIMIT=50
SMS_RATE_LIMIT_WINDOW=3600000  # 1 hour in ms
```

## Troubleshooting

### Issue: SMS not sending

**Check:**
1. Is `smsEnabled: true` in SmsSettings?
2. Is phone verified (`isPhoneVerified: true`)?
3. Are daily/weekly limits exceeded?
4. Is SMS type enabled in preferences?
5. Are provider credentials configured?

### Issue: Slow verification code delivery

**Check:**
1. Provider rate limiting (Twilio: 1 SMS/sec)
2. Network latency to provider
3. SMS provider outage status
4. Phone number is valid E.164 format

### Issue: High SMS costs

**Check:**
1. Are international numbers included?
2. Are unicode/emoji messages being sent?
3. Is rate limiting properly configured?
4. Segment calculation correct?

### Issue: Delivery failures

**Check:**
1. Phone number format (E.164 required)
2. Provider supports country
3. Retry logic running (check nextRetryAt)
4. Check failureReason in SMS record

## Migration from Legacy System

If migrating from another SMS system:

1. **Create mapping** for message types
2. **Import templates** to `SmsTemplate`
3. **Import phone numbers** to `SmsSettings`
4. **Import history** to `SmsNotification` (optional)
5. **Test provider** before going live
6. **Gradual rollout** by user segment

## Future Enhancements

Planned features:

- [ ] SMS template A/B testing
- [ ] Delivery analytics dashboard
- [ ] Webhook for provider status updates
- [ ] Inbound SMS handling (replies)
- [ ] Message archival (after 90 days)
- [ ] Cost budgeting & alerts
- [ ] International number formatting helper
- [ ] SMS scheduling API
- [ ] Batch SMS sending optimization
- [ ] Sender ID customization per template

---

**Last Updated:** January 2024
**Version:** 1.0.0
**API Version:** v1
