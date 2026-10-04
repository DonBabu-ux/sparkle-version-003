# Deletions & Change Record — pre-commit audit

**Date:** 2026-10-04 · **Branch:** `main` @ `82edc92` (2026-06-23, "Errors errors and erros resolved") · **Not yet committed**

This file documents **every file deleted from the repository** as part of the cleanup effort,
before the commit is made, at the user's request. Nothing here is committed yet; the removals
are currently staged in the git index.

## Change-set summary

| State            | Count | Notes                                          |
|------------------|------:|------------------------------------------------|
| Staged deletions | **1072** | `git rm`'d, awaiting commit                |
| Staged additions | **2**    | `services/email-templates.js`, `tools/import-dump.js` |
| Staged mods      | **0**    | (index matches HEAD for all kept files)       |
| Unstaged mods    | **18**   | working-tree edits made after staging; must be `git add`ed before commit |
| Untracked        | **0**    | index and worktree agree for all tracked files |

**Recover anything before/after committing:** `git show 82edc92:<path>` restores any file
listed here (all of them exist in the current HEAD).

---

## 1. EJS server-rendered UI removed — 91 files (this session)

The app was converted from server-side EJS rendering to the React SPA + JSON APIs.

### 1a. `views/` — 73 files (all EJS templates)

| Group | Replaced by |
|---|---|
| Pages (`dashboard`, `feed`-era pages, `profile`, `messages`, `moments`, `marketplace/*`, `admin/*`, `auth/*`, `clubs`, `groups`, `polls`, `streams`, `support`, `search`, `settings`, `notifications`, `lost-found`, `confessions`, `events`, `skill-market*`, etc.) | React pages in `frontend/src/pages/*.tsx` (e.g. `views/marketplace/orders.ejs` → `Orders.tsx`, `views/admin/users.ejs` → `AdminDashboard.tsx`, `views/auth/login.ejs` → `Login.tsx`; full 1:1 match for every page) |
| `views/emails/*.ejs` (4: `welcome`, `reset-password`, `verify-email`, `security-alert`) | **`services/email-templates.js`** — plain-JS renderers, byte-identical to golden renders in `/tmp/email-golden/` (verified 4/4, 2026-10-04 13:11) |
| `views/partials/*.ejs` (18: navbar, sidebar, post-card, modals, head, styles, …) | SPA components under `frontend/src/components/` |
| Junk/backups in views: `views/partials/head.ejs.backup`, `views/partials/marketplace-enhancements.html`, `views/cache-buster.ejs` | none — dead artifacts |
| `views/api-tester.ejs` | removed; `/api-tester` now returns JSON 404 |
| `views/404.ejs`, `views/error.ejs` | JSON error responses (server.js) |

### 1b. `routes/web/` — 17 files (EJS render handlers)

`admin`, `auth`, `campus`, `clubs`, `confession`, `dashboard`, `feed`, `groups`, `index`,
`lost-found`, `marketplace`, `messaging`, `moments`, `profile`, `skill-market`, `social`,
`support` — every one of these only rendered EJS views. Replacements:

- Page-serving → React SPA routes (client router), API stays under `/api/*` (`routes/api/*`).
- `routes/web/marketplace.routes.js`'s `my-shop` / `wishlist` / `orders` page routes →
  JSON endpoints in `routes/api/marketplace.routes.js` (`getWishlist`, orders handlers).
- `routes/web/index.js` (site root redirector) → root `/` now returns JSON pointing to the SPA.

### 1c. Dead API route — 1 file

- `routes/api/privacy.routes.js` — never mounted anywhere (verified zero references);
  the mount line was removed from `routes/api/index.js`.

Also: `package.json` / `package-lock.json` — the `ejs` dependency removed
(`npm ls ejs` empty; repo-wide `require('ejs')` count = 0).

---

## 2. Secrets & credentials removed from the tree — 4 files ⚠️

| File | Note |
|---|---|
| `.env.production` (root) | production env incl. DB + Paystack secrets |
| `frontend/.env.production` | frontend production env |
| `serviceAccountKey.json` | **Firebase service-account key** |
| `vapid.txt` | VAPID web-push keys |

**These files still exist in git history** (they were tracked in earlier commits, including
`82edc92`). Removing them from the tree does **not** un-expose them. **Key rotation is still
recommended** (Firebase service-account key at minimum), tracked as pending item #13.
`.gitignore` was updated to prevent re-adding (`serviceAccountKey.json`, `*.apk`, `*.iml`,
`*.zip`, `android/.gradle/`, credentials block).

---

## 3. Vendored binaries, toolchain & build artifacts — 584 files

| Path | Count | What it was |
|---|---:|---|
| `android_backup/` | 317 | full copy of a generated Android/Capacitor build (incl. `gradle/` cache, bundled `public/assets/*.js`) |
| `gradle/` | 262 | entire Gradle 8.5 distribution (`gradle-8.5/lib/*.jar`, …) committed as source |
| `android/.gradle/` | 2 | Gradle lock/cache files |
| `gradle-8.5-bin.zip` | 1 | Gradle installer zip |
| `Sparkle-v1.0.0.apk` | 1 | built APK |
| `sparkle-version-003.iml` | 1 | IDE module file |
| `database.sqlite`, `data.db` | 2 | old local SQLite DBs (app uses MySQL) |

Actual builds still work from `android/` (project kept — see §7); only the backup copy and
vendored distributions were removed. Toolchain comes from the wrapper/Gradle, not from a
committed distribution.

---

## 4. Duplicate / stale source trees — 165 files

| Path | Count | Why |
|---|---:|---|
| `blueprints/` | 157 | old static prototype (`public/css/*`, `views/*`, icons, images) superseded by `frontend/src` |
| `backend outdated/` | 16 | stale copy of Node backend (controllers/middleware/models/migrations/services) — live code is at repo root; `socket/index.js` and `services/messagePermission.js` require-paths were fixed to match |
| `frontend/dev-dist/` | 3 | generated service-worker build output (`sw.js`, `registerSW.js`, workbox) |
| `frontend/templates/homefeed.txt`, `frontend/chatinput_temp*.txt`, `frontend/replace_target.txt` | 4 | scratch/copy-paste artifacts |

---

## 5. One-off scripts & scratch — 141 files

| Path | Count | Why |
|---|---:|---|
| `scripts/` | 25 | ad-hoc migration/verify scripts (groups, marketplace, orders, stories, …). Their historical `CREATE TABLE`/`ALTER` statements were harvested into `utils/database/init.js` (H1 recovery) before deletion |
| `scratch/` | 54 | throwaway check/fix scripts (`check-*.js`, `align-*.js`, …) |
| `brain/` | 7 | session scratch dir (`brain/<uuid>/scratch/*`) |
| `tmp/` | 4 | `check_db.js`, `diagnose.js`, … |
| root `check-*` / `fix_*` / `migrate-*` / `create-*` / `seed*` / `run_*` / `*-schema.js` etc. | ~40 `.js` | same class of one-off scripts (see Appendix for exact list) |

Live/needed equivalents: `seed-data.js`, `tools/import-dump.js`, `utils/database/init.js`.

---

## 6. Logs, dumps, reports & temp artifacts — ~70 files (root)

54 `.txt` (status dumps, tree listings, lint outputs, feature lists, codebase dumps),
11 `.json` (schema/dump side files, `videos.json`, `db_check.json`), 4 `.tsx` temp copies
(`temp_original_messages*.tsx`, `clean_messages*.tsx`), plus `stashed_changes.diff`,
`git_status.txt`, `log.txt`, and one garbage filename (`e head to see just the first few lines`
— accidental shell-redirect artifact). Full list in the Appendix.

