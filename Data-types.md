## Backend ↔ Frontend Data Types

This document maps the backend DTOs, entities, and enums to recommended frontend TypeScript interfaces to keep API contracts consistent and avoid type conflicts.

### Conventions

- **Backend**: NestJS DTOs (classes) and TypeORM entities (classes), enums are string enums.
- **Frontend**: Use TypeScript `interface`/`enum` with PascalCase names. Prefer explicit date fields as `string | Date` (backend sends ISO strings).
- **DTO names**: Mirror backend names for requests (e.g., `LoginDto`), or optionally alias to `LoginRequest` on the frontend if preferred.

---

### Auth DTOs

Backend (NestJS DTOs)

```ts
export class LoginDto {
  email: string;
  password: string;
}

export class RegisterDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
}

export class UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}
```

Frontend (recommended interfaces)

```ts
export interface LoginDto {
  email: string;
  password: string;
}
// or: export type LoginRequest = LoginDto

export interface RegisterDto {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
}
// or: export type RegisterRequest = RegisterDto

export interface UpdateProfileDto {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}
// or: export type UpdateProfileRequest = UpdateProfileDto
```

---

### Core Enums

Backend

```ts
export enum UserRole {
  USER = "user",
  CREATOR = "creator",
  ADMIN = "admin",
}

export enum PoolStatus {
  OPEN = "open",
  AWAITING_RELEASE = "awaiting_release",
  LIVE_TRACKING = "live_tracking",
  CLOSED = "closed",
  SETTLED = "settled",
}

export enum PoolResult {
  YES_WON = "yes_won",
  NO_WON = "no_won",
  PENDING = "pending",
}

export enum PredictionChoice {
  YES = "yes",
  NO = "no",
}

export enum PredictionResult {
  WON = "won",
  LOST = "lost",
  PENDING = "pending",
}

export enum VideoStatus {
  UNLISTED = "unlisted",
  PRIVATE = "private",
  PUBLIC = "public",
  DELETED = "deleted",
}

export enum VideoVisibility {
  UNLISTED = "unlisted",
  PRIVATE = "private",
  PUBLIC = "public",
}
```

Frontend (mirror exactly)

```ts
export enum UserRole {
  USER = "user",
  CREATOR = "creator",
  ADMIN = "admin",
}
export enum PoolStatus {
  OPEN = "open",
  AWAITING_RELEASE = "awaiting_release",
  LIVE_TRACKING = "live_tracking",
  CLOSED = "closed",
  SETTLED = "settled",
}
export enum PoolResult {
  YES_WON = "yes_won",
  NO_WON = "no_won",
  PENDING = "pending",
}
export enum PredictionChoice {
  YES = "yes",
  NO = "no",
}
export enum PredictionResult {
  WON = "won",
  LOST = "lost",
  PENDING = "pending",
}
export enum VideoStatus {
  UNLISTED = "unlisted",
  PRIVATE = "private",
  PUBLIC = "public",
  DELETED = "deleted",
}
export enum VideoVisibility {
  UNLISTED = "unlisted",
  PRIVATE = "private",
  PUBLIC = "public",
}
```

---

### Pool DTOs and Filters

Backend

```ts
export interface CreatePoolDto {
  videoId: string;
  question: string;
  targetViews: number;
  predictionWindowMinutes?: number;
  trackingDurationDays?: number;
  creatorPledge?: number;
}

export interface UpdatePoolDto {
  question?: string;
  targetViews?: number;
  trackingDurationDays?: number;
  creatorPledge?: number;
}

export interface PoolFilters {
  status?: PoolStatus;
  creatorId?: string;
  videoId?: string;
  page?: number;
  limit?: number;
}
```

Frontend

```ts
export interface CreatePoolDto {
  videoId: string;
  question: string;
  targetViews: number;
  predictionWindowMinutes?: number;
  trackingDurationDays?: number;
  creatorPledge?: number;
}

export interface UpdatePoolDto {
  question?: string;
  targetViews?: number;
  trackingDurationDays?: number;
  creatorPledge?: number;
}

export interface PoolFilters {
  status?: PoolStatus;
  creatorId?: string;
  videoId?: string;
  page?: number;
  limit?: number;
}
```

---

### Prediction DTOs and Filters

Backend

```ts
export interface CreatePredictionDto {
  poolId: string;
  choice: PredictionChoice;
  stake: number;
}

export interface PredictionFilters {
  poolId?: string;
  predictorId?: string;
  result?: PredictionResult;
  page?: number;
  limit?: number;
}
```

