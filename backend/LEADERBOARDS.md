# Leaderboards & Achievements Documentation - Phase 2 Gamification

**Status**: ✅ Complete  
**Version**: 2.0.0  
**Date**: April 8, 2026

---

## Overview

The Leaderboards & Achievements system adds gamification features to drive engagement and create competitive/aspirational experiences for viewers.

**Features:**
- 🏆 Global and time-period leaderboards
- 🎖️ Custom achievement system with categories
- 📊 Viewer rank and percentile tracking
- 🎯 Achievement progress tracking
- 🏅 Badge rewards and point bonuses
- 🎪 Multiple leaderboard periods (all-time, monthly, weekly, daily)

---

## Database Schemas

### Achievement Schema

```javascript
{
  organizationId: ObjectId,
  name: String,                    // "Golden Chair Pack"
  description: String,
  icon: String,                    // Emoji or icon URL
  badge: String,                   // Display badge
  category: enum[                  // engagement|loyalty|spending|social|milestone|special
    'engagement',
    'loyalty',
    'spending',
    'social',
    'milestone',
    'special'
  ],
  unlockCondition: {
    type: enum['points_milestone', 'redemptions', 'consecutive_days', 'referrals', 'streak', 'custom'],
    value: Number,                 // e.g., 1000 for points_milestone
    customLogic: String
  },
  pointReward: Number,             // Bonus points when unlocked
  badgeReward: String,             // Badge to display
  isActive: Boolean,
  displayOrder: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### UserAchievement Schema

```javascript
{
  organizationId: ObjectId,
  achievementId: ObjectId,         // Reference to Achievement
  viewerUsername: String,
  achievementName: String,         // Snapshot
  achievementIcon: String,
  icon: String,
  badge: String,
  pointReward: Number,
  unlockedAt: Date,
  progress: Number,                // 0-100
  notified: Boolean,
  createdAt: Date
}
```

**Indexes:**
- `{ organizationId: 1, viewerUsername: 1, achievementId: 1 }` (unique)
- `{ organizationId: 1, viewerUsername: 1, unlockedAt: -1 }`

### Leaderboard Schema

```javascript
{
  organizationId: ObjectId,
  period: enum['all_time', 'monthly', 'weekly', 'daily'],
  periodDate: Date,
  entries: [{
    rank: Number,
    viewerUsername: String,
    points: Number,
    achievements: Number,
    streaks: Number,
    lastUpdate: Date
  }],
  lastUpdated: Date,
  totalParticipants: Number
}
```

**Index:**
- `{ organizationId: 1, period: 1, periodDate: 1 }` (unique)

---

## API Endpoints

### Leaderboards

#### GET `/api/leaderboards`

Get leaderboard for organization

```http
GET /api/leaderboards?period=all_time HTTP/1.1
Authorization: Bearer <token>
```

**Query Parameters:**
- `period`: all_time | monthly | weekly | daily (default: all_time)

**Response:**
```json
{
  "organizationId": "org123",
  "period": "all_time",
  "entries": [
    {
      "rank": 1,
      "viewerUsername": "top_viewer",
      "points": 125000,
      "achievements": 15,
      "streaks": 3,
      "lastUpdate": "2026-04-08T10:30:00Z"
    }
  ],
  "totalParticipants": 1245,
  "lastUpdated": "2026-04-08T10:30:00Z"
}
```

#### GET `/api/leaderboards/rank/:username`

Get specific viewer's rank and details

```http
GET /api/leaderboards/rank/viewer123 HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "organizationId": "org123",
  "viewer": "viewer123",
  "rank": 42,
  "percentile": "96.6",
  "points": 45000,
  "totalEarned": 125000,
  "achievements": [
    {
      "name": "Golden Chair Package",
      "icon": "🪑",
      "badge": "🏅",
      "unlockedAt": "2026-03-15T08:00:00Z"
    }
  ],
  "totalParticipants": 1245
}
```

---

### Achievements

#### GET `/api/achievements`

Get all available achievements

```http
GET /api/achievements?category=milestone HTTP/1.1
Authorization: Bearer <token>
```

**Query Parameters:**
- `category`: Optional filter by category

**Response:**
```json
{
  "organizationId": "org123",
  "achievements": [
    {
      "id": "ach123",
      "name": "First Steps",
      "description": "Earn your first points",
      "icon": "👣",
      "badge": "🏅",
      "category": "engagement",
      "requirement": {
        "type": "points_milestone",
        "value": 100
      },
      "reward": {
        "points": 50,
        "badge": "🏅"
      }
    }
  ],
  "total": 25,
  "categories": ["engagement", "loyalty", "spending", "social", "milestone", "special"]
}
```

#### GET `/api/achievements/:username`

Get achievements unlocked by viewer

```http
GET /api/achievements/viewer123 HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "organizationId": "org123",
  "viewer": "viewer123",
  "unlockedAchievements": [
    {
      "id": "ach123",
      "name": "First Steps",
      "icon": "👣",
      "badge": "🏅",
      "category": "engagement",
      "unlockedAt": "2026-02-15T10:00:00Z",
      "pointReward": 50,
      "progress": 100
    }
  ],
  "totalUnlocked": 12,
  "totalAvailable": 25,
  "completionRate": "48.0"
}
```

#### GET `/api/achievements/:username/progress`

Get progress towards locked achievements

```http
GET /api/achievements/viewer123/progress HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "organizationId": "org123",
  "viewer": "viewer123",
  "achievements": [
    {
      "id": "ach456",
      "name": "Points Collector",
      "icon": "💰",
      "progress": 45,
      "progressText": "4500/10000 points",
      "requirement": {
        "type": "points_milestone",
        "value": 10000
      }
    }
  ]
}
```

#### POST `/api/achievements`

Create new achievement (admin only)

```http
POST /api/achievements HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "VIP Member",
  "description": "Earn 5000 points",
  "icon": "👑",
  "badge": "✨VIP✨",
  "category": "milestone",
  "unlockCondition": {
    "type": "points_milestone",
    "value": 5000
  },
  "pointReward": 100,
  "badgeReward": "✨VIP✨",
  "displayOrder": 5
}
```

**Response:** 201 Created

#### PATCH `/api/achievements/:id`

Update achievement (admin only)

```http
PATCH /api/achievements/ach123 HTTP/1.1
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Elite VIP",
  "pointReward": 200
}
```

#### DELETE `/api/achievements/:id`

Soft-delete achievement (admin only)

```http
DELETE /api/achievements/ach123 HTTP/1.1
Authorization: Bearer <token>
```

#### POST `/api/achievements/:username/check`

Evaluate and unlock achievements for viewer (admin only)

```http
POST /api/achievements/viewer123/check HTTP/1.1
Authorization: Bearer <token>
```

**Response:**
```json
{
  "organizationId": "org123",
  "viewer": "viewer123",
  "newAchievements": [
    {
      "name": "Points Collector",
      "icon": "💰",
      "pointReward": 100
    }
  ],
  "totalUnlocked": 3
}
```

---

## Frontend Implementation

### LeaderboardsPage Component

Located at `frontend/src/pages/LeaderboardsPage.jsx`

**Features:**
- 🏆 Podium view (top 3)
- 📊 Full leaderboard table
- 📅 Period selector (all-time, monthly, weekly, daily)
- 🎖️ Achievement display with unlocked/locked states
- 🎯 Progress tracking towards locked achievements
- 📈 Category completion metrics

**Tabs:**
1. **Leaderboard** - Rankings and viewer comparison
2. **Achievements** - Achievement gallery and progress

### Integration Example

```javascript
// Fetch leaderboard
const res = await fetch('/api/leaderboards?period=all_time', {
  headers: { Authorization: `Bearer ${token}` }
});
const data = await res.json();

