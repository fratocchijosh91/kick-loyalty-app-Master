# Advanced Analytics Documentation - Phase 2

**Status**: ✅ Complete  
**Version**: 2.0.0  
**Date**: April 8, 2026

---

## Overview

The Advanced Analytics system provides comprehensive insights into your loyalty program performance with real-time dashboards, cohort analysis, and health scoring.

**Features:**
- 📊 Overview KPIs (rewards, revenue, retention)
- 📈 Engagement trends over time
- 🎁 Reward performance analysis
- 💪 Organization health scoring
- 📥 Data export (CSV/JSON)
- 🎯 Cohort analysis by signup month

---

## API Endpoints

All analytics endpoints require `admin` or `editor` permissions and proper JWT authentication.

### 1. GET `/api/analytics/overview`

**Overview statistics for the organization**

```http
GET /api/analytics/overview HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "organizationId": "org123",
  "organizationName": "TwitchStreamer Co",
  "metrics": {
    "totalRewards": 25,
    "activeRewards": 8,
    "viewersWithPoints": 1245,
    "pointsDistributed": 125000,
    "pointsRedeemed": 45000,
    "mrr": 29.00,
    "churnRate": 3.5
  },
  "currentPlan": "Pro",
  "generatedAt": "2026-04-08T10:30:00Z"
}
```

**Metrics Explanation:**
- **totalRewards**: All rewards ever created
- **activeRewards**: Rewards created in the last 30 days
- **viewersWithPoints**: Unique viewers who have earned points
- **pointsDistributed**: Total points earned by all viewers
- **pointsRedeemed**: Total points redeemed for rewards
- **mrr**: Monthly recurring revenue from Stripe subscription
- **churnRate**: Percentage of cancelled subscriptions (last 30 days)

---

### 2. GET `/api/analytics/rewards`

**Detailed performance analytics for each reward**

```http
GET /api/analytics/rewards?startDate=2026-03-08&endDate=2026-04-08&rewardId=reward123 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate` (optional): ISO date to filter results
- `endDate` (optional): ISO date to filter results
- `rewardId` (optional): Specific reward ID to analyze

**Response (200 OK):**
```json
{
  "organizationId": "org123",
  "rewards": [
    {
      "rewardId": "reward1",
      "name": "Golden Chair Pack",
      "pointValue": 5000,
      "description": "Custom golden chair appearance",
      "earnedCount": 342,
      "redeemedCount": 128,
      "redemptionRate": 37.4,
      "totalPointsEarned": 1710000,
      "createdAt": "2026-02-15T08:00:00Z"
    },
    {
      "rewardId": "reward2",
      "name": "Premium Badge",
      "pointValue": 1000,
      "description": "Exclusive Discord badge",
      "earnedCount": 1024,
      "redeemedCount": 856,
      "redemptionRate": 83.6,
      "totalPointsEarned": 1024000,
      "createdAt": "2026-01-10T08:00:00Z"
    }
  ],
  "dateRange": {
    "startDate": "2026-03-08",
    "endDate": "2026-04-08"
  },
  "generatedAt": "2026-04-08T10:30:00Z"
}
```

**Interpretation:**
- **Redemption Rate > 50%**: Excellent - reward is very popular
- **Redemption Rate 25-50%**: Good - viewers like this reward
- **Redemption Rate < 25%**: Consider adjusting point value (too high?)

---

### 3. GET `/api/analytics/engagement`

**User engagement metrics over time**

```http
GET /api/analytics/engagement?granularity=day&days=30 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

**Query Parameters:**
- `granularity` (day | week | month): Data aggregation level (default: day)
- `days` (number): How many days of history (default: 30)

**Response (200 OK):**
```json
{
  "organizationId": "org123",
  "granularity": "day",
  "days": 30,
  "data": [
    {
      "date": "2026-03-08",
      "apiCalls": 2450,
      "pointsDistributed": 12500,
      "uniqueViewers": 145,
      "engagementRate": 45.3
    },
    {
      "date": "2026-03-09",
      "apiCalls": 3120,
      "pointsDistributed": 18750,
      "uniqueViewers": 198,
      "engagementRate": 62.1
    }
  ],
  "totals": {
    "totalApiCalls": 125000,
    "totalPointsDistributed": 625000,
    "avgUniqueViewersPerPeriod": 175
  },
  "generatedAt": "2026-04-08T10:30:00Z"
}
```

**Trend Interpretation:**
- **Rising API Calls**: More viewers interacting
- **Rising Points Distributed**: More rewards being earned
- **Rising Unique Viewers**: Growing audience engagement

---

### 4. GET `/api/analytics/cohort`

**Cohort analysis - viewer behavior by signup month**

```http
GET /api/analytics/cohort?startDate=2025-01-01&endDate=2026-04-08 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

**Query Parameters:**
- `startDate`, `endDate`: Filter date range

**Response (200 OK):**
```json
{
  "organizationId": "org123",
  "cohorts": [
    {
      "cohortMonth": "2026-01",
      "size": 342,
      "totalPointsEarned": 1234000,
      "totalPointsRedeemed": 450000,
      "retentionRate": 78.5,
      "avgPointsPerUser": 3606
    },
    {
      "cohortMonth": "2026-02",
      "size": 215,
      "totalPointsEarned": 892000,
      "totalPointsRedeemed": 234000,
      "retentionRate": 64.2,
      "avgPointsPerUser": 4148
    }
  ],
  "dateRange": {
    "startDate": "2025-01-01",
    "endDate": "2026-04-08"
  },
  "generatedAt": "2026-04-08T10:30:00Z"
}
```

**Usage:**
- Identify which months brought quality viewers
- Retention trends per cohort
- Average lifetime value per viewer

