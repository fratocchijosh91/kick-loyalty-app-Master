# Redemption Workflows API Documentation

## Overview

The Redemption Workflows system enables viewers to request rewards in exchange for their earned loyalty points, and allows administrators to approve, manage, and fulfill those requests. This comprehensive system handles the complete lifecycle of reward redemptions from request to fulfillment.

---

## Architecture

### Data Model

**RedemptionSchema** - MongoDB collection for tracking redemption requests

```javascript
{
  organizationId: ObjectId,          // Organization owning this redemption
  rewardId: ObjectId,                // Reward being redeemed
  userId: ObjectId,                  // User/Viewer requesting redemption
  viewerUsername: String,            // Cached username for quick display
  quantity: Number,                  // How many of this reward (default: 1)
  pointsSpent: Number,               // Total points cost (quantity × reward.pointsCost)
  status: String,                    // pending|approved|rejected|fulfilled|expired|cancelled
  requestedAt: Date,                 // When request was created
  reviewedAt: Date,                  // When admin approved/rejected
  fulfilledAt: Date,                 // When marked as fulfilled
  expiresAt: Date,                   // Auto-expiry date (30 days from request)
  reviewedBy: ObjectId,              // Admin who reviewed
  approverComments: String,          // Optional notes from reviewer
  fulfillmentMethod: String,         // digital|physical|credit|voucher|other
  fulfillmentDetails: {
    trackingNumber: String,          // For physical shipments
    carrier: String,                 // Shipping carrier
    downloadLink: String,            // For digital rewards
    voucherCode: String,             // Voucher/code for redemption
    creditAmount: Number,            // Dollar amount for credit rewards
    deliveredTo: String              // Email/address for delivery
  },
  activityLog: [                     // Transparent audit trail
    {
      action: String,                // 'requested', 'approved', 'rejected', 'fulfilled'
      by: ObjectId,                  // Who performed the action
      timestamp: Date,               // When it happened
      notes: String                  // Context/reason for action
    }
  ]
}
```

### Database Indexes

```javascript
// Optimized for common queries
db.redemptions.createIndex({ organizationId: 1, status: 1, createdAt: -1 });
db.redemptions.createIndex({ userId: 1, organizationId: 1, createdAt: -1 });
db.redemptions.createIndex({ rewardId: 1, organizationId: 1, status: 1 });
db.redemptions.createIndex({ status: 1, expiresAt: 1 });
```

---

## API Endpoints

### 1. Request Redemption

```http
POST /api/redemptions
Authorization: Bearer {token}
Content-Type: application/json

{
  "rewardId": "507f1f77bcf86cd799439011",
  "quantity": 1
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "status": "pending",
  "pointsSpent": 500,
  "expiresAt": "2024-02-15T10:30:00Z",
  "requestedAt": "2024-01-16T10:30:00Z"
}
```

**Logic:**
- Validates that user has sufficient balance
- Checks if reward is active
- Deducts points into "pending" status
- Creates activity log entry
- Logs audit event

**Errors:**
- `400 Bad Request` - Missing rewardId
- `402 Insufficient Points` - Not enough balance
- `404 Not Found` - Reward doesn't exist
- `429 Too Many Requests` - Rate limiting

---

### 2. List Redemptions

```http
GET /api/redemptions?status=pending&page=1&limit=10
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "viewerUsername": "alice_smith",
      "reward": {
        "_id": "507f1f77bcf86cd799439010",
        "name": "$50 Amazon Gift Card",
        "icon": "🎁",
        "pointsCost": 500
      },
      "quantity": 1,
      "pointsSpent": 500,
      "status": "pending",
      "requestedAt": "2024-01-16T10:30:00Z",
      "expiresAt": "2024-02-15T10:30:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "hasMore": true
}
```

**Query Parameters:**
- `status` - Filter by status (pending, approved, fulfilled, rejected)
- `page` - Pagination (default: 1)
- `limit` - Items per page (default: 10)

**Access Control:**
- Viewers see only their own redemptions
- Admins see all redemptions in organization

---

### 3. Get Redemption Details