// Get user's rank
const rankRes = await fetch(`/api/leaderboards/rank/${username}`, {
  headers: { Authorization: `Bearer ${token}` }
});
const rankData = await rankRes.json();

// Fetch achievements
const achRes = await fetch(`/api/achievements`, {
  headers: { Authorization: `Bearer ${token}` }
});
const achievementsList = await achRes.json();
```

---

## Achievement Types

### By Unlock Condition

| Type | Example | Value |
|------|---------|-------|
| **points_milestone** | "Earn 1000 points" | Points threshold |
| **redemptions** | "Redeem 5 rewards" | Redemption count |
| **consecutive_days** | "10 days active" | Days threshold |
| **referrals** | "Refer 3 friends" | Referral count |
| **streak** | "7-day streak" | Days in streak |
| **custom** | "Custom condition" | Client-defined logic |

### By Category

| Category | Purpose | Examples |
|----------|---------|----------|
| **engagement** | Activity-based | First points, streak keeper |
| **loyalty** | Long-term value | VIP member, 1-year subscriber |
| **spending** | Spending milestones | Big spender, milestone collector |
| **social** | Community interaction | Referral master, community helper |
| **milestone** | General achievements | First steps, 100 points |
| **special** | Limited/seasonal | Limited edition badges |

---

## Leaderboard Caching Strategy

### Cache Duration
- Leaderboards are cached for **1 hour**
- Automatically refresh if stale
- Can be manually invalidated via POST endpoint

### Cache Keys
```
leaderboard:{org_id}:{period}:{period_date}
```

### Refresh Triggers
- Every 1 hour automatically
- After achievement unlock
- After point redemption
- Manual admin request

---

## Permissions

| Endpoint | Public | Editor | Admin | Owner |
|----------|--------|--------|-------|-------|
| `GET /leaderboards` | ✓ | ✓ | ✓ | ✓ |
| `GET /achievements` | ✓ | ✓ | ✓ | ✓ |
| `GET /achievements/:user` | ✓ | ✓ | ✓ | ✓ |
| `POST /achievements` | ✗ | ✗ | ✓ | ✓ |
| `PATCH /achievements/:id` | ✗ | ✗ | ✓ | ✓ |
| `DELETE /achievements/:id` | ✗ | ✗ | ✓ | ✓ |
| `POST /achievements/check` | ✗ | ✗ | ✓ | ✓ |

---

## Best Practices

### Achievement Design
1. **Clear Goals**: Make unlock conditions obvious
2. **Progressive**: Start easy, get harder
3. **Rewarding**: Unlock should feel earned
4. **Variety**: Mix engagement, loyalty, spending
5. **Communicate**: Notify on unlock immediately

### Leaderboard Strategy
1. **Multiple Periods**: Show different time windows
2. **Freshness**: Update frequently for engagement
3. **Accessibility**: Make top 3 easy to see
4. **Personal Context**: Show user's own rank
5. **Celebration**: Highlight top achievers

### Example Achievement Progression

```javascript
// Tier 1: Easy
{ name: "First Step", value: 100 },