> Category totals: android_backup 317 + gradle 262 + blueprints 157 + root 129 + scratch 54 +
> views 73 + scripts 25 + routes/web 17 + backend outdated 16 + brain 7 + frontend 8 + tmp 4 +
> android 2 + routes/api 1 = **1072** ✓

---

## 7. Added files — 2 (staged)

| File | Purpose |
|---|---|
| `services/email-templates.js` | plain-JS replacements for `views/emails/*.ejs` (§1a) |
| `tools/import-dump.js` | SQL-dump importer (tested: 1035/1035 statements, 84 tables) |

---

## 8. Modified files — 18 (unstaged, must be added before commit)

| File | Change |
|---|---|
| `utils/database/init.js` | H1: `RECOVERED_TABLES` (40 idempotent CREATEs) + `RECOVERED_COLUMNS`/indexes + `repairRecoveredSchemas()`, wired into init |
| `server.js` | view engine & `res.render` removed; JSON 404/errors; `/health`, `/health/db`; `/api-tester` dropped |
| `config/database.js` | pool hardening: clamped `connectionLimit` ≤ 10 (default 5), `queueLimit` 100, `connectTimeout` 10s, `closePool()` on SIGTERM/SIGINT, fixed `getPoolStatus()` |
| `controllers/campus.controller.js` | `endStream` → `UPDATE live_streams … status='ended'` (was `DELETE FROM streams`, nonexistent table) |
| `controllers/marketplace.controller.js` | EJS render exports removed; JSON handlers only |
| `routes/api/index.js` | dropped `privacy.routes` mount; mounted `/api/ai` |
| `routes/api/marketplace.routes.js` | page routes → `getWishlist` / orders JSON endpoints |
| `services/email.service.js` | `ejs.renderFile` → `renderTemplate()` |
| `services/messagePermission.js` | header path fix |
| `socket/index.js` | require `../services/messagePermission` (was `../backend outdated/…`) |
| `package.json` / `package-lock.json` | `ejs` dependency removed |
| `tailwind.config.js` | removed `./views/**/*.ejs` from content globs |
| `config/email.js` | welcome/reset `templateData` adds `dashboardUrl` |
| `seed-data.js` | single `mysql2` connection (was shared pool) + realistic Kenyan name pools |
| `frontend/vite.config.ts` | dev proxy → `http://127.0.0.1:3000` (was Render URL) |
| `prisma/schema.prisma` | datasource `url = env("DATABASE_URL")` |
| `.gitignore` | credentials/build-junk ignore block (§2) |

---

## 9. Kept — pending your decision (NOT deleted)

- `agent.md`, `implementation_plan.md`, `discovery-logic.md`, `moments-production-architecture.md`
- `frontend/android/` (active Capacitor project), `README.md`, `frontend/README.md`,
  `react-moblile-app/*_guide.md`
- `pnpm-lock.yaml`, `frontend/pnpm-lock.yaml` (npm is the canonical package manager — decide
  whether to delete these)

---

## 10. Verification performed

- Server boots clean with no view engine; all pages/API respond as JSON; no `require('ejs')` anywhere; `npm ls ejs` empty
- Email templates byte-identical to golden renders (4/4 vs `/tmp/email-golden/*.html`)
- `node --check` passes on `utils/database/init.js` and touched files; `npm run build` passes (4.1 MB chunk warning only)
- `tools/import-dump.js` dry-run: 1035/1035 statements into local `sparkle` DB
- Index/worktree consistency: `git ls-files -d` = 0 (no half-deleted files); staged = exactly HEAD − 1072 + 2
- Prod schema work (40 recovered tables + 22 columns + 2 indexes) was done **after** a verified
  full backup: `/home/derivo/backups/lilbee_sparkle_remote_20261004_full.sql` (164/164 tables,
  "Dump completed on 2026-10-04 14:08:25")
- ESLint still fails (776 errors, pre-existing) and there are no tests/CI — unchanged by this work

---

*Appendix: complete list of all 1072 deleted paths, grouped by category.*

## Appendix — all 1072 deleted paths (grouped)

### `views/` — 73 files
```
views/404.ejs
views/about.ejs
views/admin/dashboard.ejs
views/admin/logs.ejs
views/admin/reports.ejs
views/admin/users.ejs
views/admin/verifications.ejs
views/api-tester.ejs
views/auth/forgot-password.ejs
views/auth/login.ejs
views/auth/signup.ejs
views/cache-buster.ejs
views/club-detail.ejs
views/clubs.ejs
views/confessions.ejs
views/connect.ejs
views/create-moment.ejs
views/dashboard.ejs
views/emails/reset-password.ejs
views/emails/security-alert.ejs
views/emails/verify-email.ejs
views/emails/welcome.ejs
views/error.ejs
views/events-admin.ejs
views/events.ejs
views/follow-requests.ejs
views/group-detail.ejs
views/group-feed.ejs
views/groups.ejs
views/groups-prototype.ejs
views/hashtag.ejs
views/index.ejs
views/lost-found.ejs
views/marketplace.ejs
views/marketplace/listing-detail.ejs
views/marketplace/my-listings.ejs
views/marketplace/orders.ejs
views/marketplace/sell.ejs
views/marketplace/seller-profile.ejs
views/marketplace/wishlist.ejs
views/messages.ejs
views/moment-detail.ejs
views/moments.ejs
views/notifications.ejs
views/partials/admin-sidebar.ejs
views/partials/bottom-nav.ejs
views/partials/dashboard1-modals.ejs
views/partials/dashboard-modals.ejs
views/partials/head.ejs
views/partials/head.ejs.backup
views/partials/listing-modal.ejs
views/partials/loading-bar.ejs
views/partials/marketplace-enhancements.html
views/partials/navbar.ejs
views/partials/post-card.ejs
views/partials/quick-actions.ejs
views/partials/scripts.ejs
views/partials/share-modal.ejs
views/partials/sidebar.ejs
views/partials/styles.ejs
views/partials/user-card.ejs
views/partials/verified-badge.ejs
views/poll-detail.ejs
views/polls.ejs
views/post.ejs
views/professional-dashboard.ejs
views/profile.ejs
views/search.ejs
views/settings.ejs
views/skill-market.ejs
views/skill-marketplace.ejs
views/streams.ejs
views/support.ejs
```

### `routes/web/` — 17 files
```
routes/web/admin.routes.js
routes/web/auth.routes.js
routes/web/campus.routes.js
routes/web/clubs.routes.js
routes/web/confession.routes.js
routes/web/dashboard.routes.js
routes/web/feed.routes.js
routes/web/groups.routes.js
routes/web/index.js
routes/web/lost-found.routes.js
routes/web/marketplace.routes.js
routes/web/messaging.routes.js
routes/web/moments.routes.js
routes/web/profile.routes.js
routes/web/skill-market.routes.js
routes/web/social.routes.js
routes/web/support.routes.js
```

### `routes/api/` — 1 files
```
routes/api/privacy.routes.js
```

