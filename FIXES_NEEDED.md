# FIXES_NEEDED.md — App Audit

**Date:** 2026-10-04 · **Branch:** `sparkle-textbee-integration` @ `ef81086` (+3 uncommitted files)
**Method:** 5 parallel audits (API harness, security, DB/EXPLAIN, frontend, code-health) + spot-verification of every critical claim against source.
**Legend:** ✅ = verified directly (source read / command run / repro) · 📋 = agent-reported, not independently re-checked.

---

## Executive summary

| Severity | Count | Headlines |
|---|---|---|
| 🔴 Critical | 6 | Socket impersonation, OTA token, unauth upload, admin media w/o role, JWT secret fallback, prod start script seeds DB |
| 🟠 High | 12 | 4 broken API endpoints, localhost hardcoded for prod, Android bundle w/o JS, typecheck dead, 15 CVEs, missing Render env, migrations on every boot |
| 🟡 Perf/DB | 10 | ~205 ms/query RTT is the baseline; 3 full-scan queries need indexes; slow notifications query caps capacity at ~7 rps |
| 🟠 Medium | 14 | CSRF coverage, brute-force gaps, Paystack webhook dead, 65 empty catches, repo bloat, lint/test gates failing |
| ⚪ Low | 7 | Console noise, dead code, routing gaps, stale docs |

**Fresh API run (417 routes):** 411 ok · 4 real bugs (3×500 + 1 silently-empty) · 2 by-design skips · 1 deploy-ota skip · 0 rate-limit artifacts.

---

## 🔴 Critical — security / production safety

### C1. Marketplace socket namespace allows impersonation ✅
- `socket/marketplaceChat.js:15-23` — trusts `handshake.auth.userId` directly; JWT only checked when `userId` is **absent**. A client supplying any `userId` is accepted (agent completed a live handshake with no token).
- **Fix:** require a verified JWT in the namespace middleware (mirror `socket/index.js:71-106`); never trust client-supplied ids.

### C2. OTA deploy endpoint falls back to a hardcoded secret ✅
- `routes/api/ota.routes.js:88` — `process.env.OTA_DEPLOY_TOKEN || 'sparkle_ota_super_secret_deployment_2026'`; `OTA_DEPLOY_TOKEN` is **not set** in `.env`, so the hardcoded token is live.
- The mobile client executes the downloaded JS bundle with no signature verification (`frontend/src/services/OtaService.ts`).
- **Fix:** fail closed when the env var is unset; verify bundle hash/signature client-side against a pinned key.

### C3. Unauthenticated upload route ✅
- `routes/api/upload.routes.js:8` — `POST /api/upload` has **no `authMiddleware`** while its sibling `/message` (:9) has it; controller falls back to owner `anonymous` (`controllers/upload.controller.js:17`).
- **Fix:** add `authMiddleware` before `upload.single('media')`.

### C4. Admin media endpoints have no role check ✅
- `routes/api/media-admin.routes.js:9-10` — only `authMiddleware`; `requireRole` is imported (:3) but never used. Any logged-in user can trigger Cloudinary `destroy` + DB delete via `POST /api/media-admin/cleanup`.
- **Fix:** `requireRole('admin')` on both routes (or mount the admin middleware).

### C5. JWT secret falls back to a literal ✅
- `config/constants.js:3` — `process.env.JWT_SECRET || 'sparkle_secret'`; a second literal exists in `controllers/media.controller.js:10`.
- Sockets verify with `process.env.JWT_SECRET` (`socket/index.js:85`) while HTTP signs via the fallback → if Render lacks `JWT_SECRET`, HTTP-issued tokens are **forgeable** (auth bypass) while sockets reject everything. The `if (!JWT_SECRET)` guard in `auth.controller.js:21` is dead code (fallback is never falsy).
- **Fix:** throw at startup when `JWT_SECRET` is missing; delete both fallbacks; confirm the var on Render.

### C6. `start:prod` re-seeds the DB on every boot (and its env syntax is wrong) ✅
- `package.json` — `"start:prod": "npm run seed:prod && node server.js"`, `"seed:prod": "set NODE_ENV=production&& node seed-data.js"`.
- On Linux, `set NODE_ENV=…` is a no-op for the child → seed would run with **dev DB config** — and seeding on every production start is wrong regardless. `"start"` is `node --watch server.js` (watch mode in prod).
- **Fix:** Render start command = `node server.js`; drop seed from boot.