// Tier 2: Medium
{ name: "Growing Presence", value: 1000 },

// Tier 3: Hard
{ name: "Community Pillar", value: 10000 },

// Tier 4: VIP
{ name: "Legendary Status", value: 50000 }
```

---

## Common Workflows

### Creating Achievements

```bash
# Create milestone achievement
curl -X POST http://localhost:5000/api/achievements \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "First 1000 Points",
    "icon": "🎉",
    "category": "milestone",
    "unlockCondition": {
      "type": "points_milestone",
      "value": 1000
    },
    "pointReward": 100
  }'
```

### Checking Achievement Eligibility

```bash
# Evaluate user for all achievements
curl -X POST http://localhost:5000/api/achievements/viewer123/check \
  -H "Authorization: Bearer $TOKEN"
```

### Getting Leaderboard

```bash
# Get all-time leaderboard
curl http://localhost:5000/api/leaderboards \
  -H "Authorization: Bearer $TOKEN"

# Get weekly leaderboard
curl http://localhost:5000/api/leaderboards?period=weekly \
  -H "Authorization: Bearer $TOKEN"
```

---

## Schema Relationships

```
Organization
├── Achievement (1:N)
│   └── UserAchievement (1:N)
│       └── ViewerPoints
└── Leaderboard (1:N, period-based)
    └── ViewerPoints
```

---

## Future Enhancements

- ✅ Real-time leaderboard updates via WebSocket
- ✅ Seasonal achievement events
- ✅ Team leaderboards (not just individual)
- ✅ Achievement streaks with multipliers
- ✅ Social sharing of achievements
- ✅ Customizable achievement templates
- ✅ Scheduled achievement resets

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Leaderboard not updating | Cache stale | Wait 1 hour or POST refresh |
| Achievement not unlocking | Condition not met | Check POST /check endpoint response |
| Empty leaderboard | No viewerPoints records | Ensure viewers have earned points |
| Progress showing 0% | User created today | Check if meets any condition |

---

## Support

For questions:
- Review [ANALYTICS.md](ANALYTICS.md) for related analytics
- Check [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for all endpoints
- See [README.md](../README.md) for system overview