```http
GET /api/redemptions/507f1f77bcf86cd799439012
Authorization: Bearer {token}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "organizationId": "507f1f77bcf86cd799439001",
  "userId": "507f1f77bcf86cd799439002",
  "viewerUsername": "alice_smith",
  "rewardId": "507f1f77bcf86cd799439010",
  "reward": {
    "_id": "507f1f77bcf86cd799439010",
    "name": "$50 Amazon Gift Card",
    "description": "Spend on anything at Amazon",
    "icon": "🎁",
    "pointsCost": 500
  },
  "quantity": 1,
  "pointsSpent": 500,
  "status": "pending",
  "requestedAt": "2024-01-16T10:30:00Z",
  "reviewedAt": null,
  "fulfilledAt": null,
  "reviewedBy": null,
  "approverComments": null,
  "expiresAt": "2024-02-15T10:30:00Z",
  "fulfillmentMethod": null,
  "fulfillmentDetails": null,
  "activityLog": [
    {
      "action": "requested",
      "by": "507f1f77bcf86cd799439002",
      "timestamp": "2024-01-16T10:30:00Z",
      "notes": "Initial request"
    }
  ]
}
```

---

### 4. Approve Redemption (Admin)

```http
PATCH /api/redemptions/507f1f77bcf86cd799439012/approve
Authorization: Bearer {token}
Content-Type: application/json
Content-Type: application/json

{
  "approverComments": "Approved - order will ship in 2 days"
}
```

**Required Permission:** `redemptions:approve`

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "status": "approved",
  "reviewedAt": "2024-01-16T11:00:00Z",
  "reviewedBy": "507f1f77bcf86cd799439003",
  "approverComments": "Approved - order will ship in 2 days"
}
```

**Logic:**
- Updates status from pending → approved
- Records reviewer info and timestamp
- Points remain in "pending" status (reserved)
- Logs activity entry
- Triggers audit event

---

### 5. Reject Redemption (Admin)

```http
PATCH /api/redemptions/507f1f77bcf86cd799439012/reject
Authorization: Bearer {token}
Content-Type: application/json

{
  "reason": "Reward out of stock - will restock in 3 weeks"
}
```

**Required Permission:** `redemptions:approve`

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "status": "rejected",
  "reviewedAt": "2024-01-16T11:00:00Z",
  "approverComments": "Reward out of stock - will restock in 3 weeks"
}
```

**Logic:**
- Updates status from pending → rejected
- Returns pending points back to available balance
- Records rejection reason
- Logs activity entry
- Triggers audit event

---

### 6. Fulfill Redemption (Admin)

```http
PATCH /api/redemptions/507f1f77bcf86cd799439012/fulfill
Authorization: Bearer {token}
Content-Type: application/json

{
  "fulfillmentMethod": "digital",
  "fulfillmentDetails": {
    "downloadLink": "https://rewards.example.com/download/abc123"
  }
}
```

**Required Permission:** `redemptions:approve`

**Fulfillment Methods:**

1. **Digital Downloads**
```json
{
  "fulfillmentMethod": "digital",
  "fulfillmentDetails": {
    "downloadLink": "https://..."
  }
}
```

2. **Physical Shipment**
```json
{
  "fulfillmentMethod": "physical",
  "fulfillmentDetails": {
    "trackingNumber": "1Z999AA10123456784",
    "carrier": "UPS"
  }
}
```

3. **Account Credit**
```json
{
  "fulfillmentMethod": "credit",
  "fulfillmentDetails": {
    "creditAmount": 50,
    "deliveredTo": "alice@example.com"
  }
}
```

4. **Voucher/Code**
```json
{
  "fulfillmentMethod": "voucher",
  "fulfillmentDetails": {
    "voucherCode": "AMAZON50AMA1234"
  }
}
```

**Response:**
```json
{
  "_id": "507f1f77bcf86cd799439012",
  "status": "fulfilled",
  "fulfilledAt": "2024-01-16T11:30:00Z",
  "fulfillmentMethod": "digital",
  "fulfillmentDetails": {
    "downloadLink": "https://rewards.example.com/download/abc123"
  }
}
```

**Logic:**
- Requires status to be 'approved'
- Consumes points from balance (deducts from pending)
- Records fulfillment method and details
- Triggers audit event
- Updates total redeemed metric

---

### 7. List Pending Approvals (Admin)

```http
GET /api/redemptions/pending?page=1&limit=10
Authorization: Bearer {token}
```