---

### 5. GET `/api/analytics/health`

**Organization health score (0-100)**

```http
GET /api/analytics/health HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "organizationId": "org123",
  "healthScore": 78,
  "factors": {
    "engagement": "Excellent",
    "diversity": "Good",
    "retention": "Excellent",
    "subscription": "Active"
  },
  "recommendations": [
    "Keep up the great engagement levels!",
    "Consider creating more reward types to diversify"
  ],
  "generatedAt": "2026-04-08T10:30:00Z"
}
```

**Health Score Breakdown:**
- **80-100**: 🟢 Excellent - Everything is working great
- **60-79**: 🟡 Good - Some room for improvement
- **40-59**: 🟠 Fair - Needs attention in some areas
- **0-39**: 🔴 Needs Attention - Critical issues to address

**Factors:**
- **Engagement**: Activity level in last 30 days
- **Diversity**: Number of different reward types
- **Retention**: Points redeemed vs earned ratio
- **Subscription**: Active paid plan status

---

### 6. GET `/api/analytics/export`

**Export analytics data as CSV or JSON**

```http
GET /api/analytics/export?format=csv&type=rewards&days=30 HTTP/1.1
Host: localhost:5000
Authorization: Bearer <token>
```

**Query Parameters:**
- `format` (csv | json): Export format (default: csv)
- `type` (overview | rewards | engagement): Analytics type (default: overview)
- `days` (number): Historical days to include (default: 30)

**Response (200 OK - CSV):**
```csv
rewardId,name,pointsRequired,pointsEarned,pointsRedeemed
reward1,Golden Chair Pack,5000,1710000,450000
reward2,Premium Badge,1000,1024000,856000
```

**Response (200 OK - JSON):**
```json
{
  "organizationId": "org123",
  "type": "rewards",
  "exportDate": "2026-04-08T10:30:00Z",
  "data": [
    {
      "rewardId": "reward1",
      "name": "Golden Chair Pack",
      "pointsRequired": 5000,
      "pointsEarned": 1710000,
      "pointsRedeemed": 450000
    }
  ]
}
```

---

## Frontend Implementation

### Dashboard Integration

The Analytics page is available at `/org/:slug/analytics` and includes:

1. **Overview Tab**: KPI cards with revenue, churn, engagement
2. **Engagement Tab**: Line chart showing API calls and viewer activity over time
3. **Rewards Tab**: Table with reward performance and redemption rates
4. **Health Tab**: Health score with recommendations

### Usage Examples

```javascript
// In React component using OrganizationContext
const fetchAnalytics = async () => {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/analytics/overview', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  console.log(data.metrics);
};
```

### Charts Used

- **Recharts** for all visualizations:
  - `LineChart`: Engagement trends
  - `BarChart`: Reward redemption rates
  - `PieChart`: Points distribution

---

## Permissions

Analytics endpoints respect RBAC:

- **admin**: Full access to all analytics
- **editor**: View engagement and rewards analytics
- **viewer**: No analytics access
- **owner**: Full access (same as admin)

---

## Performance Considerations

### Data Retention
- **UsageRecord**: 30 days TTL (automatic deletion)
- **Cohort data**: Permanent (based on creation date)
- **Subscription metrics**: Permanent

### Aggregation Strategy
- Real-time overview (no caching)
- Engagement data grouped by date
- Reward data sorted by popularity
- Health score calculated on demand

### Optimization Tips
1. Use date filters to reduce data volume
2. Query specific rewardId when possible
3. Use CSV export for large datasets
4. Cache health scores in frontend (5-min TTL)

---

## Common Queries

### "How are my rewards performing?"
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/analytics/rewards
```
Look for `redemptionRate` - high = good, low = may need adjustment.

### "Is my community growing?"
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/analytics/engagement?days=90&granularity=week
```
Check `uniqueViewers` trend - increasing = healthy growth.

### "What's my business health?"
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/analytics/health
```
Review `healthScore` and `recommendations`.

### "Export data for investor report"
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/analytics/export?format=json&type=overview \
  > analytics-report.json
```

---

## Troubleshooting

### No analytics data showing
1. Verify you have created rewards
2. Check that viewers have earned points
3. Ensure 24h has passed (data accumulates)
4. Check JWT token scope (admin+ required)

### Redemption rate is 0%
- Viewers have earned points but haven't redeemed yet
- Check if point values are too high
- Promote rewards to increase redemption

### Health score is low
- Review recommendations
- Check engagement trends
- Consider adding more reward variety
- Run a promotion to increase engagement

---

## Integration with Other Services

### Stripe Integration
- MRR calculated from active subscription
- Churn rate based on canceled subscriptions
- Invoice tracking for revenue analytics

### Socket.io Notifications
- Real-time metrics could be pushed to connected clients
- Live charts update as new data arrives

### Email Alerts
- Health score drops below threshold
- Churn rate spikes
- Unusual engagement patterns detected

---

## Future Enhancements (Phase 3+)

- ✅ Real-time dashboard updates via WebSocket
- ✅ Predictive analytics (ML models)
- ✅ Custom metric creation
- ✅ Scheduled analytics reports (email delivery)
- ✅ Anomaly detection
- ✅ Competitor benchmarking
- ✅ Advanced segmentation

---

## API Response Times

Expected response times (on fast network):
- Overview: < 200ms
- Engagement: 200-500ms (depends on data volume)
- Rewards: 150-300ms
- Cohort: 500-1000ms (most complex)
- Health: < 300ms
- Export: 100-2000ms (depends on format/size)

---

## Support

For analytics questions:
- Check `TESTING_GUIDE.md` for test cases
- Review `API_DOCUMENTATION.md` for all endpoints
- See `README.md` for broader system overview