### `android_backup/` — 317 files
```
android_backup/app/capacitor.build.gradle
android_backup/app/src/main/assets/capacitor.config.json
android_backup/app/src/main/assets/capacitor.plugins.json
android_backup/app/src/main/assets/public/assets/avatar-CeXNm2-1.png
android_backup/app/src/main/assets/public/assets/chat_wallpaper.png
android_backup/app/src/main/assets/public/assets/chat_wallpaper_wide.png
android_backup/app/src/main/assets/public/assets/index-BO6CZHM4.js
android_backup/app/src/main/assets/public/assets/index-BxeS8O1B.css
android_backup/app/src/main/assets/public/assets/pwa-action-sheet.entry-C3LHJq7a.js
android_backup/app/src/main/assets/public/assets/pwa-camera.entry-DS9GjrnF.js
android_backup/app/src/main/assets/public/assets/pwa-camera-modal.entry-YK_QDr4p.js
android_backup/app/src/main/assets/public/assets/pwa-camera-modal-instance.entry-CSMbuoJH.js
android_backup/app/src/main/assets/public/assets/pwa-toast.entry-DMb0lgZb.js
android_backup/app/src/main/assets/public/assets/web-CFSurpDq.js
android_backup/app/src/main/assets/public/assets/web-DAFtM6e0.js
android_backup/app/src/main/assets/public/auth-bg.png
android_backup/app/src/main/assets/public/cordova.js
android_backup/app/src/main/assets/public/cordova_plugins.js
android_backup/app/src/main/assets/public/favicon.svg
android_backup/app/src/main/assets/public/icons.svg
android_backup/app/src/main/assets/public/index.html
android_backup/app/src/main/assets/public/logo.png
android_backup/app/src/main/assets/public/manifest.webmanifest
android_backup/app/src/main/assets/public/registerSW.js
android_backup/app/src/main/assets/public/sw.js
android_backup/app/src/main/assets/public/uploads/avatars/default.png
android_backup/app/src/main/assets/public/uploads/groups/default.png
android_backup/app/src/main/assets/public/uploads/marketplace/default.png
android_backup/app/src/main/assets/public/workbox-58bd4dca.js
android_backup/app/src/main/java/com/example/app/MainActivity.java
android_backup/app/src/main/java/com/example/app/PrivacyProtectionPlugin.java
android_backup/app/src/main/res/xml/config.xml
android_backup/capacitor-cordova-android-plugins/build.gradle
android_backup/capacitor-cordova-android-plugins/cordova.variables.gradle
android_backup/capacitor-cordova-android-plugins/.gradle/8.9/checksums/checksums.lock
android_backup/capacitor-cordova-android-plugins/.gradle/8.9/checksums/md5-checksums.bin
android_backup/capacitor-cordova-android-plugins/.gradle/8.9/checksums/sha1-checksums.bin
android_backup/capacitor-cordova-android-plugins/.gradle/8.9/dependencies-accessors/gc.properties
android_backup/capacitor-cordova-android-plugins/.gradle/8.9/executionHistory/executionHistory.lock
android_backup/capacitor-cordova-android-plugins/.gradle/8.9/fileChanges/last-build.bin
android_backup/capacitor-cordova-android-plugins/.gradle/8.9/fileHashes/fileHashes.lock
android_backup/capacitor-cordova-android-plugins/.gradle/8.9/gc.properties
android_backup/capacitor-cordova-android-plugins/.gradle/buildOutputCleanup/buildOutputCleanup.lock
android_backup/capacitor-cordova-android-plugins/.gradle/buildOutputCleanup/cache.properties
android_backup/capacitor-cordova-android-plugins/.gradle/vcs-1/gc.properties
android_backup/capacitor-cordova-android-plugins/src/main/AndroidManifest.xml
android_backup/capacitor-cordova-android-plugins/src/main/java/.gitkeep
android_backup/capacitor-cordova-android-plugins/src/main/res/.gitkeep
android_backup/capacitor.settings.gradle
android_backup/.gradle/8.14.3/fileChanges/last-build.bin
android_backup/.gradle/8.14.3/fileHashes/fileHashes.lock
android_backup/.gradle/8.14.3/gc.properties
android_backup/.gradle/buildOutputCleanup/buildOutputCleanup.lock
android_backup/.gradle/buildOutputCleanup/cache.properties
android_backup/gradle/gradle-8.5/bin/gradle
android_backup/gradle/gradle-8.5/bin/gradle.bat
android_backup/gradle/gradle-8.5/init.d/readme.txt
android_backup/gradle/gradle-8.5/lib/agents/gradle-instrumentation-agent-8.5.jar
android_backup/gradle/gradle-8.5/lib/annotations-24.0.1.jar
android_backup/gradle/gradle-8.5/lib/ant-1.10.13.jar
android_backup/gradle/gradle-8.5/lib/ant-antlr-1.10.12.jar
android_backup/gradle/gradle-8.5/lib/ant-junit-1.10.12.jar
android_backup/gradle/gradle-8.5/lib/ant-launcher-1.10.13.jar
android_backup/gradle/gradle-8.5/lib/antlr4-runtime-4.7.2.jar
android_backup/gradle/gradle-8.5/lib/asm-9.5.jar
android_backup/gradle/gradle-8.5/lib/asm-commons-9.5.jar
android_backup/gradle/gradle-8.5/lib/asm-tree-9.5.jar
android_backup/gradle/gradle-8.5/lib/commons-compress-1.21.jar
android_backup/gradle/gradle-8.5/lib/commons-io-2.11.0.jar
android_backup/gradle/gradle-8.5/lib/commons-lang-2.6.jar
android_backup/gradle/gradle-8.5/lib/failureaccess-1.0.1.jar
android_backup/gradle/gradle-8.5/lib/fastutil-8.5.2-min.jar
android_backup/gradle/gradle-8.5/lib/file-events-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/file-events-linux-aarch64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/file-events-linux-amd64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/file-events-osx-aarch64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/file-events-osx-amd64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/file-events-windows-amd64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/file-events-windows-amd64-min-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/file-events-windows-i386-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/file-events-windows-i386-min-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/gradle-api-metadata-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-base-annotations-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-base-services-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-base-services-groovy-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-bootstrap-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-build-cache-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-build-cache-base-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-build-cache-packaging-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-build-events-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-build-operations-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-build-option-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-cli-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-core-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-core-api-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-enterprise-logging-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-enterprise-operations-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-enterprise-workers-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-execution-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-file-collections-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-files-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-file-temp-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-file-watching-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-functional-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-hashing-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-installation-beacon-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-internal-instrumentation-api-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-jvm-services-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-kotlin-dsl-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-kotlin-dsl-extensions-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-kotlin-dsl-shared-runtime-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-kotlin-dsl-tooling-models-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-launcher-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-logging-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-logging-api-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-messaging-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-model-core-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-model-groovy-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-native-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-normalization-java-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-persistent-cache-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-problems-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-problems-api-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-process-services-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-resources-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-runtime-api-info-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-snapshots-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-tooling-api-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-worker-processes-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-worker-services-8.5.jar
android_backup/gradle/gradle-8.5/lib/gradle-wrapper-shared-8.5.jar
android_backup/gradle/gradle-8.5/lib/groovy-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-ant-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-astbuilder-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-console-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-datetime-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-dateutil-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-docgenerator-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-groovydoc-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-json-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-nio-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-sql-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-swing-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-templates-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-test-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/groovy-xml-3.0.17.jar
android_backup/gradle/gradle-8.5/lib/gson-2.8.9.jar
android_backup/gradle/gradle-8.5/lib/guava-32.1.2-jre.jar
android_backup/gradle/gradle-8.5/lib/h2-2.2.220.jar
android_backup/gradle/gradle-8.5/lib/hamcrest-core-1.3.jar
android_backup/gradle/gradle-8.5/lib/HikariCP-4.0.3.jar
android_backup/gradle/gradle-8.5/lib/jansi-1.18.jar
android_backup/gradle/gradle-8.5/lib/javaparser-core-3.17.0.jar
android_backup/gradle/gradle-8.5/lib/javax.inject-1.jar
android_backup/gradle/gradle-8.5/lib/jcl-over-slf4j-1.7.30.jar
android_backup/gradle/gradle-8.5/lib/jsr305-3.0.2.jar
android_backup/gradle/gradle-8.5/lib/jul-to-slf4j-1.7.30.jar
android_backup/gradle/gradle-8.5/lib/junit-4.13.2.jar
android_backup/gradle/gradle-8.5/lib/kotlin-assignment-compiler-plugin-embeddable-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-compiler-embeddable-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-daemon-embeddable-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-reflect-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-sam-with-receiver-compiler-plugin-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-scripting-common-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-scripting-compiler-embeddable-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-scripting-compiler-impl-embeddable-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-scripting-jvm-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-scripting-jvm-host-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-script-runtime-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlin-stdlib-1.9.20.jar
android_backup/gradle/gradle-8.5/lib/kotlinx-metadata-jvm-0.5.0.jar
android_backup/gradle/gradle-8.5/lib/kryo-2.24.0.jar
android_backup/gradle/gradle-8.5/lib/log4j-over-slf4j-1.7.30.jar
android_backup/gradle/gradle-8.5/lib/minlog-1.2.jar
android_backup/gradle/gradle-8.5/lib/native-platform-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-freebsd-amd64-libcpp-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-linux-aarch64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-linux-aarch64-ncurses5-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-linux-aarch64-ncurses6-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-linux-amd64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-linux-amd64-ncurses5-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-linux-amd64-ncurses6-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-osx-aarch64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-osx-amd64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-windows-amd64-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-windows-amd64-min-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-windows-i386-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/native-platform-windows-i386-min-0.22-milestone-25.jar
android_backup/gradle/gradle-8.5/lib/objenesis-2.6.jar
android_backup/gradle/gradle-8.5/lib/plugins/aws-java-sdk-core-1.12.365.jar
android_backup/gradle/gradle-8.5/lib/plugins/aws-java-sdk-kms-1.12.365.jar
android_backup/gradle/gradle-8.5/lib/plugins/aws-java-sdk-s3-1.12.365.jar
android_backup/gradle/gradle-8.5/lib/plugins/aws-java-sdk-sts-1.12.365.jar
android_backup/gradle/gradle-8.5/lib/plugins/bcpg-jdk15on-1.68.jar
android_backup/gradle/gradle-8.5/lib/plugins/bcpkix-jdk15on-1.68.jar
android_backup/gradle/gradle-8.5/lib/plugins/bcprov-jdk15on-1.68.jar
android_backup/gradle/gradle-8.5/lib/plugins/bsh-2.0b6.jar
android_backup/gradle/gradle-8.5/lib/plugins/capsule-0.6.3.jar
android_backup/gradle/gradle-8.5/lib/plugins/commons-codec-1.15.jar
android_backup/gradle/gradle-8.5/lib/plugins/dd-plist-1.21.jar
android_backup/gradle/gradle-8.5/lib/plugins/google-api-client-1.34.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/google-api-services-storage-v1-rev20220705-1.32.1.jar
android_backup/gradle/gradle-8.5/lib/plugins/google-http-client-1.42.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/google-http-client-apache-v2-1.42.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/google-http-client-gson-1.42.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/google-oauth-client-1.34.1.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-antlr-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-base-ide-plugins-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-build-cache-http-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-build-init-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-build-profile-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-code-quality-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-composite-builds-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-configuration-cache-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-dependency-management-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-diagnostics-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-ear-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-enterprise-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-ide-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-ide-native-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-ide-plugins-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-instrumentation-declarations-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-ivy-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-jacoco-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-java-compiler-plugin-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-java-platform-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-kotlin-dsl-provider-plugins-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-kotlin-dsl-tooling-builders-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-language-groovy-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-language-java-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-language-jvm-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-language-native-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-maven-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-platform-base-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-platform-jvm-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-platform-native-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugin-development-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-distribution-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-groovy-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-java-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-java-base-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-jvm-test-fixtures-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-jvm-test-suite-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-test-report-aggregation-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugins-version-catalog-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-plugin-use-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-publish-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-reporting-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-resources-gcs-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-resources-http-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-resources-s3-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-resources-sftp-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-scala-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-security-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-signing-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-testing-base-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-testing-junit-platform-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-testing-jvm-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-testing-jvm-infrastructure-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-testing-native-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-test-kit-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-test-suites-base-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-toolchains-jvm-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-tooling-api-builders-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-tooling-native-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-version-control-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-war-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-workers-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/gradle-wrapper-8.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/grpc-context-1.27.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/httpclient-4.5.13.jar
android_backup/gradle/gradle-8.5/lib/plugins/httpcore-4.4.14.jar
android_backup/gradle/gradle-8.5/lib/plugins/ion-java-1.0.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/ivy-2.5.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/jackson-annotations-2.15.3.jar
android_backup/gradle/gradle-8.5/lib/plugins/jackson-core-2.15.3.jar
android_backup/gradle/gradle-8.5/lib/plugins/jackson-databind-2.15.3.jar
android_backup/gradle/gradle-8.5/lib/plugins/jakarta.activation-2.0.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/jakarta.xml.bind-api-3.0.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/jatl-0.2.3.jar
android_backup/gradle/gradle-8.5/lib/plugins/jaxb-core-3.0.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/jaxb-impl-3.0.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/jcifs-1.3.17.jar
android_backup/gradle/gradle-8.5/lib/plugins/jcommander-1.78.jar
android_backup/gradle/gradle-8.5/lib/plugins/jmespath-java-1.12.365.jar
android_backup/gradle/gradle-8.5/lib/plugins/joda-time-2.10.4.jar
android_backup/gradle/gradle-8.5/lib/plugins/jsch-0.1.55.jar
android_backup/gradle/gradle-8.5/lib/plugins/jsoup-1.15.3.jar
android_backup/gradle/gradle-8.5/lib/plugins/junit-platform-commons-1.8.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/junit-platform-engine-1.8.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/junit-platform-launcher-1.8.2.jar
android_backup/gradle/gradle-8.5/lib/plugins/jzlib-1.1.3.jar
android_backup/gradle/gradle-8.5/lib/plugins/maven-builder-support-3.9.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/maven-model-3.9.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/maven-repository-metadata-3.9.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/maven-settings-3.9.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/maven-settings-builder-3.9.5.jar
android_backup/gradle/gradle-8.5/lib/plugins/opencensus-api-0.31.1.jar
android_backup/gradle/gradle-8.5/lib/plugins/opencensus-contrib-http-util-0.31.1.jar
android_backup/gradle/gradle-8.5/lib/plugins/opentest4j-1.2.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/org.eclipse.jgit-5.7.0.202003110725-r.jar
android_backup/gradle/gradle-8.5/lib/plugins/plexus-cipher-2.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/plexus-interpolation-1.26.jar
android_backup/gradle/gradle-8.5/lib/plugins/plexus-sec-dispatcher-2.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/plexus-utils-3.5.1.jar
android_backup/gradle/gradle-8.5/lib/plugins/snakeyaml-2.0.jar
android_backup/gradle/gradle-8.5/lib/plugins/testng-6.3.1.jar
android_backup/gradle/gradle-8.5/lib/qdox-1.12.1.jar
android_backup/gradle/gradle-8.5/lib/slf4j-api-1.7.30.jar
android_backup/gradle/gradle-8.5/lib/tomlj-1.0.0.jar
android_backup/gradle/gradle-8.5/lib/trove4j-1.0.20200330.jar
android_backup/gradle/gradle-8.5/lib/xml-apis-1.4.01.jar
android_backup/gradle/gradle-8.5/LICENSE
android_backup/gradle/gradle-8.5/NOTICE
android_backup/gradle/gradle-8.5/README
android_backup/local.properties
```