**Required Permission:** `redemptions:approve`

**Response:**
```json
{
  "redemptions": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "viewerUsername": "alice_smith",
      "reward": {
        "name": "$50 Amazon Gift Card",
        "icon": "🎁"
      },
      "quantity": 1,
      "pointsSpent": 500,
      "status": "pending",
      "requestedAt": "2024-01-16T10:30:00Z",
      "expiresAt": "2024-02-15T10:30:00Z",
      "daysUntilExpiry": 28
    }
  ],
  "total": 5,
  "page": 1
}
```

**Features:**
- Ordered by oldest requests first (FIFO queue)
- Shows time until expiry
- Includes reward and viewer details
- Paginated results

---

### 8. Get Reward Redemptions

```http
GET /api/rewards/507f1f77bcf86cd799439010/redemptions?status=fulfilled
Authorization: Bearer {token}
```

**Response:**
```json
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "viewerUsername": "alice_smith",
      "quantity": 1,
      "pointsSpent": 500,
      "status": "fulfilled",
      "requestedAt": "2024-01-16T10:30:00Z",
      "fulfilledAt": "2024-01-16T11:30:00Z",
      "fulfillmentMethod": "digital"
    }
  ],
  "total": 42,
  "page": 1
}
```

**Query Parameters:**
- `status` - Filter by status
- `page` - Pagination
- `limit` - Items per page

---

### 9. Redemption Statistics (Admin)

```http
GET /api/redemptions/stats?daysBack=30
Authorization: Bearer {token}
```

**Required Permission:** `redemptions:approve`

**Response:**
```json
{
  "statuses": {
    "pending": 5,
    "approved": 8,
    "fulfilled": 42,
    "rejected": 3,
    "expired": 2
  },
  "totalPointsRedeemed": 21500,
  "totalPointsPending": 4500,
  "topRewards": [
    {
      "rewardId": "507f1f77bcf86cd799439010",
      "rewardName": "$50 Amazon Gift Card",
      "count": 15,
      "totalPoints": 7500
    }
  ],
  "timeRange": "Last 30 days"
}
```

---

## Status Workflow

```
┌─────────────┐
│  PENDING    │ ← Initial request state
└──────┬──────┘
       │
       ├────────────────────────┬──────────────────────┐
       ▼                        ▼                      ▼
   ┌─────────┐          ┌──────────┐          ┌──────────┐
   │APPROVED │          │ REJECTED │          │ EXPIRED  │
   └────┬────┘          └──────────┘          └──────────┘
        │
        ▼
   ┌──────────┐
   │FULFILLED │
   └──────────┘

Legend:
- PENDING: Waiting for admin approval
- APPROVED: Admin approved, awaiting fulfillment
- REJECTED: Admin rejected (reason in approverComments)
- FULFILLED: Reward delivered/completed
- EXPIRED: Auto-expired after 30 days (if still pending)
- CANCELLED: Manually cancelled by admin
```

---

## Authentication & Permissions

### Required Headers
```
Authorization: Bearer {jwt_token}
```

### Required Permissions

| Endpoint | Permission | Role |
|----------|-----------|------|
| POST /redemptions | (default) | Viewer |
| GET /redemptions | (default) | Viewer (own) / Admin (all) |
| GET /redemptions/{id} | (default) | Viewer (own) / Admin |
| PATCH /approve | `redemptions:approve` | Admin |
| PATCH /reject | `redemptions:approve` | Admin |
| PATCH /fulfill | `redemptions:approve` | Admin |
| GET /redemptions/pending | `redemptions:approve` | Admin |
| GET /stats | `redemptions:approve` | Admin |

---

## Error Handling

### Common Responses

