# FIXED_PROGRESS — everything already fixed in this project

> **Read this before fixing anything, anywhere in this repo.** It exists so we never re-fix,
> re-audit, or regress work that is already done. One line per fix → detail lives in the
> linked source doc.
>
> Created 2026-10-09 · HEAD `6aa8adf` (= `main` = `senior-sparkle-code`)

---

## How to use this file

- **Sources of truth:** `FIXES_NEEDED.md` (deep detail per item, with ✅ evidence + dates),
  `UI_AUDIT.md` (page/component audit + Pass-8 verdicts), `DELETIONS.md` (what was deleted
  and why), this file = the index.
- **Staleness rules:**
  - `UI_AUDIT.md` ❌/⚠️ verdicts come from Pass 8 at `ab69111` — they **predate the P0 batch
    (`c56667a`)**. Many "still broken" markers are stale; the numbered P0 list below is current.
  - `FIXES_NEEDED.md` rows ending in `✅ (date…)` are authoritative — the fix is in.
  - Anything open is listed in **§10 Still OPEN** — pick work from there only.
- **Never claim fixed without running the gates** (§0).

---

## §0 Standing verification gates

Run after any change (frontend = `frontend/`, backend probes = repo root):

| Gate | Command | Expected |
|---|---|---|
| Unit/integration tests | `npx vitest run` | **122/122 (19 files)** |
| Lint (errors only) | `npx eslint src --quiet` | **exit 0** |
| Production build | `npm run build` | **`✓ built`** |
| Backend syntax | `node --check <file>` | no output |
| API probe battery | `node /tmp/opencode/fix_tests.js` (NODE_PATH=`$PWD/node_modules`) | **18/18** |
| Admin probe | `node /tmp/opencode/admin_tests.js` | **9/9** |
| Role login probe | `node /tmp/opencode/role_login_test.js` | **4/4** |
| DB-error mapping probe | `node /tmp/opencode/db_error_mapping_test.js` | **14/14** |
| P11 probe | `node /tmp/opencode/p11_probe.js` | 7/8 (8th = probe's own missing param) |
| Cookie refresh probe | `node /tmp/opencode/cookie_refresh_probe.js` | 14/14 |
| XSS media e2e | `node /tmp/opencode/xss_media_probe.js` | 6/6 |
| Health | `curl -s localhost:3000/api/health` | `status: success, database: connected` |

⚠️ Probe scripts live in `/tmp/opencode/` — they are **not** in the repo. If missing, recreate
from the FIXES_NEEDED entry for the item being verified.
**Server restart protocol:** `pkill -x -f 'node --dns-result-order=ipv4first server.js'` (MUST `-x`),
then `(setsid nohup node --dns-result-order=ipv4first server.js > /tmp/sparkle-backend.log 2>&1 < /dev/null &)`,
~10 s, health-check.
**Never stage `.env*`.**

---

## §1 Security — backend (all ✅)

| ID | Fix (detail: FIXES_NEEDED.md) |
|---|---|
| C1 | Marketplace socket namespace impersonation → JWT enforced ✅ |
| C2 | OTA deploy endpoint hardcoded secret → env, fail-closed ✅ |
| C3 | Unauthenticated upload route → auth-gated ✅ |
| C4 | Admin media endpoints no role check → `adminMiddleware` ✅ |
| C5 | JWT secret literal fallback → fail-fast at boot ✅ |
| C6 | `start:prod` re-seeded DB every boot → seeding removed/gated ✅ |
| M1 | CSRF extended to **all** cookie-auth mutations (double-submit; Bearer exempt); dummy `/api/csrf-token` deleted; EBADCSRFTOKEN handler merged into unified error handler ✅ |
| M2 | `authRateLimiter` mounted on 9 credential/OTP endpoints (burn → 429 on #21) ✅ |
| M3 | Paystack webhook `rawBody` via `express.json({verify})` → HMAC verifies, HTTP 200 ✅ |
| M4 | `trust proxy` env-gated (`TRUST_PROXY`, default only under `NODE_ENV=production`) ✅ |
| M5 | 65 empty/catch-only catches → 2 intentional, rest log-then-continue (47 sites/26 files) ✅ |
| — | `96fa71a` batch: media-admin auth-gate, fail-closed OTA, JWT fail-fast, socket impersonation fix, user-keyed rate limits, 500-query fixes, pool observability ✅ |
| — | Rate-limit key rotation hardened (M4), per-user buckets verified (user 429 / anon 401) ✅ |

**Frontend security (batch `c56667a` = A.4 P1s + P0s):**

- **#1 Stored XSS**: `safeHref()` client guard on every user-URL `href` (Messages, SharedContentExplorer…) + server-side `^https?://` scheme validation on `media_url`/`file_url`/`link.url` ✅
- **#4 CSP + SRI + Referrer-Policy**: enforcing CSP in `frontend/vercel.json` (self + allow-list, `object-src none`, `frame-ancestors self`), SRI (`sha384`) on pinned stylesheets, `Referrer-Policy: no-referrer` ✅
- **#5 Log redaction**: `logger.warn/error` redact axios configs → no `Authorization`/`x-refresh-token`/OTP-in-query in prod logs ✅
- **#6 Reverse tabnabbing**: `window.open(..., 'noopener')` on 3 user-URL sites ✅
- **#7 Service-worker cache purge**: `purgeAccountScopedCaches()` kills SW `api-cache*` + `sparkle_signup_*` on logout **and** account switch ✅
- **Cookie-first refresh**: httpOnly `sparkleRefresh` + CSRF path exemption → browser-refresh 401/403 gone ✅
- **OTA sha256 verify** on downloaded bundles ✅ · **logger token redaction** ✅
- **P0-19**: baked `127.0.0.1`/`localhost:3000` purged from `dist/` (verified 0 hits) ✅
- **P0-21**: CORS `exposedHeaders: ['x-refresh-token']` (H26 adoption works cross-origin) ✅
- **P0-22**: `role` claim added to renewed + 2FA JWTs (admin nav no longer vanishes) ✅

**Verified-OK (no action needed, re-checked):** `.env` never tracked; no SQLi patterns in
dynamic SQL; main socket namespace JWT-enforced; bcrypt + timing-equalizing dummy compare;
no DB pool leaks; queue cap never hit.

> 🔴 **C7 (login-as-anyone via 7-day JWT from client input) is OPEN — explicitly deferred by
> user decision 2026-10-07. Do not "discover" it again; fix it only when told.**

---

## §2 Auth/session reliability & outage honesty (all ✅)

| ID | Fix |
|---|---|
| H15 | `chatStore` message-merge `ReferenceError` (`existing` undeclared) → declared; TDD 2/2 ✅ |
| H16 | `useMessageSocket` `SparkleStorage` not imported → extracted `services/privacyReconcile.ts`; TDD 3/3 ✅ |
| H17 | Three racing token-refresh paths → single-flight `services/tokenRefresh.ts`; TDD 7/7 ✅ |
| H18 | `StoryAudioManager.getInstance()` crash loop → shared `audioEventBus` default; TDD 3/3 ✅ |
| H21 | Boot 401 burst on expired session → `ensureFreshAccessToken()` awaited before validate + socket connect; validate timeout 2 s→5 s; TDD ✅ |
| H23 | DB outage masquerading as auth failure → `isDatabaseUnavailableError()`, auth-middleware DB fail = **503**, `respondTokenRefreshError` (DB→503, domain→401, unknown→500), `isDefinitiveAuthFailure` keeps session on transient boot failures; probe **14/14** ✅ |
| H24 | Socket-path same lie + 5 s watchdog login bounce → `socketAuthErrorMessage` (`ServiceUnavailable` = retry, not error), watchdog navigates **by session state**; probe 18/18 ✅ |
| H26 | Hard token expiry → 401 burst + `Token expired` ❌ loop → `tokenHeaderSync.adoptServerToken` consumes `x-refresh-token`; socket connect gated on expiry; TDD 110/110 at the time ✅ |
| M9 | Frontend 401 didn't force-logout → hard logout on definitive 4xx in single-flight path ✅ |
| M10 | Logout wiped `sparkle_device_id` → canonical `userStore.logout()` clears auth keys only ✅ |
| — | `703713c`: 60 s resend cooldown, 2FA await state, email path error, moments ranking iterator bug ✅ |
| — | Auth error classification utilities (`295571d`), friendly auth/chat errors + group membership guard (`38dcac5`), plain-JS email templates incl. 2FA-OTP + capped DB pool (`2eec359`, `3f51391`) ✅ |

---

## §3 API correctness / broken features (all ✅)

| ID | Fix |
|---|---|
| H1 | `GET /users/following` 500 (6 binds vs 4 values) → fixed bind arrays; probe 18/18 ✅ |
| H2 | Marketplace conversations UNION collation mismatch → `COLLATE` fix ✅ |
| H3 | Marketplace messages column-count mismatch → explicit 10-col branches ✅ |
| H4 | `ml.thumbnail` unknown column silently returning `[]` → `ml.image_url` + no-swallow retry ✅ |
| H5 | Prod build calling `localhost:3000` → relative `/api` + same-origin `/socket.io` defaults ✅ |
| H6 | Android WebView shipped no JS bundle → workbox 7.5 MB precache, `cap sync`, canonical root `android/`, stale `frontend/android/` deleted ✅ |
| H8 | 8 broken imports in dead files → 7 dead files deleted + `types/moment.ts` created ✅ |
| H13 | Entire Admin panel 404 → `admin.routes.js` mounted with JSON contracts; live+legacy report aggregation; approve/restrict/purge; announcements fan-out; admin UI routing via `getPostLoginRoute`/`resolveAdminAccess`; role probe 4/4 ✅ |
| — | Confessions `GET /:id` + route + page reads URL param (P0-11) ✅ |
| — | `ab69111` gap-fix round: compression, shared local-first caches, CSRF handler order, P11 remainder, core schema snapshot ✅ |
| — | `31d8eb5` admin API mount; M7 dead modules with nonexistent requires defused; M8 EJS leftovers purged ✅ |

---

## §4 Performance & database (all ✅)

| ID | Fix |
|---|---|
| P1 | Inbox unread = per-chat full scan → 3 indexes + single `GROUP BY` aggregate (equivalence PASS 91 chats) ✅ |
| P2 | Expiry sweep indexed wrong column → `idx_messages_expires_at` (EXPLAIN range) ✅ |
| P3 | `delivery_queue` poll ignoring index → `ORDER BY next_retry_at` forces range + orphan purge (1388 orphans cleared) ✅ |
| P4 | Cursor delta `OR` unusable → 3-branch `UNION ALL` + 2 indexes (equivalence PASS ×3) ✅ |
| P5 | Notifications capture branch full-scan → `idx_cn_recipient` + filter/LIMIT pushdown into both UNION branches (11/11 + 7/7 checks) ✅ |
| P6 | Moments/discover correlated `follows` counts → grouped fc-join in live `discover.service` (no `DEPENDENT SUBQUERY`) ✅ |
| P7 | `SELECT *` overuse → hot auth paths enumerated (19-col lists) ✅ |
| P8 | 12 duplicate indexes dropped live + `init.js` repointed (no recreation) ✅ |
| P9 | Profile scoring full `users` scan → grouped joins + anti-join in `discover.service` ✅ |
| P10 | Boot DDL storm (130 s every restart) → **schema ledger** `utils/database/schemaLedger.js`; first boot idempotent pass, later boots `up-to-date` in 2 s ✅ |
| P11 | Correlated per-row subs closed in live handlers (`Post.js` ×7, search, groups) + denormalized counters + drift backfill 0/0; remainder measured OK at current scale ✅ |
| — | `2ec2544` query-speed round (Redis L1 cache + parallel round-trip rewrites) ✅ |
| — | `d227989` caching round (`REDIS_CACHE_URL` TCP adapter + refresh throttle + queue hardening) ✅ |
| — | M13 delivery-worker error → missing `idx_delivery_message` + throttled orphan DELETE; log clean ✅ |
| — | M15 `migrations/` never applied → schema ledger applies + records every migration file ✅ |
| — | M16 61 core tables had no DDL → `utils/database/core_tables.sql` snapshot (idempotent) ✅ |

---

## §5 Frontend P0s — all 26 fixed (`c56667a` + earlier; spot-verified 2026-10-09)

| # | Item | Evidence |
|---|---|---|
| 1 | `PostDetail` missing `clsx` crash | `PostDetail.tsx:9` ✅ (`187288c`) |
| 2 | `LockedLivePage` `followers` undeclared | declared `:54` ✅ |
| 3 | Input reset unlayered + `border-none` | `border-none`=0, `@layer base` present ✅ |
| 4 | Undefined `marketplace-*` tokens (~300 uses) | `--color-marketplace-*` in `@theme` ✅ |
| 5 | z-index arms race | 11 `--z-*` tokens + literal codemod + overlay bumps ✅ |
| 6 | Duplicate `<MarketplaceModals/>` mount | fixed `c56667a` → **re-introduced by merge `74c8a5b` → re-fixed 2026-10-09 (this session)**; App-only mount verified ✅ |
| 7 | `PostCard` counts liking the post | 7× `stopPropagation` ✅ |
| 8 | `HlsVideoPlayer` rewinds on pause, no poster | active→play/pause only (no `load()`), `poster` prop wired ✅ |
| 9 | `StickerRenderer` drag drift | `x.set(0); y.set(0)` after commit (now `components/stories/`) ✅ |
| 10 | `FollowRequestsOverlay` hover-only controls | component removed → unified `FollowRequests` page (B3) ✅ |
| 11 | Dead route `/confessions/:id` | page reads URL param (3 reads) ✅ |
| 12 | `Help` FAQ hover-only | 3× `onClick` ✅ |
| 13 | `MarketplaceSettings` silent `null` error | `error` state + messages wired ✅ |
| 14 | `MicrophoneShowcase` missing `three` deps | deps resolve, chunk builds ✅ |
| 15 | `ErrorPage` dark crash + global `@keyframes pulse` | 0 `@keyframes pulse` in file ✅ |
| 16 | `NoteEditor` GIF overwrites typed note | GIF click appends to `prev` ✅ |
| 17 | `MessageMoreModal` transform/CSS leak | file no longer in tree ✅ |
| 18 | `VERSION 3.0.2` debug string | 0 hits ✅ |
| 19 | Baked `127.0.0.1` in shipped `dist/` | 0 hits in `dist/assets/*.js` ✅ |
| 20 | Stored XSS via user URLs | see §1 #1 ✅ |
| 21 | `x-refresh-token` not CORS-exposed | see §1 P0-21 ✅ |
| 22 | Renewed/2FA JWT drops `role` | see §1 P0-22 ✅ |
| 23 | Moments rail offsets (H20 regression) | solved via `#root:has(.desktop-sidebar-shell)` padding; **`lg:ml-72` literals forbidden by `sidebarLayout.test.ts` — test green** ✅ |
| 24 | Onboarding slide 2 unreachable | `currentSlide` logic present (11 refs) ✅ |
| 25 | 16 dead links + 5 orphan routes | batch `c56667a` ✅ |
| 26 | `window.open` without `noopener` | see §1 #6 ✅ |

---

## §6 P1 systemic — A1…A9 (all ✅, batch `fb0f1eb`/`678580d` + earlier)

- **A1 tokens/z**: `--header-h`, `--rail-w`, `.pt-safe/.pb-safe/.pl-safe`, 11 `--z-*` values + codemod; `100vh→100dvh`; `interactive-widget=resizes-content` ✅
- **A2 shell**: `H20` rail padding (`#root:has(...)`), Navbar `.desktop-sidebar-shell`, safe-area double-fix in Messages ✅
- **A3 scroll**: `scrollTopTo`/`lockScroll()` off `AppScreen`, PullToRefresh reattached ✅
- **A4 motion/a11y**: `<MotionConfig reducedMotion="user">`, global reduce-motion CSS, `aria-label`/`aria-current` bottom nav, `role="status"` overlays, min-40px targets ✅
- **A5 feedback**: ~60 native `alert/confirm/prompt` → `toast.ts` (`showSuccess/showError/showInfo`) + `confirmDialog/promptDialog` (`dialogStore` + `DialogHost`); 3 redundant toast systems collapsed to **one**; Skeleton/EmptyState/ErrorRetry standardized ✅
- **A6 dead-code sweep**: `App.css`, forward-* set, dead chat modals, `FloatingAIButton`, dead CSS (`.dashboard-grid`), invalid `md:size` props → documented in `DELETIONS.md` ✅ *(audit's "dead" claims for `PrivacySettingsModal`/`Leaderboard` checked → actually live, kept)*
- **A7 fonts/keyframes**: component `<style>` keyframes + Google Fonts hoisted to `index.html`/`index.css` ✅
- **A8 S7 crash debt** + feed-path tsc subset ✅
- **A9 image hygiene**: `no-image.png` in `public/uploads/defaults/`, `ProgressiveImage` lazy-before-spread + no eager override, `PostDetail` min-height placeholder, `Profile` video `muted playsInline preload`, `Avatar` width/height + lazy + size map ✅
- Also: `H19` global `<img>` error fallback + TikTok embed watchdog/retry ✅ · `H22` text-invisible color cascade fixed (`textColorCascade` test) ✅ · `H20` rail overlay solved ✅

---

## §7 P2 structural — B1…B5 + C1 (all ✅)

- **B1 `<PageShell>`**: layout route with `Outlet`; `MOBILE_HEADERLESS_PREFIXES` in Navbar; `.page-shell` CSS (768px+ `padding-left: var(--rail-w)`, mobile under-header `padding-top`); **71 routes** under shell, excluded = auth/dashboard/messages/moments/stories/streams/onboarding/public; duplicate `/explore` deleted; **40 page files** migrated off per-page Navbar/offset math (Messages/Dashboard/Moments keep own Navbar by design) ✅
- **B2 modal a11y**: `hooks/useModalA11y.ts` (Escape capture, Tab focus trap, initial focus, restore, scroll lock) + `ui/ModalShell.tsx`; **44 files / 60 sites** retrofitted with `role="dialog" aria-modal tabIndex={-1}`; stacked-modal suspension in `EditProfileModal` ✅
- **B3 component dedupe**: `marketplace/ListingCard` (variant), `PostHeader`, `MentionAutocomplete` + `useMentionSearch` (ARIA listbox, keyboard nav); deleted `BioMentionRail`, `SettingsModal` (dupe), `MarketplaceSettingsModal` (dupe), `FollowRequestsOverlay`; `PostCard` stats row owns labels + row-level like onClick removed; `types/post.ts` +`share_count`/`top_liker_name` ✅
- **B4 dark-mode strategy**: 2 dead `.dark html` rules removed + `html.dark` bg; dead `.dark .navbar/.card/...` removed; translucent `bg-white/*` excluded from remap; **all utility remaps scoped `.dark.theme-legacy`**; keepers (`.glass`, `.bg-black h*`, inputs, `.animate-shimmer`…); `GlobalThemeProvider` toggles `theme-legacy` per `LEGACY_THEME_ROUTES` (routeToRegex) keyed off `useLocation`; page conversions: Login/Signup/Forgot (dark twins), Invite (27 `dark:`), StorageIntelligencePanel (19), CreateMoment (intentional-dark chrome documented) ✅ · *global `--color-*` flipping proven unsafe in Tailwind v4 — per-component `dark:` only* ✅
- **B5 gamification/camera**: `Leaderboard`, `FloatingRewardWidget`, `MilestoneTracker`, `RewardVault` **deleted** (no `/referral/*` backend existed at the time); `AchievementGrid` conditional; Invite anim counters → real fields; `RewardCarousel` clipping fixed; camera **flash** wired to `torch` capability (hidden when unsupported), pinch zoom kept as digital zoom, dead `'live'` pill removed; orphan `mocks/referralData.ts` deleted ✅
- **C1 Ghost Mode**: `users.is_hidden` **never existed** → `migrations/20261008_add_users_is_hidden.sql` + registered in `schemaLedger.MIGRATION_RUN` + applied live; login/2FA SELECTs + payloads carry `is_hidden` (verified in login JSON); `Settings` fetches `/users/me` on open (covers old sessions) ✅

---

## §8 Merge integration + ops (2026-10-08/09)

- **Merge `2c63d82` (other machine's referral/sparkly branch) resolved in `6aa8adf`** — their branch had *silently reverted* P0-era fixes; restored:
  - **79-page lazy code-split** (they had collapsed to static imports → 5.2 MB bundle) ✅
  - **H21/H23/H24 startup guards** (`ensureFreshAccessToken`, `isDefinitiveAuthFailure`, session-state watchdog) ✅
  - `installGlobalImageFallback()` effect ✅ · `logger` sweep in App/StoryAudioManager ✅ · **`safeHref` XSS guard** in Messages ✅
  - Kept their features: referral backend UX (Invite redesign, Signup `?ref` capture, SparkleHub, InviteLandingPage, chat draft helpers, audio singletons, DB `idleTimeout` 90 s) ✅
  - Dropped deliberately: their `/profile/:id` (shadows `/profile/:username`) + duplicate alias routes ✅
  - P0-6 re-regression caught & re-fixed (see §5 #6) ✅
- **Env/ops 2026-10-09**: `.env` refreshed from user copy (backup `.env.bak-20261009`, `OTA_DEPLOY_TOKEN` preserved); **SMTP verified `Email Service: Ready`** (old 535 gone); backend + Vite started; ⚠️ Firebase Admin still optional-skip — pasted JSON is the *Android app config*, not a service-account key (needs `private_key`/`client_email` from Firebase Console → Service accounts).
- **Git state**: `main` = `senior-sparkle-code` = `6aa8adf` (force-aligned, content identical). `sparkle-textbee-integration` is stale — its content is already inside main; ignore it.

---

## §9 Cleanup / deletions (see `DELETIONS.md` for full log)

- **EJS purge** `9a5a3bd`: 1072 files removed, EJS layer dropped, DB hardened ✅
- **H8 dead files**: `NewChatModal`, `ForwardMessage` + 3 forward parts, `ProgressMilestone`, `services/logger` ✅
- **A6 sweep** + props/CSS + dead keyframes ✅ · **B5 gamification files** + referral mock ✅
- **H12**: both `pnpm-lock.yaml` deleted (npm is canonical) ✅
- **M11 repo hygiene**: tracked junk removed (`android_backup/`, `scratch/`…) ✅
- **Docs corrected**: audit discrepancies recorded (Leaderboard/PrivacySettingsModal live; S4 input reset pre-resolved; "140 native dialogs" stale — A5 converted all to 0 natives) ✅

---

## §10 Still OPEN — next work comes from here only

| Item | What | Note |
|---|---|---|
| **C7** | Social/OTP endpoints issue 7-day JWTs from unverified client input (**login-as-anyone**) | 🔴 **user-deferred 2026-10-07** — do not touch until told |
| **C2 (A.4 lows)** | 5 items: Giphy key in bundle → `/api/giphy` proxy; OTP/email → URL **fragment**; client file validation; TikTok iframe sandbox; `revokeObjectURL` sweep | full spec prepared 2026-10-08 (dispatch aborted) |
| **C3 (A.5)** | 5 orphan routes, ~60 dead controls wire-or-remove, domain conflict (`sparkle.app` vs `sparkleweb.app.vercel.app`), silent form failures (PostDetail, Confessions comments → `showError`) | "140 native dialogs" claim is stale (done) |
| **B6 / tsc** | ~**826** `tsc` errors (was 927; TS2304 = 0) → typecheck-green campaign → `tsc --noEmit` in CI | frozen decision; see H7 |
| **H10/H11** | Render env (`NODE_ENV=production`, `JWT_SECRET`, `DB_POOL_LIMIT`, start cmd) — **user-side** | also Firebase key restriction (M14), Upstash `noeviction` + command burn |
| **Firebase Admin** | needs a real service-account JSON (not the Android config) | optional feature, non-blocking |
| **Defer list** | express 5, multer 2, vite 8, capacitor 8 major upgrades; dev-only `braces` GHSA (upstream unpatched) | by decision |

---

## §11 Docs map

| File | Role |
|---|---|
| `FIXED_PROGRESS.md` (this) | index of ALL fixes + gates + open list |
| `FIXES_NEEDED.md` | detailed issue tracker — ✅ rows = proven fixes with dates/evidence |
| `UI_AUDIT.md` | page/component audit; Pass-8 verdicts **predate `c56667a`** — trust §5 here instead |
| `DELETIONS.md` | everything deleted + why + audit discrepancies |