### `gradle/` — 262 files
```
gradle/gradle-8.5/bin/gradle
gradle/gradle-8.5/bin/gradle.bat
gradle/gradle-8.5/init.d/readme.txt
gradle/gradle-8.5/lib/agents/gradle-instrumentation-agent-8.5.jar
gradle/gradle-8.5/lib/annotations-24.0.1.jar
gradle/gradle-8.5/lib/ant-1.10.13.jar
gradle/gradle-8.5/lib/ant-antlr-1.10.12.jar
gradle/gradle-8.5/lib/ant-junit-1.10.12.jar
gradle/gradle-8.5/lib/ant-launcher-1.10.13.jar
gradle/gradle-8.5/lib/antlr4-runtime-4.7.2.jar
gradle/gradle-8.5/lib/asm-9.5.jar
gradle/gradle-8.5/lib/asm-commons-9.5.jar
gradle/gradle-8.5/lib/asm-tree-9.5.jar
gradle/gradle-8.5/lib/commons-compress-1.21.jar
gradle/gradle-8.5/lib/commons-io-2.11.0.jar
gradle/gradle-8.5/lib/commons-lang-2.6.jar
gradle/gradle-8.5/lib/failureaccess-1.0.1.jar
gradle/gradle-8.5/lib/fastutil-8.5.2-min.jar
gradle/gradle-8.5/lib/file-events-0.22-milestone-25.jar
gradle/gradle-8.5/lib/file-events-linux-aarch64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/file-events-linux-amd64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/file-events-osx-aarch64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/file-events-osx-amd64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/file-events-windows-amd64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/file-events-windows-amd64-min-0.22-milestone-25.jar
gradle/gradle-8.5/lib/file-events-windows-i386-0.22-milestone-25.jar
gradle/gradle-8.5/lib/file-events-windows-i386-min-0.22-milestone-25.jar
gradle/gradle-8.5/lib/gradle-api-metadata-8.5.jar
gradle/gradle-8.5/lib/gradle-base-annotations-8.5.jar
gradle/gradle-8.5/lib/gradle-base-services-8.5.jar
gradle/gradle-8.5/lib/gradle-base-services-groovy-8.5.jar
gradle/gradle-8.5/lib/gradle-bootstrap-8.5.jar
gradle/gradle-8.5/lib/gradle-build-cache-8.5.jar
gradle/gradle-8.5/lib/gradle-build-cache-base-8.5.jar
gradle/gradle-8.5/lib/gradle-build-cache-packaging-8.5.jar
gradle/gradle-8.5/lib/gradle-build-events-8.5.jar
gradle/gradle-8.5/lib/gradle-build-operations-8.5.jar
gradle/gradle-8.5/lib/gradle-build-option-8.5.jar
gradle/gradle-8.5/lib/gradle-cli-8.5.jar
gradle/gradle-8.5/lib/gradle-core-8.5.jar
gradle/gradle-8.5/lib/gradle-core-api-8.5.jar
gradle/gradle-8.5/lib/gradle-enterprise-logging-8.5.jar
gradle/gradle-8.5/lib/gradle-enterprise-operations-8.5.jar
gradle/gradle-8.5/lib/gradle-enterprise-workers-8.5.jar
gradle/gradle-8.5/lib/gradle-execution-8.5.jar
gradle/gradle-8.5/lib/gradle-file-collections-8.5.jar
gradle/gradle-8.5/lib/gradle-files-8.5.jar
gradle/gradle-8.5/lib/gradle-file-temp-8.5.jar
gradle/gradle-8.5/lib/gradle-file-watching-8.5.jar
gradle/gradle-8.5/lib/gradle-functional-8.5.jar
gradle/gradle-8.5/lib/gradle-hashing-8.5.jar
gradle/gradle-8.5/lib/gradle-installation-beacon-8.5.jar
gradle/gradle-8.5/lib/gradle-internal-instrumentation-api-8.5.jar
gradle/gradle-8.5/lib/gradle-jvm-services-8.5.jar
gradle/gradle-8.5/lib/gradle-kotlin-dsl-8.5.jar
gradle/gradle-8.5/lib/gradle-kotlin-dsl-extensions-8.5.jar
gradle/gradle-8.5/lib/gradle-kotlin-dsl-shared-runtime-8.5.jar
gradle/gradle-8.5/lib/gradle-kotlin-dsl-tooling-models-8.5.jar
gradle/gradle-8.5/lib/gradle-launcher-8.5.jar
gradle/gradle-8.5/lib/gradle-logging-8.5.jar
gradle/gradle-8.5/lib/gradle-logging-api-8.5.jar
gradle/gradle-8.5/lib/gradle-messaging-8.5.jar
gradle/gradle-8.5/lib/gradle-model-core-8.5.jar
gradle/gradle-8.5/lib/gradle-model-groovy-8.5.jar
gradle/gradle-8.5/lib/gradle-native-8.5.jar
gradle/gradle-8.5/lib/gradle-normalization-java-8.5.jar
gradle/gradle-8.5/lib/gradle-persistent-cache-8.5.jar
gradle/gradle-8.5/lib/gradle-problems-8.5.jar
gradle/gradle-8.5/lib/gradle-problems-api-8.5.jar
gradle/gradle-8.5/lib/gradle-process-services-8.5.jar
gradle/gradle-8.5/lib/gradle-resources-8.5.jar
gradle/gradle-8.5/lib/gradle-runtime-api-info-8.5.jar
gradle/gradle-8.5/lib/gradle-snapshots-8.5.jar
gradle/gradle-8.5/lib/gradle-tooling-api-8.5.jar
gradle/gradle-8.5/lib/gradle-worker-processes-8.5.jar
gradle/gradle-8.5/lib/gradle-worker-services-8.5.jar
gradle/gradle-8.5/lib/gradle-wrapper-shared-8.5.jar
gradle/gradle-8.5/lib/groovy-3.0.17.jar
gradle/gradle-8.5/lib/groovy-ant-3.0.17.jar
gradle/gradle-8.5/lib/groovy-astbuilder-3.0.17.jar
gradle/gradle-8.5/lib/groovy-console-3.0.17.jar
gradle/gradle-8.5/lib/groovy-datetime-3.0.17.jar
gradle/gradle-8.5/lib/groovy-dateutil-3.0.17.jar
gradle/gradle-8.5/lib/groovy-docgenerator-3.0.17.jar
gradle/gradle-8.5/lib/groovy-groovydoc-3.0.17.jar
gradle/gradle-8.5/lib/groovy-json-3.0.17.jar
gradle/gradle-8.5/lib/groovy-nio-3.0.17.jar
gradle/gradle-8.5/lib/groovy-sql-3.0.17.jar
gradle/gradle-8.5/lib/groovy-swing-3.0.17.jar
gradle/gradle-8.5/lib/groovy-templates-3.0.17.jar
gradle/gradle-8.5/lib/groovy-test-3.0.17.jar
gradle/gradle-8.5/lib/groovy-xml-3.0.17.jar
gradle/gradle-8.5/lib/gson-2.8.9.jar
gradle/gradle-8.5/lib/guava-32.1.2-jre.jar
gradle/gradle-8.5/lib/h2-2.2.220.jar
gradle/gradle-8.5/lib/hamcrest-core-1.3.jar
gradle/gradle-8.5/lib/HikariCP-4.0.3.jar
gradle/gradle-8.5/lib/jansi-1.18.jar
gradle/gradle-8.5/lib/javaparser-core-3.17.0.jar
gradle/gradle-8.5/lib/javax.inject-1.jar
gradle/gradle-8.5/lib/jcl-over-slf4j-1.7.30.jar
gradle/gradle-8.5/lib/jsr305-3.0.2.jar
gradle/gradle-8.5/lib/jul-to-slf4j-1.7.30.jar
gradle/gradle-8.5/lib/junit-4.13.2.jar
gradle/gradle-8.5/lib/kotlin-assignment-compiler-plugin-embeddable-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-compiler-embeddable-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-daemon-embeddable-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-reflect-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-sam-with-receiver-compiler-plugin-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-scripting-common-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-scripting-compiler-embeddable-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-scripting-compiler-impl-embeddable-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-scripting-jvm-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-scripting-jvm-host-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-script-runtime-1.9.20.jar
gradle/gradle-8.5/lib/kotlin-stdlib-1.9.20.jar
gradle/gradle-8.5/lib/kotlinx-metadata-jvm-0.5.0.jar
gradle/gradle-8.5/lib/kryo-2.24.0.jar
gradle/gradle-8.5/lib/log4j-over-slf4j-1.7.30.jar
gradle/gradle-8.5/lib/minlog-1.2.jar
gradle/gradle-8.5/lib/native-platform-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-freebsd-amd64-libcpp-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-linux-aarch64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-linux-aarch64-ncurses5-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-linux-aarch64-ncurses6-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-linux-amd64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-linux-amd64-ncurses5-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-linux-amd64-ncurses6-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-osx-aarch64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-osx-amd64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-windows-amd64-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-windows-amd64-min-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-windows-i386-0.22-milestone-25.jar
gradle/gradle-8.5/lib/native-platform-windows-i386-min-0.22-milestone-25.jar
gradle/gradle-8.5/lib/objenesis-2.6.jar
gradle/gradle-8.5/lib/plugins/aws-java-sdk-core-1.12.365.jar
gradle/gradle-8.5/lib/plugins/aws-java-sdk-kms-1.12.365.jar
gradle/gradle-8.5/lib/plugins/aws-java-sdk-s3-1.12.365.jar
gradle/gradle-8.5/lib/plugins/aws-java-sdk-sts-1.12.365.jar
gradle/gradle-8.5/lib/plugins/bcpg-jdk15on-1.68.jar
gradle/gradle-8.5/lib/plugins/bcpkix-jdk15on-1.68.jar
gradle/gradle-8.5/lib/plugins/bcprov-jdk15on-1.68.jar
gradle/gradle-8.5/lib/plugins/bsh-2.0b6.jar
gradle/gradle-8.5/lib/plugins/capsule-0.6.3.jar
gradle/gradle-8.5/lib/plugins/commons-codec-1.15.jar
gradle/gradle-8.5/lib/plugins/dd-plist-1.21.jar
gradle/gradle-8.5/lib/plugins/google-api-client-1.34.0.jar
gradle/gradle-8.5/lib/plugins/google-api-services-storage-v1-rev20220705-1.32.1.jar
gradle/gradle-8.5/lib/plugins/google-http-client-1.42.2.jar
gradle/gradle-8.5/lib/plugins/google-http-client-apache-v2-1.42.2.jar
gradle/gradle-8.5/lib/plugins/google-http-client-gson-1.42.2.jar
gradle/gradle-8.5/lib/plugins/google-oauth-client-1.34.1.jar
gradle/gradle-8.5/lib/plugins/gradle-antlr-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-base-ide-plugins-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-build-cache-http-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-build-init-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-build-profile-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-code-quality-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-composite-builds-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-configuration-cache-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-dependency-management-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-diagnostics-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-ear-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-enterprise-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-ide-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-ide-native-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-ide-plugins-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-instrumentation-declarations-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-ivy-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-jacoco-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-java-compiler-plugin-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-java-platform-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-kotlin-dsl-provider-plugins-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-kotlin-dsl-tooling-builders-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-language-groovy-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-language-java-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-language-jvm-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-language-native-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-maven-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-platform-base-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-platform-jvm-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-platform-native-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugin-development-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-distribution-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-groovy-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-java-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-java-base-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-jvm-test-fixtures-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-jvm-test-suite-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-test-report-aggregation-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugins-version-catalog-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-plugin-use-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-publish-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-reporting-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-resources-gcs-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-resources-http-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-resources-s3-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-resources-sftp-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-scala-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-security-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-signing-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-testing-base-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-testing-junit-platform-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-testing-jvm-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-testing-jvm-infrastructure-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-testing-native-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-test-kit-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-test-suites-base-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-toolchains-jvm-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-tooling-api-builders-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-tooling-native-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-version-control-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-war-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-workers-8.5.jar
gradle/gradle-8.5/lib/plugins/gradle-wrapper-8.5.jar
gradle/gradle-8.5/lib/plugins/grpc-context-1.27.2.jar
gradle/gradle-8.5/lib/plugins/httpclient-4.5.13.jar
gradle/gradle-8.5/lib/plugins/httpcore-4.4.14.jar
gradle/gradle-8.5/lib/plugins/ion-java-1.0.2.jar
gradle/gradle-8.5/lib/plugins/ivy-2.5.2.jar
gradle/gradle-8.5/lib/plugins/jackson-annotations-2.15.3.jar
gradle/gradle-8.5/lib/plugins/jackson-core-2.15.3.jar
gradle/gradle-8.5/lib/plugins/jackson-databind-2.15.3.jar
gradle/gradle-8.5/lib/plugins/jakarta.activation-2.0.0.jar
gradle/gradle-8.5/lib/plugins/jakarta.xml.bind-api-3.0.0.jar
gradle/gradle-8.5/lib/plugins/jatl-0.2.3.jar
gradle/gradle-8.5/lib/plugins/jaxb-core-3.0.0.jar
gradle/gradle-8.5/lib/plugins/jaxb-impl-3.0.0.jar
gradle/gradle-8.5/lib/plugins/jcifs-1.3.17.jar
gradle/gradle-8.5/lib/plugins/jcommander-1.78.jar
gradle/gradle-8.5/lib/plugins/jmespath-java-1.12.365.jar
gradle/gradle-8.5/lib/plugins/joda-time-2.10.4.jar
gradle/gradle-8.5/lib/plugins/jsch-0.1.55.jar
gradle/gradle-8.5/lib/plugins/jsoup-1.15.3.jar
gradle/gradle-8.5/lib/plugins/junit-platform-commons-1.8.2.jar
gradle/gradle-8.5/lib/plugins/junit-platform-engine-1.8.2.jar
gradle/gradle-8.5/lib/plugins/junit-platform-launcher-1.8.2.jar
gradle/gradle-8.5/lib/plugins/jzlib-1.1.3.jar
gradle/gradle-8.5/lib/plugins/maven-builder-support-3.9.5.jar
gradle/gradle-8.5/lib/plugins/maven-model-3.9.5.jar
gradle/gradle-8.5/lib/plugins/maven-repository-metadata-3.9.5.jar
gradle/gradle-8.5/lib/plugins/maven-settings-3.9.5.jar
gradle/gradle-8.5/lib/plugins/maven-settings-builder-3.9.5.jar
gradle/gradle-8.5/lib/plugins/opencensus-api-0.31.1.jar
gradle/gradle-8.5/lib/plugins/opencensus-contrib-http-util-0.31.1.jar
gradle/gradle-8.5/lib/plugins/opentest4j-1.2.0.jar
gradle/gradle-8.5/lib/plugins/org.eclipse.jgit-5.7.0.202003110725-r.jar
gradle/gradle-8.5/lib/plugins/plexus-cipher-2.0.jar
gradle/gradle-8.5/lib/plugins/plexus-interpolation-1.26.jar
gradle/gradle-8.5/lib/plugins/plexus-sec-dispatcher-2.0.jar
gradle/gradle-8.5/lib/plugins/plexus-utils-3.5.1.jar
gradle/gradle-8.5/lib/plugins/snakeyaml-2.0.jar
gradle/gradle-8.5/lib/plugins/testng-6.3.1.jar
gradle/gradle-8.5/lib/qdox-1.12.1.jar
gradle/gradle-8.5/lib/slf4j-api-1.7.30.jar
gradle/gradle-8.5/lib/tomlj-1.0.0.jar
gradle/gradle-8.5/lib/trove4j-1.0.20200330.jar
gradle/gradle-8.5/lib/xml-apis-1.4.01.jar
gradle/gradle-8.5/LICENSE
gradle/gradle-8.5/NOTICE
gradle/gradle-8.5/README
```