```json
{
  "error": "Insufficient points for this redemption",
  "code": "INSUFFICIENT_POINTS",
  "statusCode": 402
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| INVALID_REWARD | 400 | Reward doesn't exist or is inactive |
| INSUFFICIENT_POINTS | 402 | User doesn't have enough points |
| INVALID_STATUS | 400 | Cannot transition from current status |
| NO_PERMISSION | 403 | User lacks required permission |
| REDEMPTION_NOT_FOUND | 404 | Redemption doesn't exist |
| EXPIRED | 410 | Redemption has expired |

---

## Audit Trail Integration

Every redemption action is logged to the AuditLog collection:

```javascript
{
  action: "REDEMPTION_APPROVED",           // What happened
  resourceType: "Redemption",              // What was affected
  resourceId: "507f1f77bcf86cd799439012",  // Which redemption
  userId: "507f1f77bcf86cd799439003",      // Who did it
  organizationId: "507f1f77bcf86cd799439001",
  details: {
    previousStatus: "pending",
    newStatus: "approved",
    approverComments: "..."
  },
  success: true,
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  createdAt: "2024-01-16T11:00:00Z"
}
```

---

## Best Practices

### For Viewers
1. **Check Balance First** - Review available points before requesting
2. **Note Expiry Dates** - Redemptions expire 30 days after request
3. **Fulfill Quickly** - Approved rewards should be fulfilled promptly
4. **Save Confirmation** - Keep redemption ID for reference

### For Administrators
1. **Regular Reviews** - Check pending queue daily (set reminder)
2. **Descriptive Comments** - Always add notes when approving/rejecting
3. **Track Inventory** - Monitor fulfillment status to avoid stockouts
4. **Audit Trail** - Review audit logs monthly for compliance

### General
1. **Validate Points** - Ensure sufficient balance before actions
2. **Update Rewards** - Keep reward pointsCost and inventory current
3. **Monitor Expiry** - Set up alerts for expiring redemptions
4. **Archive Data** - Backup fulfilled redemptions quarterly

---

## Common Workflows

### Workflow 1: Simple Digital Reward
```
1. Viewer requests digital reward (500 points)
2. Admin approves immediately
3. Admin fulfills with download link
4. Viewer gets digital file
5. Status: FULFILLED ✓
```

### Workflow 2: Physical with Shipment
```
1. Viewer requests physical product (800 points)
2. Admin receives warehouse notification
3. Admin approves + ships product
4. Admin updates fulfillment with tracking
5. Viewer tracks shipment
6. Status: FULFILLED ✓
```

### Workflow 3: Rejection & Refund
```
1. Viewer requests unavailable reward (600 points)
2. Admin checks inventory → stock is zero
3. Admin rejects with reason: "Out of stock - restocking 2/20"
4. System refunds 600 points to viewer
5. Viewer redeems different reward
6. Original Status: REJECTED ✓
```

---

## Examples

### cURL: Request a Redemption
```bash
curl -X POST http://localhost:5000/api/redemptions \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "rewardId": "507f1f77bcf86cd799439010",
    "quantity": 1
  }'
```

### cURL: Approve Redemption
```bash
curl -X PATCH http://localhost:5000/api/redemptions/507f1f77bcf86cd799439012/approve \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "approverComments": "Approved!"
  }'
```

### cURL: Fulfill with Digital Link
```bash
curl -X PATCH http://localhost:5000/api/redemptions/507f1f77bcf86cd799439012/fulfill \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "fulfillmentMethod": "digital",
    "fulfillmentDetails": {
      "downloadLink": "https://rewards.com/download/abc123"
    }
  }'
```

---

## Troubleshooting

### Issue: "Insufficient Points"
**Solution:** Check user balance with GET /api/viewers/{userId}. Ensure points aren't reserved for pending redemptions.

### Issue: Pending Approvals Not Showing
**Solution:** Verify user has `redemptions:approve` permission. Check if there are actually pending redemptions (status="pending").

### Issue: Fulfillment Details Lost
**Solution:** Fulfillment details are stored after fulfill endpoint succeeds. Verify PATCH request completed successfully (201 status).

### Issue: Expiry Not Working
**Solution:** Implement cron job to run daily:
```javascript
db.redemptions.updateMany(
  { status: "pending", expiresAt: { $lt: new Date() } },
  { $set: { status: "expired" } }
);
```

---

## Future Enhancements

- [ ] Bulk approvals for admin efficiency
- [ ] Automated expiry notifications
- [ ] Digital gift card generation
- [ ] Integration with fulfillment partners (ShipStation, etc.)
- [ ] Partial refunds / incomplete fulfilled
- [ ] Redemption rate analytics
- [ ] Fraud detection (unusual patterns)
- [ ] Multi-language support for notifications
