# Creator Pool Backend API - Development Plan

## Overview

Build a NestJS backend API for Creator Pool - a prediction platform where fans predict YouTube video performance and creators earn rewards. Following NestJS best practices and MVP-first approach.

## Core Business Logic

### Parimutuel System

- **Pool-based system**: Participants bet against each other, not the house
- **Dynamic odds**: Real-time changes based on where money is placed
- **House edge**: 6% total (5% platform + 1% creator)
- **Formula**: `netPool = totalStake × 0.94`
- **Odds calculation**: `odds = (netPool ÷ sideStake) - 1`

### Pool Lifecycle

1. **Open**: Accepting predictions (10-minute window by default)
2. **Awaiting Release**: Prediction period ended, waiting for video publication
3. **Live Tracking**: Video published, tracking performance metrics
4. **Closed**: Tracking period ended, processing results
5. **Settled**: Results calculated and rewards distributed

## Architecture Decisions

### 1. Payment Processing

- **MVP: Paystack** for all transactions
- Flow: Staking → Pool wallet → Reward distribution
- Currency: USD or GHS (configurable)
- Future: Stripe integration

### 2. Authentication

- **Predictors:** Email/password with JWT (httpOnly cookies)
- **Creators:** Google OAuth2 with YouTube scope
- **Admins:** Internal platform accounts
- Redis for refresh tokens

### 3. YouTube API

- Batch fetch every 5-15 minutes
- Redis caching
- BullMQ queue for throttling
- Fallback: cached data + "Data Pending" status

### 4. Creator Verification

- **MVP:** Manual review + email/channel confirmation
- **Post-MVP:** OAuth verification with unlisted video access

### 5. Pool Caps

- Min stake: $1
- Max stake per user: $500
- Max pool: $10,000
- Limit: 5 predictions per pool per user

### 6. Timezones

- All timestamps in UTC
- Frontend converts to local (Luxon/Day.js)
- Cron jobs in UTC

### 7. Error Handling

```typescript
{
  success: boolean,
  message: string,
  code?: string,
  data?: any
}
```

---

## Phase 1: Foundation & Core Setup

- [x] NestJS initialization
- [x] TypeORM + PostgreSQL configuration
- [x] User entity created with roles (USER, CREATOR, ADMIN)
- [x] Database configuration
- [x] Health endpoint working
- [ ] JWT auth setup
- [ ] Redis configuration
- [ ] Sentry monitoring

**Deliverables:** ✅ Working server, ✅ User entity, ⏳ Auth endpoints

---

## Phase 2: User Management & Auth

**Endpoints:**

- POST /auth/register
- POST /auth/login
- POST /auth/google (Google OAuth2)
- POST /auth/refresh
- GET /auth/profile
- PUT /auth/profile
- POST /auth/verify-phone

**Features:**

- [x] User entity with roles (USER, CREATOR, ADMIN)
- [ ] JWT authentication with httpOnly cookies
- [ ] Password hashing with bcrypt
- [ ] Google OAuth2 for creators
- [ ] Role-based guards (@Roles decorator)
- [ ] Refresh token rotation via Redis
- [ ] Session management (7-day timeout)

---

## Phase 3: Creator & YouTube Integration

**Endpoints:**

- POST /creators
- GET /creators
- GET /creators/:id/stats
- POST /auth/google (OAuth2)

[ ] Creator entity
[ ] YouTube API integration
[ ] CreatorStats calculation
[ ] Google OAuth2 flow

---

## Phase 4: Analytics Worker & Scheduled Tasks

**Features:**

- [ ] BullMQ setup with Redis
- [ ] Scheduled job for YouTube sync (every 6 hours)
- [ ] Calculate avg views (24h, 48h, 7d)
- [ ] Exponential backoff retry
- [ ] API quota management
- [ ] Pool lifecycle scheduler (every 30 seconds)
  - Auto-close open pools after 10 minutes
  - Auto-close live_tracking pools after 24 hours
- [ ] Auto-settlement job for closed pools

---

## Phase 5: Pool Management & Core Entities

**Endpoints:**

- POST /pools (Creator only)
- GET /pools (filter by state)
- GET /pools/:id
- PUT /pools/:id/status
- POST /pools/:id/settle

**Entities to Create:**