### `android/` — 2 files
```
android/.gradle/buildOutputCleanup/buildOutputCleanup.lock
android/.gradle/buildOutputCleanup/cache.properties
```

### `blueprints/` — 157 files
```
blueprints/public/css/chat-themes.css
blueprints/public/css/components.css
blueprints/public/css/dashboard-premium.css
blueprints/public/css/groups-proto.css
blueprints/public/css/marketplace.css
blueprints/public/css/messaging-v3.css
blueprints/public/css/post-card.css
blueprints/public/css/responsive-overhaul.css
blueprints/public/css/style.css
blueprints/public/css/support.css
blueprints/public/css/tailwind.css
blueprints/public/favicon.ico
blueprints/public/icons/icon-192.png
blueprints/public/icons/icon-512.png
blueprints/public/images/default-avatar.jpg
blueprints/public/images/default-avatar.png
blueprints/public/images/default-listing.jpg
blueprints/public/images/logo.png
blueprints/public/images/mock-listing-1.jpg
blueprints/public/images/mock-listing-2.jpg
blueprints/public/images/mock-listing-3.jpg
blueprints/public/images/mock-listing-4.jpg
blueprints/public/images/mock-listing-5.jpg
blueprints/public/images/video-placeholder.jpg
blueprints/public/index.html
blueprints/public/js/apiClient.js
blueprints/public/js/authAPI.js
blueprints/public/js/chat-theme-manager.js
blueprints/public/js/dashboardAPI.js
blueprints/public/js/dashboard-interactions.js
blueprints/public/js/dataManager.js
blueprints/public/js/dynamicPatch/core/api-client.js
blueprints/public/js/dynamicPatch/core/config.js
blueprints/public/js/dynamicPatch/core/error-handler.js
blueprints/public/js/dynamicPatch/core/utils.js
blueprints/public/js/dynamicPatch/data/initialization.js
blueprints/public/js/dynamicPatch/data/sync.js
blueprints/public/js/dynamicPatch/features/confessions.js
blueprints/public/js/dynamicPatch/features/events.js
blueprints/public/js/dynamicPatch/features/feed.js
blueprints/public/js/dynamicPatch/features/groups.js
blueprints/public/js/dynamicPatch/features/lost-found.js
blueprints/public/js/dynamicPatch/features/marketplace.js
blueprints/public/js/dynamicPatch/features/messages.js
blueprints/public/js/dynamicPatch/features/moments.js
blueprints/public/js/dynamicPatch/features/polls.js
blueprints/public/js/dynamicPatch/features/profile.js
blueprints/public/js/dynamicPatch/features/search.js
blueprints/public/js/dynamicPatch/features/skill-market.js
blueprints/public/js/dynamicPatch/features/stories.js
blueprints/public/js/dynamicPatch/features/streams.js
blueprints/public/js/dynamicPatch/features/suggestions.js
blueprints/public/js/dynamicPatch/index.js
blueprints/public/js/dynamicPatch/ui/fab-button.js
blueprints/public/js/dynamicPatch/ui/hubs.js
blueprints/public/js/dynamicPatch/ui/mobile-fixes.js
blueprints/public/js/dynamicPatch/ui/modals.js
blueprints/public/js/dynamicPatch/ui/notifications.js
blueprints/public/js/dynamicPatch/ui/post-menu.js
blueprints/public/js/firebase-realtime.js
blueprints/public/js/groups-mock-data.js
blueprints/public/js/groups-proto.js
blueprints/public/js/marketplace-enhancements.js
blueprints/public/js/marketplace-socket.js
blueprints/public/js/messaging-v3.js
blueprints/public/js/notifications.js
blueprints/public/js/profileEditIntegration.js
blueprints/public/js/script.js
blueprints/public/js/service-worker.js
blueprints/public/js/shareManager.js
blueprints/public/js/signupIntegration.js
blueprints/public/js/themes-data.js
blueprints/public/manifest.json
blueprints/public/patterns/doodle-grey.svg
blueprints/public/patterns/rain.png
blueprints/public/patterns/stars.png
blueprints/public/pwabuiler-sw.js
blueprints/public/service-worker.js
blueprints/public/sounds/iphone.mp3
blueprints/public/themes/birds.png
blueprints/public/themes/floral.png
blueprints/public/themes/forest.png
blueprints/public/themes/mountain.png
blueprints/public/themes/sunset.png
blueprints/public/themes/tropical.png
blueprints/public/uploads/avatars/default.png
blueprints/public/uploads/defaults/no-image.png
blueprints/views/404.ejs
blueprints/views/about.ejs
blueprints/views/admin/dashboard.ejs
blueprints/views/admin/logs.ejs
blueprints/views/admin/reports.ejs
blueprints/views/admin/users.ejs
blueprints/views/api-tester.ejs
blueprints/views/auth/login.ejs
blueprints/views/auth/signup.ejs
blueprints/views/cache-buster.ejs
blueprints/views/club-detail.ejs
blueprints/views/clubs.ejs
blueprints/views/confessions.ejs
blueprints/views/connect.ejs
blueprints/views/create-moment.ejs
blueprints/views/dashboard.ejs
blueprints/views/emails/reset-password.ejs
blueprints/views/emails/verify-email.ejs
blueprints/views/emails/welcome.ejs
blueprints/views/error.ejs
blueprints/views/events-admin.ejs
blueprints/views/events.ejs
blueprints/views/follow-requests.ejs
blueprints/views/group-detail.ejs
blueprints/views/group-feed.ejs
blueprints/views/groups.ejs
blueprints/views/groups-prototype.ejs
blueprints/views/hashtag.ejs
blueprints/views/index.ejs
blueprints/views/lost-found.ejs
blueprints/views/marketplace.ejs
blueprints/views/marketplace/listing-detail.ejs
blueprints/views/marketplace/my-listings.ejs
blueprints/views/marketplace/orders.ejs
blueprints/views/marketplace/sell.ejs
blueprints/views/marketplace/seller-profile.ejs
blueprints/views/marketplace/wishlist.ejs
blueprints/views/messages.ejs
blueprints/views/moment-detail.ejs
blueprints/views/moments.ejs
blueprints/views/notifications.ejs
blueprints/views/partials/admin-sidebar.ejs
blueprints/views/partials/bottom-nav.ejs
blueprints/views/partials/dashboard1-modals.ejs
blueprints/views/partials/dashboard-modals.ejs
blueprints/views/partials/head.ejs
blueprints/views/partials/head.ejs.backup
blueprints/views/partials/listing-modal.ejs
blueprints/views/partials/loading-bar.ejs
blueprints/views/partials/marketplace-enhancements.html
blueprints/views/partials/navbar.ejs
blueprints/views/partials/post-card.ejs
blueprints/views/partials/quick-actions.ejs
blueprints/views/partials/scripts.ejs
blueprints/views/partials/share-modal.ejs
blueprints/views/partials/sidebar.ejs
blueprints/views/partials/styles.ejs
blueprints/views/partials/user-card.ejs
blueprints/views/partials/verified-badge.ejs
blueprints/views/poll-detail.ejs
blueprints/views/polls.ejs
blueprints/views/post.ejs
blueprints/views/professional-dashboard.ejs
blueprints/views/profile.ejs
blueprints/views/search.ejs
blueprints/views/settings.ejs
blueprints/views/skill-market.ejs
blueprints/views/skill-marketplace.ejs
blueprints/views/streams.ejs
blueprints/views/support.ejs
```

