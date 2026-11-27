# Test Coverage Map

Living record of what the suite covers, what it deliberately does not, and where the known gaps are. Update this when you add or remove a surface.

**Run it**

```
# backend (41 suites, 622 tests)
npm test                       # all suites
BACKEND_TEST_SCOPE=pure npm test   # suites that need no database
npm run lint:backend

# frontend (66 files, 632 tests)
npm test --prefix frontend
npm run typecheck --prefix frontend
npm run lint --prefix frontend
```

Both suites are green as of the last full run. `tests/referral.test.js` skips with a clear message when no MySQL is reachable; `tests/dataCentreAndRecovery.test.js` is a genuine live-DB integration suite (real users, real PDF/XLSX generation) and is classified as needs-infra, so `BACKEND_TEST_SCOPE=pure` skips it.

## Backend — covered

| Area | Suite | Notes |
|---|---|---|
| Moments media | `media-probe-and-moments-skip.test.js`, `media-failure-paths.test.js` | URL liveness probe, the two-strike health job, upload gate, registry cleanup |
| Stripe-era wallet money paths | `wallet-and-security.test.js` | webhook HMAC verification, deposit/withdrawal validation, security-transaction state machine |
| Chat | `messages-handlers.test.js`, `messagingFeatures.test.js`, `chatListDisplay.test.js`, `inboxBadgeAccuracy.test.js`, `callMessage.test.js` | participant checks before delete, 15-minute windows, send failure mapping |
| Group admin | `groups-handlers.test.js`, `clubs-groups-routes.test.js` | creator/owner/admin ladder, owner-only deletion, join rules, request approval |
| Content | `posts-handlers.test.js`, `moments-comment-actions.test.js`, `moments-views-privacy.test.js` | ownership gates, moderation rules, comment privacy |
| Stories | `story-audience-privacy`, `story-controller-hardening`, `story-features-batch`, `story-notifications`, `story-privacy-gaps`, `story-sticker-persistence` | 73 tests: audience gates, comment visibility, share gates, highlights, viewers, quizzes, reactions |
| Marketplace | `marketplace-handlers.test.js`, `marketplaceNPlusOne.test.js` | reads/writes/contact rules, query-shape regression |
| Notifications / rooms | `notifications-and-rooms.test.js` | feed mapping, read state, rooms CRUD |
| DB resilience | `failure-modes.test.js`, `dbErrorHandlingValidation.test.js`, `dbConcurrencyValidation.test.js` | outage classification, circuit breaker fail-fast, transaction rollback |
| Route contracts | `route-auth-contracts.test.js`, `route-failure-bodies.test.js` | every route requires auth unless explicitly public; no 5xx echoes a driver message |
| Account lifecycle | `accountLifecycle.test.js`, `dataCentreAndRecovery.test.js` | suspension/termination flows, data export + recovery |

## Frontend — covered

| Area | Files | Notes |
|---|---|---|
| API client | `api/__tests__/api.interceptor.test.ts` | 401 single-flight refresh + queue replay, failover, network retry, header contract |
| Stores | `store/__tests__/` (13 files) | auth/multi-account, chat messages/receipts/unread, feed, notifications, offline queue, uploads, themes, interaction, refresh, live |
| Hooks | `hooks/__tests__/` (7 files) | message socket sync, modal a11y, infinite scroll, debounce, long-press, selection, mention search, camera, permissions, notification actions |
| Utils | `utils/__tests__/` (17 files) | validation, safe-href, embed security, tokens, watermarks, image fallback |
| Services | `services/__tests__/` (6 files) | socket, token refresh, chat transport, privacy reconcile, media download |
| Pages | `__tests__/` (19 files) | static/wiring contracts: dead controls, honest forms, layout, fallbacks, orphan routes |

## Known gaps

1. **No end-to-end harness.** No Playwright/Cypress; the 88 pages are covered by static wiring contracts only. The critical path (signup → post → message → moment) has no browser-level test.
2. **Trivial stores untested:** `modalStore`, `marketplaceStore`, `storyStore`, `capacitorStorage`. Low value — they are setters, but the count is honest.
3. **`useMentionSearch` dead export** — `hooks/useMentionSearch.ts` had zero importers when it was tested; the hook works but is unwired.
4. **Stories**: fully covered by the six existing suites; no additional suite is needed.
5. **Frontend route-level auth** is covered by backend contracts, not by frontend tests (guards live server-side by design).

## Conventions

- Backend: `node:test` + `node:assert/strict`, fake `pool.query` routers, stubbed model singletons. See `tests/marketplace-handlers.test.js` for the canonical shape.
- Frontend: `vitest`, per-file `@vitest-environment jsdom` docblock where DOM is needed, `@testing-library/react` `renderHook` for hooks.
- Both sides treat "response body must not contain schema/driver text" as a first-class assertion — that contract has caught real leaks repeatedly.
- New suites must stay green under `BACKEND_TEST_SCOPE=pure` unless they need a database.