- [ ] Video entity (youtubeId, title, thumbnail, status, viewCount, etc.)
- [ ] Pool entity (videoId, creatorId, question, targetViews, status, odds, etc.)
- [ ] Prediction entity (poolId, predictorId, choice, stake, payout, etc.)
- [ ] Transaction entity (userId, amount, type, status, reference, etc.)

**Features:**

- [ ] Parimutuel odds calculation (netPool × 0.94 / sideStake - 1)
- [ ] Pool state machine transitions
- [ ] 10-minute prediction window
- [ ] Dynamic odds updates

---

## Phase 6: Predictions & Dynamic Odds

**Endpoints:**

- POST /predictions (create prediction)
- GET /predictions (list predictions with filters)
- GET /predictions/:id
- GET /pools/:id/odds (current odds)

**Features:**

- [ ] Dynamic odds calculation using parimutuel system
- [ ] Formula: `odds = (netPool × 0.94 ÷ sideStake) - 1`
- [ ] Real-time odds updates via WebSocket
- [ ] Stake validation (min/max limits)
- [ ] Multiple predictions per pool allowed
- [ ] Potential payout calculation

---

## Phase 7: Settlement & Rewards

**Endpoints:**

- POST /pools/:id/settle
- POST /pools/:id/track (manual tracking)
- GET /pools/:id/results

**Settlement Logic:**

- [ ] Determine outcome: `currentViews >= targetViews`
- [ ] Calculate fees: 5% platform + 1% creator = 94% net pool
- [ ] Distribute winnings proportionally to winners
- [ ] Update prediction results (won/lost/pending)
- [ ] Credit creator royalty (1% of losing stake)
- [ ] Update user wallets
- [ ] Handle failed settlements with retry queue

---

## Phase 8: YouTube Integration & Live Tracking

**Endpoints:**

- GET /youtube/auth-url
- POST /youtube/callback
- GET /youtube/channel
- POST /youtube/sync-videos
- GET /youtube/videos
- GET /ws/pools/:id (WebSocket)

**Features:**

- [ ] YouTube OAuth2 flow for creators
- [ ] Video synchronization service
- [ ] Real-time stats polling (every 5-15 min)
- [ ] WebSocket broadcasts for pool updates
- [ ] Auto state transitions (Open → AwaitingRelease → LiveTracking → Closed → Settled)
- [ ] Rate limiting & quota management
- [ ] Cached data fallback for API failures

---

## Phase 9: Wallet & Transactions

**Endpoints:**

- GET /wallet/balance
- POST /wallet/deposit
- POST /wallet/withdraw
- GET /transactions
- GET /creators/:id/revenue

**Features:**

- [ ] Wallet balance management
- [ ] Paystack integration (MVP payment method)
- [ ] Transaction history tracking
- [ ] Deposit/withdrawal handling
- [ ] Creator revenue tracking
- [ ] Transaction types: deposit, withdrawal, stake, reward, fee, royalty, pledge

---

## Phase 10: Auto Question Generation

**Endpoint:**

- GET /creators/:id/suggestions

[ ] QuestionGeneratorService
[ ] Template generation
[ ] Stats-based suggestions

---

## Phase 11: Performance

[ ] Database indexes
[ ] Redis caching
[ ] Query optimization
[ ] Connection pooling

---

## Phase 12: Testing & Documentation

[ ] Unit tests (Jest)
[ ] Integration tests
[ ] CI/CD setup
[ ] 80%+ coverage

---

## Key Dependencies Required

```json
{
  "@nestjs/jwt": "^10.0.0",
  "@nestjs/passport": "^10.0.0",
  "@nestjs/schedule": "^4.0.0",
  "@nestjs/websockets": "^10.0.0",
  "@nestjs/platform-socket.io": "^10.0.0",
  "passport-jwt": "^4.0.1",
  "passport-google-oauth20": "^2.0.0",
  "googleapis": "^128.0.0",
  "socket.io": "^4.7.4",
  "redis": "^4.6.10",
  "ioredis": "^5.3.2",
  "bullmq": "^5.0.0",
  "paystack": "^2.0.0"
}
```

## Next Steps

1. ✅ Phase 1 in progress - NestJS foundation complete
2. Continue with JWT auth (Phase 2)
3. Follow NestJS documentation: https://docs.nestjs.com/
4. Implement parimutuel system correctly