---

## 🟠 High — broken functionality

### API (all reproducible via harness) ✅

| # | Endpoint | Error | Root cause | Fix |
|---|---|---|---|---|
| H1 | `GET /api/users/following` | 500 `SQL syntax … near '?\n LIMIT ?'` | `models/User.js:275-283`: **6 `?` vs 4 bind values** (subqueries at :269-270 add 2 placeholders; array lacks them). q-branch :287-297 = 8 vs 6. Thrown at `controllers/user.controller.js:72` | Bind arrays become `[cu, cu, cu, cu, SPARKLE_SYSTEM_USER_ID, limit]` (+2 `LIKE` params in q-branch) |
| H2 | `GET /api/marketplace/conversations/:id` | 500 `Illegal mix of collations for operation 'UNION'` | `routes/api/marketplaceChatRoutes.js:162` — UNION across `utf8mb4_unicode_ci` (`marketplace_conversations`) vs `utf8mb4_general_ci` (`messages`, `personal_chats`) | `COLLATE utf8mb4_general_ci` on UNION columns, or align table charsets |
| H3 | `GET /api/marketplace/messages/:conversation_id` | 500 `different number of columns` | `routes/api/marketplaceChatRoutes.js:200` — `SELECT * FROM marketplace_conversations` = 11 cols vs 10-col `personal_chats` branch | Enumerate identical column lists in both branches |
| H4 | `GET /api/marketplace/chats` | **200 with empty data** (silent breakage) | `models/Marketplace.js:1503` — `Unknown column 'ml.thumbnail'`; catch swallows → `return []` (:1532-1534). Recurs in server log | Fix the column (add/repair index?→ check `marketplace_listings`) or remove from SELECT; never swallow into `[]` ✅ (`ml.image_url` + transient-error retry in `getUserChats`) |
| H13 | `GET/POST /api/admin/{stats,users,reports,logs,actions,announcements}` | **404 — entire Admin panel dead** (`AdminDashboard.tsx` calls all six; `controllers/admin.controller.js` never required anywhere; only `/admin/media` was mounted) | No admin mount in `routes/api/index.js`; controller was EJS-era (`res.render` → 500, no view engine); report queries read only legacy tables (`listing_reports`, `post_reports`) while live writers use `reports`/`user_reports`/`confession_reports`; `resolveReport` referenced non-existent `resolved_by`/`resolution_notes` columns | Mounted `routes/api/admin.routes.js` (`authMiddleware` + `adminMiddleware`) with JSON contracts matching `AdminDashboard.tsx`; live+legacy report aggregation; `POST /actions` (approve/restrict/purge — restrict/purge enforced at login via `account_status`); `POST /announcements` fan-out to `notifications`. Probe suite `/tmp/opencode/admin_tests.js` 9/9 ✅ (2026-10-05) |

### Frontend

