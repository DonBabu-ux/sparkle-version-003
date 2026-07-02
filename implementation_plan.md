# Implementation Plan – Sparkle Empty‑State & Onboarding (Prioritized Phases)

**Goal**
Ensure that every new Sparkle user never encounters an empty screen and enjoys a smooth, engaging onboarding experience. The implementation proceeds in prioritized phases, focusing first on user‑visible empty‑state elimination before backend models, migrations, and rich notifications.

---

## User Review Required
> **⚠️ Breaking Changes**
> * New environment variable `SPARKLE_SYSTEM_USER_ID` must be defined in `.env`.
> * API endpoints `/api/moments` and related controllers will be updated – existing clients may need to adjust error handling.
> * New conversation creation logic will insert a system‑user‑only thread; ensure the system user exists.

---

## Open Questions
> [!IMPORTANT]
> * How should the discover feed be ranked (popularity vs. interest weighting)?
> * Desired cache TTL for discover feed (30 s, 60 s)?
> * Should the welcome conversation be created synchronously on signup or lazily on first request?
> * Any UI design assets for the rich notification cards (icons, colors)?

---

## Proposed Changes

### Phase 1 — Empty‑State Elimination (Highest Priority)
#### Moments Feed
- Update `controllers/moments.controller.js` (`getMomentsStream`) to:
  1. Detect `followingCount === 0` for the requesting user.
  2. If zero, fetch a **discover feed** (popular creators, trending moments, interest‑based moments, latest public moments).
  3. Return the discover feed in the same response shape (no extra request needed).
  4. Add a **Redis cache** layer (`discover:feed:<userId>`) with TTL configurable (default 45 s).
  5. Ensure pagination works and that duplicate video IDs are filtered.

#### Messages – Welcome Conversation
- Create a new **system user** seeded via migration (if not already present). The env var `SPARKLE_SYSTEM_USER_ID` will hold its UUID.
- Add idempotent logic in `services/onboarding.service.js` (or new `UserBootstrapService`) that:
  1. Checks for an existing conversation between the new user and the system user.
  2. If none, creates a conversation row in `conversations` table.
  3. Inserts a **rich welcome message** (structured JSON supporting title, body, buttons).
- Enforce restrictions on the system account (no replies, reactions, calls, block, report, follow, delete) via checks in the messaging controller.

#### New Chat – No Empty Sections
- Extend `controllers/newChat.controller.js` (or the corresponding route) to compose the response list:
  1. Followers (if any).
  2. Following (if any).
  3. Suggested Users (via recommendation service).
  4. Popular Creators (top 10 by follower count).
  5. Verified Accounts (verified flag).
- Continue loading sections until at least **20 users** are returned, padding with the next category if needed.
- Front‑end `NewChat` component will render the sections in this order; ensure the API always returns a non‑empty array.

---

### Phase 2 — Rich Notifications
- Refactor `models/Notification.js` to store structured fields (`title`, `body`, `icon`, `actions`, `metadata`).
- Update `services/notification.service.js` to build payloads with bold markup and clickable entity metadata.
- Adjust frontend notification renderer to display cards with action buttons and deep links.

---

### Phase 3 — Authentication Screens Improvements
- **Signup**: add live validation, password strength meter, UI animations, automatic transition to OTP → login → onboarding.
- **Login**: add Remember Me, show/hide password, redirect logic based on `response.next.route`.

---

### Phase 4 — Onboarding Flow Pages
- Create `frontend/src/components/onboarding/*` with slides 1‑6 as described.
- Add backend `/api/onboarding/complete` route that marks `onboarding_complete = true` and returns `next.route`.

---

### Phase 5 — Dashboard Profile Completion Card
- Store `profile_completion` (0‑100) and reminder flags in `users` table.
- Front‑end dashboard renders premium reminder card when completion < 100 and reminder not disabled.

---

### Phase 6 — Performance & Validation
- Verify no N+1 queries in the new feed logic.
- Add indexes on `followers`, `moments.created_at`, and `notifications.user_id`.
- Ensure all new endpoints are paginated.
- Write unit/integration tests for each phase.

---

## Verification Plan
### Automated Tests
- Run existing test suite (`npm test`).
- Add new tests for Moments fallback, welcome conversation idempotency, New Chat non‑empty response, and notification structure.

### Manual Verification
- Create a fresh test account and verify:
  * Moments feed shows content immediately.
  * Messages page contains the system welcome chat.
  * New Chat lists sections up to 20 users.
  * Rich notification appears with interactive buttons.
  * Onboarding screens appear after signup.

Please review the plan, answer the open questions, and approve so we can start implementing Phase 1.