### `backend outdated/` — 16 files
```
backend outdated/controllers/ai.controller.js
backend outdated/controllers/forward.controller.js
backend outdated/controllers/message.controller.js
backend outdated/controllers/upload.controller.js
backend outdated/middleware/auth.middleware.js
backend outdated/middleware/rateLimiter.js
backend outdated/middleware/upload.middleware.js
backend outdated/migrate.js
backend outdated/migrations/20260528_add_message_fields.sql
backend outdated/migrations/20260601_create_screenshot_audit.sql
backend outdated/migrations/20260602_add_delivery_status_to_messages.sql
backend outdated/models/DeviceToken.js
backend outdated/models/Message.js
backend outdated/models/ScreenshotAudit.js
backend outdated/services/firebaseAdmin.js
backend outdated/services/messagePermission.js
```

### `scratch/` — 54 files
```
scratch/align-collations-force.js
scratch/align-collations.js
scratch/align-to-general.js
scratch/check-braces.js
scratch/check-collations.js
scratch/check-confessions-schema.js
scratch/check-db.js
scratch/check_db.js
scratch/check-group-members.js
scratch/check-parens.js
scratch/check_posts.js
scratch/check-routes.js
scratch/check-schema.js
scratch/check-tables.js
scratch/check_tables.js
scratch/check-user-blocks.js
scratch/cleanup_mock_notifications.js
scratch/create-mock-poll.js
scratch/create-settings-table.js
scratch/db_isolated_test.js
scratch/db_test.js
scratch/describe_notifications.js
scratch/diag-block.js
scratch/dump_codebase.ps1
scratch/emoji-setup.js
scratch/final_diag.js
scratch/fix-col-collations.js
scratch/migrate-anonymous-comments.js
scratch/migrate-modern-confessions.js
scratch/migrate-poll-discovery.js
scratch/migrate-polls-v2.js
scratch/migrate_profile_views.js
scratch/migrate-v2-groups.js
scratch/optimize_db.js
scratch/pool_diag.js
scratch/pool_vs_conn.js
scratch/search_notifications.js
scratch/send_mock_notifications.js
scratch/setup-reports.js
scratch/test-api-story.js
scratch/test-batch-1.js
scratch/test-block.js
scratch/test-cloudinary.js
scratch/test-cloudinary-offset.js
scratch/test-convs.js
scratch/test_db.js
scratch/test-group-posts.js
scratch/test-marketplace-query.js
scratch/test-messages-query.js
scratch/test-queries.js
scratch/test-story.js
scratch/update-enum.js
scratch/update-group-roles.js
scratch/verify_db.js
```