| # | Finding | Evidence | Fix |
|---|---|---|---|
| H5 | **Prod build would call `localhost:3000`** — API base + socket URL hardcode localhost; only `.env.local` exists (no `.env.production`) | `frontend/src/services/EnvironmentService.ts:1-2`, `src/api/api.ts:7`, `src/utils/imageUtils.ts:5`, `src/services/OtaService.ts:7`, `src/services/socketService.ts:8` (`VITE_SOCKET_URL \|\| 'http://localhost:3000'`) ✅ | Default to relative `/api` and same-origin `/socket.io`; override via `VITE_API_URL`/`VITE_SOCKET_URL` ✅ (2026-10-05: defaults now `/api` + `window.location.origin`; Vite dev proxy already covers `/api`,`/socket.io`,`/uploads`; built bundle verified zero `localhost:3000`; `.env.local` is gitignored so Render builds stay clean; OTA note: native/APK builds must set `VITE_API_URL` absolutely) |
| H6 | **Android WebView ships no JS bundle** — `index.html` references `/assets/index-0_J_GloR.js` but `assets/` holds only 3 PNGs → blank app 📋 | `android/app/src/main/assets/public/` vs `.../assets/` | `vite build` + `npx cap sync`; reconcile dual configs ✅ (2026-10-05: root cause — `vite build` itself failed: workbox precache limit 5 MB < 5.18 MB main bundle → raised `maximumFileSizeToCacheInBytes` to 7.5 MB; `npx cap sync android` now ships `index-CvSE8WwU.js`; added `filesystem`/`preferences`/`status-bar` plugins to root package.json — was push-only; deleted stale `frontend/android/` + `frontend/capacitor.config.ts`, canonical = root `android/` + `capacitor.config.json`; APK gradle build not run here) |
| H7 | **Typecheck is a no-op/false-pass + currently fails** — `tsconfig.json` is solution-style (`"files": []`) so `tsc -p tsconfig.json` checks nothing ✅; the real config (`tsconfig.app.json`, `include: ["src"]`) exits 2 | `frontend/src/components/modals/NewChatModal.tsx:1`; `frontend/tsconfig.json` | **Unblocked & inventoried, NOT green — frozen by decision (2026-10-05):** syntax-error file `NewChatModal.tsx` deleted (dead); `npx tsc -p tsconfig.app.json --noEmit` now runs and reports **881 errors** across ~183 files: 591 TS6133 (unused decls), 161 TS2339, 24 TS2304 (missing names = likely runtime crashes, e.g. `Login.tsx:544` `setError('')` in recovery-code onClick), 20 TS2322, 19 TS2551, 17 TS2345, 10 TS1484, 10 TS2553, 9 TS2503 (React namespace), … Full inventory at `/tmp/opencode/tsc-after2.txt`. Next: dedicated typecheck-green campaign |
| H8 | **8 broken imports** in dead/unrouted files — verified TS2307: `ForwardMessage.tsx:3-6,9` (5), `ProgressMilestone.tsx:2` (→ Vite 500 but unreferenced), `MomentShareModal.tsx:6` (type-only → runtime safe ✅), `services/logger.ts:1` (unreferenced ✅) | focused `tsc` runs | ✅ (2026-10-05: deleted 7 dead files — `NewChatModal`, `ForwardMessage`, `ForwardListItem`, `ForwardHeader`, `ForwardSearchBar`, `ProgressMilestone`, `services/logger`; created missing `src/types/moment.ts` (interface moved out of `Moments.tsx`) so `MomentShareModal` resolves) |
| H14 | **Test gate non-functional** — `vitest` not installed, no `test` script; the 2 existing test files could not even be collected 📋 | `frontend/src/utils/__tests__/` | ✅ (2026-10-05: added `vitest` devDep + `npm test`; fixed real bug in `authErrorClassifier.ts` — `navigator.onLine === undefined` treated as offline, mis-classifying every network error; **24/24 tests pass**) |
| H15 | **Runtime `ReferenceError` in message merge** — `existing` is referenced in 8 places but never declared (should be `currentMsgs[exactIndex]`); fires on the first socket-echoed duplicate message (dedup/status-merge path) | `frontend/src/store/chatStore.ts:561-568` (part of H7's 24 TS2304s) | ✅ (2026-10-05: declared `const existing = currentMsgs[exactIndex]`; TDD — `chatStore.addMessage.test.ts` watched RED with the exact `ReferenceError`, now 2/2 green covering status upgrade + no-downgrade; tsc TS2304 24→16) |
| H16 | **Runtime `ReferenceError` in privacy-cache write** — `SparkleStorage` used but never imported in this file (all other callers import `{ SparkleStorage }` from `services/SparkleStorageService`); fires whenever per-chat privacy settings fetch succeeds | `frontend/src/hooks/useMessageSocket.ts:140` (part of H7's 24 TS2304s) | ✅ (2026-10-05: extracted `services/privacyReconcile.ts` (properly imports `SparkleStorage`) and wired `handleConnect` to it; TDD — `privacyReconcile.test.ts` 3/3 green: writes cache, skips empty, swallows API errors; hook no longer references `SparkleStorage`) |

### Ops / dependencies

| # | Finding | Evidence | Fix |
|---|---|---|---|
| H9 | **npm audit: 1 critical + 14 high** (prod deps) — critical `tar ≤7.5.20` path traversal (via @capacitor/cli); high: `ws`, `engine.io`/`socket.io-parser` DoS, `mysql2 ≤3.23.0` (auth-plugin downgrade + decompression DoS), `joi` proto-pollution, `body-parser`, `ip-address`, `@fastify/busboy` | `npm audit --omit=dev` → 24 total | ✅ (2026-10-05: `npm audit fix` in both roots + targeted `overrides` — `tar ^7.5.21` under `@capacitor/cli`, `cookie ^0.7.0` under `csurf`, `uuid ^11.1.1` under `gaxios`, `deepmerge-ts ^8.0.0` under `@prisma/config` → **root prod 0/0, frontend 0/0 total** (was 24 root / 25 frontend). Verified: `cap doctor` OK (tar 7.5.22 under cli 6.2.2), `prisma --version` OK (deepmerge-ts 8.0.2), backend restart + probes 18/18 + 9/9, frontend 29/29. Remaining: 3 **dev-only** highs — `braces` (all versions vulnerable upstream, GHSA-vfj7-8cjw-p6xm; `--force` would downgrade nodemon to 1.14.10 → rejected; revisit when upstream patches) |
| H10 | **Render env checklist incomplete** — missing from `.env`/verified config: `NODE_ENV`, `BACKEND_URL`, `FRONTEND_URL`, `DB_{HOST,NAME,PASSWORD,PORT,USER}_PROD`, `DB_SSL`, `JWT_SECRET`(verify), `OTA_DEPLOY_TOKEN`, `DB_POOL_LIMIT` 📋 | comm of `process.env.*` vs `.env`; `config/paystack.js:7-8` falls back to `localhost` | Set in Render dashboard. **`NODE_ENV` matters twice:** also drives CORS (see M-scope below) |
| H11 | **CORS allows every origin when `NODE_ENV ≠ 'production'`** — `if (isLocalhost \|\| isAllowed \|\| process.env.NODE_ENV !== 'production')` | `server.js:69` ✅ | Confirm `NODE_ENV=production` on Render (allowlist at `server.js:48-60` already includes the Render URL) |
| H12 | **Two diverged lockfiles ×2 repos** — root `package-lock.json` (current) vs `pnpm-lock.yaml` (Apr, pins express 4.22.1 vs 4.22.2); same split inside `frontend/` 📋 | `git log` dates per lockfile | Delete `pnpm-lock.yaml` (repo uses npm) or standardize on pnpm |

---

## 🟡 Performance / database

### Baseline (measured this session)
- **RTT ≈ 205 ms/query** to the remote shared MariaDB (serial `SELECT 1` p50 215-284 ms) → **4.8 qps per connection**.
- Linear pool scaling (measured): pool 8 → **30 qps**, 16 → 62 qps, 24 → 80 qps. Local `.env` pool = 8; host budget `max_user_connections=40`.
- App-level cost: notifications query ≈ **1.1 s** → 50-way burst yielded only **7.5 rps, p50 6.2 s** at pool 8. Feed 2-4.5 s; login under load p95 1.75 s.
- **Capacity:** current ≈ 5-7 concurrent active users on notification-heavy flows; pool 16-24 on Render ≈ 2-2.5×; fixing the slow queries is the big lever (→ 50+ users at pool 8).

### Corrections to earlier assumptions ✅
- **Login query does NOT need indexes** — `EXPLAIN` shows `type=index_merge` over `email`/`uq_users_username_normalized`/`username`, `rows=3`. Its latency is environmental (RTT + shared host), not a missing index.
- **No SQL injection found** — dynamic SQL uses placeholders or whitelists; one second-order inline quote (`models/Marketplace.js:638`) is low risk.

### Index / query fixes (from EXPLAIN; read-only script at `/tmp/opencode/dbcheck.js`) 📋 unless marked

| # | Problem | Evidence | Fix |
|---|---|---|---|
| P1 | Conversations list: unread count = **full `messages` scan per chat** | `models/Message.js:397`; EXPLAIN `DEPENDENT SUBQUERY type=ALL rows=1139 key=NULL` | `CREATE INDEX idx_msg_conv_unread ON messages(conversation_id, is_read, status, sender_id)`; `idx_msg_pc_unread (personal_chat_id, …)`; rewrite counts as one `GROUP BY`; `idx_messages_chat_sent (chat_id, sent_at)` for last-message |
| P2 | Expiry sweep scans all messages — **index is on the wrong column** (`expiry_at` indexed, query filters `expires_at`) | EXPLAIN `type=ALL`; recurring 752-1138 ms log lines | `CREATE INDEX idx_messages_expires_at ON messages(expires_at)` (or unify column) |
| P3 | `delivery_queue` poll **ignores its own index** (up to 3607 ms) | EXPLAIN `type=ALL rows=1419`, `possible_keys=idx_delivery_retry`, `key=NULL` | Selective predicate (`next_retry_at<=NOW() AND attempts<9`) + `CREATE INDEX idx_dq_retry (next_retry_at, attempts)`; purge finished rows |
| P4 | Inbox delta sync `recipient=? OR sender=? OR chat_id IN(…)` unusable → `type=ALL` + filesort (1204 ms) | EXPLAIN | `UNION ALL` of 3 indexed branches + `idx_msg_recipient_seq (recipient_id, server_sequence)`, `idx_msg_sender_seq` |
| P5 | Notifications UNION: capture branch full-scans | EXPLAIN `capture_notifications type=ALL` | `idx_cn_recipient (recipient_user_id, created_at)`; push `ORDER BY … LIMIT` into each branch |
| P6 | Moments feed: 2 correlated `follows` counts × 50 rows + derived joins (940-2852 ms) | EXPLAIN `DEPENDENT SUBQUERY`; measured 624-1008 ms vs 258 ms baseline | One grouped count query (or denormalized `follower_count`); plain `LEFT JOIN moment_likes … AND ml.user_id=?` instead of derived |
| P7 | `SELECT *` overuse — **86 hits** (`models/Marketplace.js` 15, `controllers/auth.controller.js` 6, …) | grep | Enumerate columns (esp. login `SELECT * FROM users`, `auth.controller.js:71`) |
| P8 | Duplicate indexes (e.g. `email`+`idx_users_email`, `posts created×3`, `messages conversation×3`) | `SHOW INDEX` | Drop one of each pair (write/index-size savings) |
| P9 | Profile scoring: full `users` scan + 3 correlated counts (773 ms) | `controllers/social.controller.js:33`, EXPLAIN `type=ALL` | Grouped LEFT JOIN + filter/paginate |
| P10 | **Boot DDL storm** — every restart runs ~36 slow ALTER/CREATE (`initDB` measured **130 s**) while serving traffic; duplicate-column warnings each boot | slow log + boot warnings ✅ | See M-root-cause below; gate migrations behind a schema-version table; run before `listen` (see O1) |

---

## 🟠 Medium

| # | Finding | Evidence | Fix |
|---|---|---|---|
| M1 | **CSRF only on `/api/groups`** — 16× 403 `invalid csrf token` in harness; cookie-auth (`sparkleToken`) mutations elsewhere unprotected; a dummy `csrfToken: 'sparkle_csrf_token'` endpoint (`server.js:225`) shadows the real one (`auth.routes.js:5` imports but never mounts it); the EBADCSRFTOKEN handler (`server.js:294`) is unreachable because the generic error handler (`:258`) responds first | 📋 (handler order ✅) | Apply CSRF (double-submit) to all cookie-auth mutations, Bearer requests exempt; move CSRF handler above generic; delete dummy endpoint; confirm real group actions work in UI |
| M2 | **Brute-force coverage thin** — `authRateLimiter` (20/15 min) exported but **never mounted**; `loginLimiter` (25/15 min) only on `/login`; signup/forgot/reset/OTP fall under global 500/min only | `middleware/rateLimiter.middleware.js:22-33`; no other refs | Mount `authRateLimiter` on all credential/OTP endpoints |
| M3 | **Paystack webhook can never verify** — controller expects `req.rawBody` (`controllers/wallet.controller.js:228`) but `express.json()` has no `verify` callback (`server.js:79`, grep = no `verify:`/`rawBody`) → HMAC mismatch → all webhooks 401 (fail-closed: deposits never credited) ✅ | | `express.json({ verify: (req,_res,buf)=>{req.rawBody=buf} })` |
| M4 | **X-Forwarded-For key rotation** (suspected) — `trust proxy` 1 (`server.js:36`) + IP fallback: a client hitting Node **directly** can rotate rate-limit buckets (incl. login limiter) | 📋 | Set trust proxy only behind Render; keep as-is if Node unreachable directly |
| M5 | **65 empty/catch-only `catch {}` in backend** (46 empty + 19 comment-only) — worst: 2FA backup-code `JSON.parse` silently yields empty codes → lockout risk (`security.controller.js:931`, `:1025`); migration/ALTER errors invisible (`init.js:856/873/893/896`); `marketplace.controller.js:728`; `socket/index.js:678` | 📋 | Log-then-continue at minimum; never swallow auth/migration errors |
| M6 | **Broken result-unwrapping causes every-boot duplicate ALTERs** — `init.js:1380-1382` destructures the mysql2 `[rows,fields]` tuple wrongly → `colNames=[undefined,…]` → 16 `confessions` ALTERs fire every boot; same bug `init.js:1455-1457` → `confession_comments.parent_id` ALTER every boot ✅ (log: `Duplicate column name 'parent_id'`) | | Use `const [cols] = await pool.query('SHOW COLUMNS …')` (correct pattern already at `init.js:127`); also guard unconditional DDL at `init.js:676, 787, 800, 821` 📋 |
| M7 | **Dead modules with nonexistent requires** (would crash if wired): `services/feed.service.js:5` → `../config/redis`; `config/cache.js:4` → `./redis`; `utils/database/execute.js:4` → `./pool` | 📋 | Delete or repair |
| M8 | **EJS leftovers + dead controllers** — only tracked view `views/emails/2fa-otp.ejs`, no `ejs` dependency, no view engine set; 7 controllers never required (admin, dashboard, email-auth, forwardcontroller, messaging, professional, profile); 44 `res.render()` calls would throw if reached 📋 | | Remove views/ + dead controllers after confirming truly unreferenced |
| M9 | **Frontend 401 does not force-logout** — refresh retries (1 s/3 s), then silently keeps `isAuthenticated=true`; account switch keeps old state | `src/api/api.ts:125,148` → `src/store/userStore.ts:107-125` 📋 | Hard-logout + redirect `/login` on auth failure |
| M10 | **Logout wipes device id** — `localStorage.clear()` removes `sparkle_device_id` → new id every logout, multi-device tracking broken | `src/components/modals/SettingsModal.tsx:64` vs `src/api/api.ts:60` 📋 | Clear only auth keys |
| M11 | **Repo bloat / tracked junk** — tracked: `android/` (87 files), `android_backup/`, `scratch/` (15, pre-ignore), `data/`, `tools/`, `SPARKLE ✨ SOUNDS 😇/` (344 K), `sparkle docs/` (620 K), `react-moblile-app/` (2 md); root `migrate-*.js` ×6 + `check-notif-tables.js` + `seed-data.js` (a `migrations/` dir exists); `controllers/feed.controller.js.new`; root `index.html`/`README.html` duplicates | 📋 | Move root migrations → `migrations/`; `git rm -r --cached` backups; extend `.gitignore` (missing: `android_backup/`, `data/`, root `migrate-*`, `*.new`) |
| M12 | **Lint/test gates failing** — root `lint` → frontend eslint **1373 problems (1295 errors)** exit 1; no backend lint; `test` = placeholder `exit 1`; no CI typecheck (blocked by H7) | ✅ scripts read | Fix or baseline eslint; add backend lint; wire `tsc -p tsconfig.app.json` |
| M13 | **Recurring worker error** — `[DeliveryQueueWorker] Process error:` (empty message) in log, also pre-audit | log 18:53:52 ✅ | Log full error; investigate queue processing |
| M14 | **Firebase key status corrected** 📋 | — | Client API keys remain in HEAD (`config/firebase.config.js:3`, `android/app/google-services.json:18`); **no service-account/private key was ever committed** (`git log -p` grep = 0; `serviceAccountKey.json` held google-services content only, deleted `9a5a3bd`). Action: restrict/reset the `AIza…` keys in Firebase console — rotation urgency is **lower** than previously assumed |
| M15 | **`migrations/` never applied by boot** — boot DDL only runs `utils/database/init.js`; `migrations/20260822_create_legal_consents.js` was never executed → **`user_legal_consents` missing in prod DB**, every signup's consent INSERT fails (logged non-fatal at `services/auth.service.js:311`, consent records silently lost). Probe cleanup lists the table, so the original env had it | backend log 2026-10-05 21:36:08 `ER_NO_SUCH_TABLE`; `migrations/` (10+ files, incl. `20260630_add_feed_indexes.sql`) vs `utils/database/init.js` (comments reference migrations but doesn't run them) 📋 | Diff `migrations/*` against live schema, apply missing (consent table + feed indexes), and wire a migration runner into boot or document the manual step |

---

## ⚪ Low / nice-to-have

- 567 `console.*` in frontend (worst: `Messages.tsx` 68, `App.tsx` 27) — route to logger; **0 real TODO/FIXME**.
- Dead `accessToken` fallback never written (`src/api/api.ts:44`, `CreateStory.tsx:444`, `SparklyBot.tsx:445`).
- Routing: `/confessions/:id` has no route; `/profile/:id` shadowed by `/profile/:username`; only 1 of 103 routes lazy-loaded (eager bundle).
- Outdated majors: express 4.22.3, mysql2 3.24.5, helmet 8.3, multer 2.4.0, socket.io 4.8.4, capacitor 6→8, typescript 6→7.
- Root docs inventory: `agent.md` (AI ref), `implementation_plan.md`, `discovery-logic.md`, `moments-production-architecture.md`, `DELETIONS.md` (stale post-merge), `UI_AUDIT.md` (untracked, appendix `<!-- AUDIT-DETAIL-A -->` never filled; its P0-P2 list remains fully open — 2 crashers, z-index/token systems, dead CTA routes).
- Rate-limit 429 message still says "from this IP" though authenticated buckets are now per-user (cosmetic).

---

## ✅ Verified OK (no action)

- `.env` never tracked (`git log --all -- .env` empty); gitignored (`.gitignore:15`).
- No SQL-injection patterns found in dynamic SQL.
- Main socket namespace enforces JWT (`socket/index.js:73-105`); bcrypt + timing-equalizing dummy compare (`auth.controller.js:77,86`); messages/boost/notifications/wallet use `router.use(authMiddleware)`.
- Per-user rate limiting works: user bucket 429s at 500/min while anonymous/bad-token traffic keeps its own IP bucket (401, not 429).
- No pool leaks (acquires≈releases), 0 conn-limit errors, queue cap (500) never hit.
- `node --check` passes on backend files; all `server.js` + 44 route file requires resolve.

---

## 📦 In-flight work & decisions needed

1. **Uncommitted (needs your OK to commit):** P1 frontend batch — H5 same-origin defaults (5 files), H6 workbox build fix + `cap sync` android assets + root capacitor plugins + stale `frontend/android/` removal, H7/H8/H14 dead-file deletions + `types/moment.ts` + vitest wiring + classifier fix + audit rows. Committed so far: `96fa71a` (security/API batch), `1ced155` (suggester), `31d8eb5` (admin API). H7 frozen at 881 inventoried errors by decision.
2. **Render dashboard (you only):** `NODE_ENV=production`, `JWT_SECRET`, `DB_POOL_LIMIT=16..24`, `OTA_DEPLOY_TOKEN`, `DB_*_PROD`, `BACKEND_URL`/`FRONTEND_URL`, `DB_SSL`; start command `node server.js`.
3. **Firebase console:** restrict/reset client API keys (M14).
4. **Parked:** `UI_AUDIT.md` detail appendix.

---

## Suggested fix order

1. **Security quick wins (≈ half a day):** C1 (socket JWT), C3 (+1 line), C4 (+role), C2 (env + fail closed), C5 (throw on startup), C6 (start command).
2. **API bugs (≈ half a day):** H1 (bind arrays), H2 (COLLATE), H3 (column list), H4 (`ml.thumbnail` + stop swallowing).
3. **Frontend prod blockers:** H5 (relative URLs), H7 (delete dead NewChatModal), H6 (rebuild Android assets).
4. **Ops:** H9 (`npm audit fix`), H10/H11 (Render env incl. `NODE_ENV`), H12 (one lockfile).
5. **Performance (biggest UX win):** P1-P3 indexes + P10 migration guard; then P4-P6. Re-measure via `GET /api/debug/pool`.
6. **Correctness/abuse:** M1 (CSRF), M2 (auth limiter), M3 (webhook rawBody), M6 (init.js unwrapping → stops boot DDL storm).
7. **Hygiene:** M5, M7-M12, low items, then the parked `UI_AUDIT.md` appendix.