Frontend

```ts
export interface CreatePredictionDto {
  poolId: string;
  choice: PredictionChoice;
  stake: number;
}

export interface PredictionFilters {
  poolId?: string;
  predictorId?: string;
  result?: PredictionResult;
  page?: number;
  limit?: number;
}
```

---

### Entities (response shapes)

Note: Backend uses TypeORM entities with `Date` fields and decimal columns. Over the wire, dates are ISO strings; decimals serialize as numbers or strings depending on serialization. Frontend types below allow `string | Date` for dates.

Backend (selected scalar fields)

```ts
export class User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletBalance: number;
  googleId: string | null;
  youtubeChannelId: string | null;
  youtubeTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Video {
  id: string;
  youtubeId: string;
  title: string;
  description: string | null;
  thumbnail: string;
  status: VideoStatus;
  visibility: VideoVisibility;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
  publishedAt: Date | null;
  lastSyncedAt: Date | null;
  hasActivePool: boolean;
  poolCreatedAt: Date | null;
  poolClosedAt: Date | null;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export class Pool {
  id: string;
  videoId: string;
  creatorId: string;
  question: string;
  targetViews: number;
  trackingDurationDays: number;
  predictionWindowMinutes: number;
  status: PoolStatus;
  totalStake: number;
  creatorPledge: number;
  predictorStakes: number;
  yesStake: number;
  noStake: number;
  yesCount: number;
  noCount: number;
  participants: number;
  currentViews: number;
  yesOdds: number | null;
  noOdds: number | null;
  result: PoolResult;
  creatorEarnings: number;
  closesAt: Date | null;
  publishedAt: Date | null;
  trackingStartedAt: Date | null;
  closedAt: Date | null;
  settledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Prediction {
  id: string;
  poolId: string;
  predictorId: string;
  choice: PredictionChoice;
  stake: number;
  potentialPayout: number | null;
  actualPayout: number | null;
  result: PredictionResult;
  settledAt: Date | null;
  predictedAt: Date;
  updatedAt: Date;
}
```

Frontend (recommended interfaces)

```ts
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  walletBalance: number;
  googleId?: string | null;
  youtubeChannelId?: string | null;
  youtubeTokenExpiresAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Video {
  id: string;
  youtubeId: string;
  title: string;
  description?: string | null;
  thumbnail: string;
  status: VideoStatus;
  visibility: VideoVisibility;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  duration: string;
  publishedAt?: string | Date | null;
  lastSyncedAt?: string | Date | null;
  hasActivePool: boolean;
  poolCreatedAt?: string | Date | null;
  poolClosedAt?: string | Date | null;
  creatorId: string;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Pool {
  id: string;
  videoId: string;
  creatorId: string;
  question: string;
  targetViews: number;
  trackingDurationDays: number;
  predictionWindowMinutes: number;
  status: PoolStatus;
  totalStake: number;
  creatorPledge: number;
  predictorStakes: number;
  yesStake: number;
  noStake: number;
  yesCount: number;
  noCount: number;
  participants: number;
  currentViews: number;
  yesOdds?: number | null;
  noOdds?: number | null;
  result: PoolResult;
  creatorEarnings: number;
  closesAt?: string | Date | null;
  publishedAt?: string | Date | null;
  trackingStartedAt?: string | Date | null;
  closedAt?: string | Date | null;
  settledAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface Prediction {
  id: string;
  poolId: string;
  predictorId: string;
  choice: PredictionChoice;
  stake: number;
  potentialPayout?: number | null;
  actualPayout?: number | null;
  result: PredictionResult;
  settledAt?: string | Date | null;
  predictedAt: string | Date;
  updatedAt: string | Date;
}
```

---

### Common Paginated Responses

Backend (service return types)

```ts
// Pools list
{ pools: Pool[]; total: number; page: number; limit: number }

// Predictions list
{ predictions: Prediction[]; total: number; page: number; limit: number }
```

Frontend

```ts
export interface PaginatedPools {
  pools: Pool[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginatedPredictions {
  predictions: Prediction[];
  total: number;
  page: number;
  limit: number;
}
```

---

### Frontend Usage Notes

- Treat all dates as ISO strings from HTTP; convert to `Date` only where needed.
- Do not rely on sensitive fields (e.g., passwords, OAuth tokens); they are typically excluded.
- Keep enums identical to backend values to prevent mismatches in requests/filters.