### `scripts/` — 25 files
```
scripts/add_search_indices.js
scripts/add_tiktok_moment.js
scripts/algorithm_migration.sql
scripts/diagnose-mysql.js
scripts/find-users.js
scripts/fix-assets.js
scripts/fix-mysql.ps1
scripts/migrate-avatars.js
scripts/migrate_group_chat.js
scripts/migrate-groups-final.js
scripts/migrate-groups-production.js
scripts/migrate-groups-v5.js
scripts/migrate-marketplace.js
scripts/migrate_marketplace_messaging.js
scripts/migrate_messaging_v3.js
scripts/migrate-orders-v2.js
scripts/production-migrate.js
scripts/reset-mysql.js
scripts/runMigrations.js
scripts/seed_from_videos.js
scripts/seed-moments.js
scripts/setup-auth-db.js
scripts/setup-social-v2.js
scripts/verify-auth-flow.js
scripts/verify-batch-3.js
```

### `brain/` — 7 files
```
brain/1ec140d5-be0b-451e-98ab-0e5808b8d89c/scratch/apply_indices.js
brain/1ec140d5-be0b-451e-98ab-0e5808b8d89c/scratch/apply_indices_moments.js
brain/1ec140d5-be0b-451e-98ab-0e5808b8d89c/scratch/check_indices.js
brain/1ec140d5-be0b-451e-98ab-0e5808b8d89c/scratch/indices_output.json
brain/1ec140d5-be0b-451e-98ab-0e5808b8d89c/scratch/inspect_users.js
brain/1ec140d5-be0b-451e-98ab-0e5808b8d89c/scratch/moments_indices.json
brain/1ec140d5-be0b-451e-98ab-0e5808b8d89c/scratch/schema_output.json
```

### `tmp/` — 4 files
```
tmp/check_db.js
tmp/check_syntax_marketplace.js
tmp/diagnose.js
tmp/inspect_db.js
```

### `frontend/` — 8 files
```
frontend/chatinput_temp2.txt
frontend/chatinput_temp.txt
frontend/dev-dist/registerSW.js
frontend/dev-dist/sw.js
frontend/dev-dist/workbox-21a80088.js
frontend/.env.production  ⚠ secret (still in git history — rotate)
frontend/replace_target.txt
frontend/templates/homefeed.txt
```

### root files — 129 files
```
algoritm-connect.txt
all_controllers.txt
all_controllers_utf8.txt
all-features.txt
architecture.txt
batches.txt
check-admins.js
check-broken.js
check-db.js
check-db-schema.js
check-master-schema.js
clean_messages.tsx
clean_messages_utf8.tsx
cloudinary.js
codebase.txt
comprehensive-fix.js
comprehensive_tree_raw.txt
controllers_list.txt
create-ai-tables.js
create-fcm-table.js
create-settings-tables.js
create-skill-tables.js
create-tables.js
dashboard.txt
database.sqlite
data.db
db_check.json
db-schema.json
describe-users.js
diag.js
diagram-design
dump-schema.js
e head to see just the first few lines
email_verif_cols.json
emergency-migrate.js
.env.production  ⚠ secret (still in git history — rotate)
features-list.txt
features.txt
files.txt
final_repair.js
fix_db.js
fix-emojis.js
fix-messages.js
fix_moments.js
fix-moments-seed.js
fix-stories.js
fix-theme-error.js
follows-schema.json
full_file_list.txt
full_file_list_utf8.txt
full_stack_verification_report.txt
generate_codebase.js
git_short_status.txt
git_status.txt
gradle-8.5-bin.zip
group_check_results.txt
group_output.txt
importMomentsSeed.js
inspect_comments.js
javascript.txt
lint8.txt
lint.txt
log.txt
marketplace-fix.txt
marketplace.txt
messages_cols.json
messages-schema.json
messages_schema.json
migrate-badges.js
migrate-groups.js
migrate-media-registry.js
migrate-message-actions.js
migrate-missing-tables.js
migrate-stories.js
migrate-stories-v2.js
migrate-stories-v3.js
migrate-support.js
migration_features_summary.txt
migration-v1.txt
missing-features.txt
missing.txt
moments_seed.json
new_tree.txt
pages.txt
pc_cols.json
phase.txt
prisma.config.js
prisma.config.ts
react.txt
reference.txt
removes.txt
repair_moments.js
route-errors.txt
run_algorithm_migration.js
run_message_deletion_migration.js
run_migration.js
schema_check_results_utf8.txt
search-broken-exhaustive.js
search-broken-global.js
search.txt
seed_groups.js
seed_moments.js
seedVideos.js
serviceAccountKey.json  ⚠ secret (still in git history — rotate)
show_create_tables.js
sparkle-algorithm-description.txt
sparkle-alorithm.txt
Sparkle-v1.0.0.apk
sparkle-version-003.iml
stashed_changes.diff
status-out.txt
structure.txt
summary.txt
temp_diff.txt
temp_diff_utf8.txt
temp_original_messages2.tsx
temp_original_messages.tsx
temp_tree.js
test-db.js
test-query.js
tmp_describe.txt
tmp_users_schema.txt
tree_batch_1.txt
tree_msg_1.txt
tree_segment_1.txt
ui_audit_report.txt
updatesalgorithm.txt
vapid.txt  ⚠ secret (still in git history — rotate)
videos.json
```
