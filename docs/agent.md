# SPARKLE — AI Agent Development Reference

## agent.md

> Last updated: 2026-03-09 (v2) | Version: 003 | Stack: Node.js + Express + MySQL + EJS + Socket.IO

---

## 📋 PROJECT OVERVIEW

**Project:** Sparkle — Campus Social & Commerce Platform  
**Stack:** Node.js, Express 4, MySQL (raw queries via `mysql2`), EJS templating, JWT Auth, Multer + Cloudinary uploads, bcryptjs, Winston logging  
**Deployment:** Vercel (`vercel.json` present) + Render (keep-alive service configured)  
**Auth Model:** JWT stored as `httpOnly` cookie named `sparkleToken`  
**No ORM** — all DB interaction is raw SQL via `pool.query()` or `pool.getConnection()`

---

## 🎯 CORE ARCHITECTURE PRINCIPLES

### 1. File Naming Convention
```
Models:      PascalCase.js           (User.js, Post.js, Marketplace.js)
Controllers: camelCase.controller.js (feed.controller.js, auth.controller.js)
Routes:      camelCase.routes.js     (auth.routes.js, moments.routes.js)
Views:       kebab-case.ejs          (group-detail.ejs, lost-found.ejs)
```

### 2. Route Structure
```
routes/
  api/          ← REST API routes (consumed by client-side JS fetch)
  web/          ← Server-side rendered page routes (EJS)
```

API routes are mounted at `/api/*`. Web routes are mounted at `/`.

### 3. Model Pattern (Raw SQL Static Class)
```javascript
const pool = require('../config/database');
const crypto = require('crypto');

class ModelName {
    static async findById(id) {
        const [rows] = await pool.query('SELECT * FROM table WHERE id = ?', [id]);
        return rows[0] || null;
    }
    static async create(data) {
        const id = crypto.randomUUID();
        await pool.query('INSERT INTO table (...) VALUES (?, ...)', [id, ...]);
        return id;
    }
}
module.exports = ModelName;
```

### 4. Controller Pattern
```javascript
const handler = async (req, res) => {
    try {
        const result = await Model.method(req.body);
        res.json({ status: 'success', data: result });
    } catch (error) {
        logger.error('Handler Error:', error);
        res.status(500).json({ error: error.message });
    }
};
```

### 5. Authentication
- **API routes** use `authMiddleware` from `middleware/auth.middleware.js`  
  → Reads `Authorization: Bearer <token>` header OR `req.cookies.sparkleToken`  
  → On success: sets `req.user = { userId, email, username, user_id, name, campus, avatar_url }`
- **Web/EJS routes** use `ejsAuthMiddleware`  
  → Reads cookie only; redirects to `/login?reason=...` on failure  
  → Sets `res.locals.user = req.user`
- Token: JWT, 7-day expiry, signed with `JWT_SECRET` from `.env`

### 6. Database Connection
```javascript
// config/database.js — exports a mysql2 promise pool
const pool = require('../config/database');

// For transactions:
const connection = await pool.getConnection();
await connection.beginTransaction();
// ...
await connection.commit();
connection.release(); // always in finally block
```

### 7. ID Generation
All primary keys are **UUID v4 strings** generated with `crypto.randomUUID()`.  
Column type is `CHAR(36)`.

### 8. User Object Shape (from `req.user`)
```javascript
{
  userId: 'uuid',       // from JWT payload
  user_id: 'uuid',     // from DB query (use either, prefer user_id)
  email: 'string',
  username: 'string',
  name: 'string',
  campus: 'string',    // 'main_campus' | 'north_campus' | etc.
  avatar_url: 'string'
}
// IMPORTANT: Always use `req.user.userId || req.user.user_id` defensively
```

---

## 📦 MODULE STATUS

---

### ✅ MODULE 1: AUTHENTICATION — [WORKING]

**Files:**
- `controllers/auth.controller.js`
- `controllers/email-auth.controller.js` ← **NEW: email verification + password reset**
- `routes/api/auth.routes.js`
- `routes/web/auth.routes.js`
- `middleware/auth.middleware.js`
- `models/EmailVerification.js`, `models/PasswordReset.js`
- `config/email.js` (Nodemailer with branded HTML templates)
- `views/auth/login.ejs`, `views/auth/register.ejs`

**Working endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/signup` | Register new user |
| POST | `/api/auth/login` | Login, set `sparkleToken` cookie |
| POST | `/api/auth/logout` | Clear cookie |
| GET | `/api/auth/validate` | Validate current JWT |

**✅ Email verification & password reset now implemented** via `email-auth.controller.js`:
- `verifyEmail` — verifies 6-char code, marks user verified, sends welcome email
- `resendVerification` — re-sends verification code
- `forgotPassword` — sends reset token email (1h expiry)
- `resetPassword` — validates token, updates password hash

**✅ FIXED:** `logger` import now added to `auth.controller.js`

---

### ✅ MODULE 2: USER PROFILES — [WORKING]

**Files:**
- `models/User.js`
- `controllers/user.controller.js`
- `routes/api/user.routes.js`
- `routes/web/profile.routes.js`
- `views/profile.ejs`, `views/settings.ejs`

**Working features:**
- Find by ID, username, email
- Create, Update (name, bio, major, campus, avatar_url)
- Delete account
- Follow / Unfollow
- Get followers / following lists
- Search users (by name or username)
- Search following users
- Get "suggested users" (random users not yet followed)
- Upload avatar (local `/uploads/` or external URL download)
- Update password (bcrypt verify + rehash)
- Update settings (anonymous_enabled, profile_visibility, push/email notifications, is_online)
- Profile stats: followers_count, following_count, posts_count

**⚠️ Known issue:**
- `getUserProfile` is exported twice in `module.exports` object (harmless duplicate)

---

### ✅ MODULE 3: SOCIAL FEED — [WORKING]

**Files:**
- `models/Post.js`
- `controllers/feed.controller.js`
- `controllers/post.controller.js`
- `routes/api/posts.routes.js`
- `routes/web/feed.routes.js`
- `views/dashboard.ejs`, `views/post.ejs`

**Working features:**
- Create post (content, media_url, media_type, post_type, campus, group_id)
- Get feed with algorithm: shows posts from follows, mutual follows, and new users (<24h)
- Pagination via limit/offset
- Campus-aware feed
- Spark (like) toggle on posts (with notification)
- Unspark (toggle off)
- Add comments (with notification)
- Save/unsave posts (bookmark)
- Get saved posts
- Delete post
- Share post (increments share_count + notification)
- Post detail view

**Post types:** `'public'` | `'group'`

**Feed algorithm note:** `Post.getFeed()` includes posts from:
1. Current user
2. Users they follow
3. Users who follow them (mutual feed)
4. New users (joined in last 24h)

---

### ✅ MODULE 4: STORIES — [WORKING]

**Files:**
- Handled in `controllers/feed.controller.js` (no separate model file)
- `routes/api/stories.routes.js`

**Working features:**
- Create story (image or video, 24h expiry)
- Get stories (grouped by user, algorithm-aware)
- Like/unlike story (with `story_likes` table auto-creation)
- Share story (increments share_count + notification)
- `story_likes` table is created on-demand via `CREATE TABLE IF NOT EXISTS`

**⚠️ No dedicated Story model file** — all DB queries inline in `feed.controller.js`

---

### ✅ MODULE 5: MOMENTS (Short Videos) — [WORKING]

**Files:**
- `controllers/moments.controller.js`
- `routes/api/moments.routes.js`
- `routes/web/moments.routes.js`
- `views/moments.ejs`

**DB tables required:** `moments`, `moment_likes`, `moment_hashtags`, `saved_moments`, `comments`

**Working features:**
- Create moment (video/image upload + hashtag extraction)
- Stream moments (paginated, category filter, hashtag filter)
- Spark (like) / unspark moments
- Save / unsave moments
- Add comments to moments
- Get paginated comments
- Follow/unfollow user from moments page
- Track share count
- Get share metadata (OG tags)
- Trending hashtags (last 7 days)
- Suggested users sidebar
- User interests (from `user_interests` table — wrapped in try/catch, may not exist)

```javascript
// Moments schema reference
moments: {
  moment_id CHAR(36),
  user_id CHAR(36),
  caption TEXT,
  media_url VARCHAR(500),
  media_type VARCHAR(50),   // 'image' | 'video'
  category VARCHAR(50),
  like_count INT,
  comment_count INT,
  share_count INT,
  created_at TIMESTAMP
}
```

---

### ✅ MODULE 6: GROUPS — [WORKING]

**Files:**
- `models/Group.js`, `models/GroupMember.js`, `models/GroupChat.js`
- `controllers/groups.controller.js`, `controllers/groupChat.controller.js`
- `routes/api/groups.routes.js`, `routes/api/groupChat.routes.js`
- `routes/web/groups.routes.js`
- `views/groups.ejs`, `views/group-detail.ejs`, `views/group-feed.ejs`

**DB tables:** `groups`, `group_members`

**Working features:**
- Create group (with auto-slug generation)
- Get all groups with member count
- Get group by ID
- Get group posts
- Join / leave group
- Get members of a group
- Get groups a user belongs to
- Get groups managed by user (admin/creator)
- Search groups (by campus, category, keyword)
- Update group details (name, description, icon, banner, category, privacy)
- Group chat (in-group messaging)

**Group roles:** `'admin'` | `'creator'` | `'member'`  
**Group visibility:** `is_public` boolean

---

### ✅ MODULE 7: CLUBS — [WORKING]

**Files:**
- `models/Club.js`
- `controllers/clubs.controller.js`
- `routes/api/clubs.routes.js`
- `routes/web/clubs.routes.js`
- `views/clubs.ejs`, `views/club-detail.ejs`

**Working features:**
- Get all clubs with member count
- Get club by ID
- Join/leave club
- Get club members
- Get user's clubs
- Create club (name, description, campus, category, is_public)
- Club posts feed

---

### ✅ MODULE 8: MARKETPLACE — [WORKING]

**Files:**
- `models/Marketplace.js` (772 lines — most complex model)
- `models/LostFound.js`, `models/SkillMarket.js`
- `controllers/marketplace.controller.js` (~1050 lines)
- `routes/api/marketplace.routes.js`
- `routes/web/marketplace.routes.js`
- `views/marketplace.ejs`
- `views/marketplace/listing-detail.ejs`
- `schemas/marketplace.schemas.js`

**✅ FIXED:** All 25 `req.session?.user` occurrences replaced with `normalizeUser(req.user)`

**Working features (API):**
- Get listings (with filters: campus, category, price range, condition, search, sort, pagination)
- Get single listing with media
- Create listing with multi-file media upload (up to 5 files)
- Update listing status (mark as sold)
- Delete listing (soft-delete via `is_sold = TRUE`)
- Get user's listings
- Contact seller (creates personal chat)
- Get chat messages / Send message in chat
- Toggle favorite / wishlist
- Get user favorites / dashboard counts
- Report listing / Block user
- Create seller review / Get user reviews
- Safe meetup locations
- ✅ Create lost & found items (fully implemented via `LostFound` model)
- ✅ Create skill offers (fully implemented via `SkillMarket` model)

---

### ✅ MODULE 9: CONFESSIONS — [WORKING]

**Files:**
- `models/Confession.js`
- `controllers/confession.controller.js`
- `routes/api/confession.routes.js`
- `routes/web/confession.routes.js`
- `views/confessions.ejs`

**Working features:**
- Anonymous confessions
- Post confession
- Get confessions feed

---

### ✅ MODULE 10: LOST & FOUND — [WORKING]

**Files:**
- `models/LostFound.js`
- `controllers/lostFound.controller.js`
- `routes/api/lost-found.routes.js`
- `routes/web/lost-found.routes.js`
- `views/lost-found.ejs`

**Working features:** Read, display, and ✅ create lost/found items (via `LostFound.create()`)

---

### ✅ MODULE 11: SKILL MARKET — [WORKING]

**Files:**
- `models/SkillMarket.js`
- `controllers/skillMarket.controller.js`
- `routes/api/skill-market.routes.js`
- `routes/web/skill-market.routes.js`
- `views/skill-market.ejs`, `views/skill-marketplace.ejs`

**Working features:** Read, display, and ✅ create skill offers (via `SkillMarket.createOffer()`)

---

### ✅ MODULE 12: MESSAGES / DIRECT MESSAGING — [WORKING]

**Files:**
- `controllers/messaging.controller.js` (renders `/messages` page)
- `controllers/messages.controller.js` (API: inbox, conversation messages, send)
- `controllers/realtime.controller.js` ← **NEW: online friends, presence, chat history**
- `socket/index.js` ← **NEW: Socket.IO real-time messaging engine**
- `models/Message.js`
- `routes/api/messages.routes.js`
- `routes/api/realtime.routes.js` ← **NEW**
- `routes/web/messaging.routes.js`
- `views/messages.ejs` (51KB — full EJS view)

**The full `messages.ejs` view (51KB)** has complete DM UI with conversations sidebar, chat area, and send input.

**✅ Socket.IO real-time engine now integrated:**
- JWT authentication on WebSocket connections
- Live message sending/receiving
- Typing indicators
- Read receipts
- Online/offline presence broadcasting
- Push notification queueing for offline users

---

### ✅ MODULE 13: NOTIFICATIONS — [WORKING]

**Files:**
- `controllers/notification.controller.js`
- `routes/api/notifications.routes.js`

**Notifications are created inline** across models/controllers when actions happen:
- `follow`, `spark` (on posts), `comment` (on posts), `share` (on posts)
- `spark` (on moments), `comment` (on moments)
- `story_like`, `story_share`

**Notification table columns:**
```sql
notifications (
  notification_id CHAR(36),
  user_id         CHAR(36),   -- recipient
  actor_id        CHAR(36),   -- who triggered it
  type            VARCHAR(50), -- 'follow'|'spark'|'comment'|'share'|'story_like'|'story_share'
  title           VARCHAR(255),
  content         TEXT,
  related_id      CHAR(36),   -- post_id/moment_id/etc
  related_type    VARCHAR(50),
  action_url      VARCHAR(500),
  is_read         BOOLEAN DEFAULT FALSE
)
```

---

### ✅ MODULE 14: CAMPUS FEATURES — [WORKING]

**Files:**
- `controllers/campus.controller.js` (11,729 bytes)
- `routes/api/campus.routes.js`
- `routes/web/campus.routes.js`
- Views: `events.ejs`, `polls.ejs`, `poll-detail.ejs`, `streams.ejs`

**Working features:**
- Campus events (likely CRUD)
- Polls (create, vote, view results)
- Streams

---

### ⚠️ MODULE 15: SOCIAL CONNECT — [MINIMAL]

**Files:**
- `controllers/social.controller.js` (1,935 bytes — minimal)
- `routes/web/social.routes.js`
- `views/connect.ejs` (25KB view exists)

**`connect.ejs`** has a full UI for finding/following people.  
**Backend** is minimal — relies on `User.search()` and `User.getSuggestions()`.

---

### ✅ MODULE 16: REAL-TIME (Socket.IO) — [WORKING]

**Files:**
- `socket/index.js` — Full Socket.IO server with JWT auth middleware
- `controllers/realtime.controller.js` — REST endpoints for presence/history
- `routes/api/realtime.routes.js` — `/api/realtime/*`

**Features:**
- JWT authentication on WebSocket connections (reads `sparkleToken` cookie)
- Personal rooms (`user:<userId>`) + chat rooms (`chat:<chatId>`)
- `send-message` — saves to DB + emits to recipient
- `typing` — typing indicators
- `mark-read` — read receipts
- Online/offline status broadcasting to followers
- Push notification queueing for offline users
- REST API: `/api/realtime/online-friends`, `/api/realtime/presence/:userId`, `/api/realtime/chat/:chatId/history`

---

### ✅ MODULE 17: EMAIL SERVICE — [WORKING]

**Files:**
- `config/email.js` — Nodemailer transport + branded HTML templates
- `models/EmailVerification.js` — 6-char verification codes (24h expiry)
- `models/PasswordReset.js` — 64-char reset tokens (1h expiry)
- `controllers/email-auth.controller.js` — signup, verify, resend, forgot/reset

**Templates:** `verifyEmail`, `resetPassword`, `welcomeEmail` — all with Sparkle gradient branding  
**Graceful degradation:** If `EMAIL_USER`/`EMAIL_PASS` not set, service logs a warning and skips sending

---

### ✅ MODULE 18: GLOBAL SEARCH — [WORKING]

**Files:**
- `controllers/search.controller.js`
- `routes/api/search.routes.js`

**Endpoints:**
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/search?q=&type=&campus=` | Unified search across all entities |
| GET | `/api/search/suggestions?q=` | Autocomplete suggestions |

**Searches:** users, posts, moments, groups, marketplace listings, clubs  
**Features:** Type filtering, campus filtering, pagination, result grouping

---

### ✅ MODULE 19: ADMIN PANEL — [WORKING]

**Files:**
- `middleware/admin.middleware.js` — Role gate (admin/moderator)
- `controllers/admin.controller.js` — Dashboard, user mgmt, reports, logs
- `routes/web/admin.routes.js` — `/admin/*`
- `views/admin/dashboard.ejs` — Stats grid + recent users + activity feed
- `views/admin/users.ejs` — User table with search, filter, pagination, role editing
- `views/admin/reports.ejs` — Content moderation queue
- `views/admin/logs.ejs` — Admin action history
- `views/partials/admin-sidebar.ejs` — Dark navigation sidebar

**Access:** Users with `role = 'admin'` or `role = 'moderator'` in the `users` table  
**Routes:** `/admin`, `/admin/users`, `/admin/reports`, `/admin/logs`

---

## 📁 COMPLETE FILE INDEX

### Models (13 files)
| File | Status | Tables Used |
|------|--------|-------------|
| `User.js` | ✅ Full | `users`, `follows`, `notifications` |
| `Post.js` | ✅ Full | `posts`, `sparks`, `comments`, `saved_posts`, `notifications` |
| `Group.js` | ✅ Full | `groups`, `group_members` |
| `GroupMember.js` | ✅ Full | `group_members` |
| `GroupChat.js` | ✅ Full | `group_chats`, `group_messages` |
| `Club.js` | ✅ Full | `clubs`, `club_members` |
| `Confession.js` | ✅ Full | `confessions` |
| `LostFound.js` | ✅ Full | `lost_found_items` |
| `Marketplace.js` | ✅ Full | `marketplace_listings`, `listing_media`, `personal_chats`, `messages`, etc. |
| `Message.js` | ✅ Full | `messages`, `users` |
| `SkillMarket.js` | ✅ Full | `skill_offers` |
| `EmailVerification.js` | ✅ NEW | `email_verifications` |
| `PasswordReset.js` | ✅ NEW | `password_resets` |

---

### Controllers (24 files)
| File | Size | Status |
|------|------|--------|
| `auth.controller.js` | 8KB | ✅ Working (logger fixed) |
| `email-auth.controller.js` | 5KB | ✅ NEW — verify/reset |
| `feed.controller.js` | 10KB | ✅ Working |
| `post.controller.js` | 4KB | ✅ Working |
| `moments.controller.js` | 19KB | ✅ Working |
| `user.controller.js` | 9KB | ✅ Working |
| `groups.controller.js` | 7.6KB | ✅ Working |
| `groupChat.controller.js` | 4.6KB | ✅ Working |
| `clubs.controller.js` | 6.6KB | ✅ Working |
| `campus.controller.js` | 11.7KB | ✅ Working |
| `marketplace.controller.js` | 34KB | ✅ Working (auth fixed, stubs implemented) |
| `profile.controller.js` | 3.7KB | ✅ Working |
| `notification.controller.js` | 5.3KB | ✅ Working |
| `confession.controller.js` | 2.2KB | ✅ Working |
| `lostFound.controller.js` | 3.6KB | ✅ Working |
| `skillMarket.controller.js` | 2.9KB | ✅ Working |
| `messages.controller.js` | 2KB | ✅ Working |
| `messaging.controller.js` | 152B | ✅ View renderer |
| `realtime.controller.js` | 3KB | ✅ NEW — presence/history |
| `search.controller.js` | 6KB | ✅ NEW — global search |
| `admin.controller.js` | 5KB | ✅ NEW — admin panel |
| `social.controller.js` | 1.9KB | ⚠️ Minimal |
| `upload.controller.js` | 649B | ✅ Working |
| `web.controller.js` | 521B | ✅ Working |

---

### API Routes (20 files in `routes/api/`)
```
auth.routes.js          → /api/auth/*
user.routes.js          → /api/users/*
posts.routes.js         → /api/posts/*
stories.routes.js       → /api/stories/*
moments.routes.js       → /api/moments/*
messages.routes.js      → /api/messages/*
groups.routes.js        → /api/groups/*
groupChat.routes.js     → /api/chats/*
clubs.routes.js         → /api/clubs/*
campus.routes.js        → /api/*  (mounted at root of /api)
marketplace.routes.js   → /api/*  (mounted at root of /api)
confession.routes.js    → /api/confessions/*
lost-found.routes.js    → /api/lost-found/*
skill-market.routes.js  → /api/skill-market/*
notifications.routes.js → /api/notifications/*
share.routes.js         → /api/share/*
upload.routes.js        → /api/upload/*
search.routes.js        → /api/search/*  ← NEW
realtime.routes.js      → /api/realtime/*  ← NEW
index.js                → mounts all above
```

### Web Routes (15 files in `routes/web/`)
```
auth.routes.js          → /login, /register, /logout
feed.routes.js          → /, /dashboard, /post/:id
profile.routes.js       → /profile/:username, /settings
campus.routes.js        → /events, /polls, /streams
marketplace.routes.js   → /marketplace, /marketplace/listings/:id
messaging.routes.js     → /messages
clubs.routes.js         → /clubs, /clubs/:id
groups.routes.js        → /groups, /groups/:id
moments.routes.js       → /moments, /moments/:id
social.routes.js        → /connect
confession.routes.js    → /confessions
lost-found.routes.js    → /lost-found
skill-market.routes.js  → /skill-market
admin.routes.js         → /admin/*  ← NEW
index.js                → mounts all above
```

---

### Views (44 EJS files in `views/`)
| View | Status |
|------|--------|
| `dashboard.ejs` | ✅ Working |
| `moments.ejs` | ✅ Working (50KB) |
| `marketplace.ejs` | ✅ Working (142KB — very large) |
| `messages.ejs` | ✅ UI done (51KB) but no real-time backend |
| `groups.ejs`, `group-detail.ejs`, `group-feed.ejs` | ✅ Working |
| `clubs.ejs`, `club-detail.ejs` | ✅ Working |
| `confessions.ejs` | ✅ Working |
| `connect.ejs` | ✅ UI done |
| `profile.ejs`, `settings.ejs` | ✅ Working |
| `lost-found.ejs` | ✅ Working |
| `skill-market.ejs`, `skill-marketplace.ejs` | ✅ Working |
| `events.ejs`, `polls.ejs`, `poll-detail.ejs`, `streams.ejs` | ✅ Working |
| `post.ejs` | ✅ Working |
| `about.ejs` | ✅ Static (106KB) |
| `index.ejs` | ✅ Landing page |
| `auth/login.ejs`, `auth/register.ejs` | ✅ Working |
| `error.ejs`, `404.ejs` | ✅ Working |
| `api-tester.ejs` | ✅ Dev tool |
| `marketplace/listing-detail.ejs` | ✅ Working |
| `partials/` | 13 partials |

---

### Middleware (6 files)
| File | Purpose |
|------|---------|
| `auth.middleware.js` | `authMiddleware` (API JWT) + `ejsAuthMiddleware` (web cookie) |
| `admin.middleware.js` | Admin/moderator role gate ← NEW |
| `security.middleware.js` | `securityHeaders` (Helmet), `apiRateLimiter`, `sanitizeInput` |
| `rateLimiter.middleware.js` | Per-route rate limiting |
| `upload.middleware.js` | Multer config for file uploads |
| `validation.middleware.js` | Joi schema validation wrapper |

---

### Utils
| File | Purpose |
|------|---------|
| `utils/database/init.js` | DB initialization, table creation |
| `utils/database/query.js` | Query wrapper with retry logic |
| `utils/logger.js` | Winston logger (file + console) |
| `utils/keep-alive.js` | Pings self to prevent Render sleep |
| `utils/route-scanner.js` | Dev-only route scanner (for API tester UI) |
| `utils/fileUpload.js` | Multer + Cloudinary setup |
| `utils/media.utils.js` | `downloadExternalImage()` for CDN avatar migration |

---

### Config
| File | Purpose |
|------|---------|
| `config/database.js` | mysql2 pool connection |
| `config/constants.js` | `PORT`, `JWT_SECRET` |
| `config/firebase.config.js` | Firebase config object (passed to views as `res.locals.firebaseConfig`) |
| `config/email.js` | Nodemailer transport + HTML email templates ← NEW |

---

## ⚠️ KNOWN BUGS & ISSUES

### 🔴 CRITICAL — All fixed ✅

1. ~~**Marketplace auth inconsistency**~~ — ✅ FIXED: All 25 `req.session?.user` replaced with `normalizeUser(req.user)`
2. ~~**Undefined `logger` in `auth.controller.js`**~~ — ✅ FIXED: Logger import added

### 🟡 MODERATE

3. ~~**`messaging.controller.js` is a stub**~~ — ✅ FIXED: Socket.IO real-time engine now handles live messaging
4. **`user_interests` table may not exist** — `moments.controller.js` wraps the query in try/catch. Harmless.
5. ~~**Missing `moment-detail` view**~~ — ✅ FIXED: `moment-detail.ejs` created
6. **`socialController` is minimal** — `/connect` page has full UI but backend is basic.
7. **No `vercel.json` function timeout config** — Long-running DB queries on Vercel may timeout.

### 🟢 MINOR

8. **`getUserProfile` exported twice** in `user.controller.js` — Harmless duplicate.
9. **Facebook CDN avatar lazy migration** — Adds latency for migrated users.
10. **`campus.routes.js` and `marketplace.routes.js` mounted at `/api` root** — Potential route conflicts.

---

## ✅ PREVIOUSLY MISSING — NOW IMPLEMENTED

| Feature | Status | Implementation |
|---------|--------|----------------|
| Email verification | ✅ Done | `email-auth.controller.js` + `EmailVerification.js` |
| Password reset flow | ✅ Done | `email-auth.controller.js` + `PasswordReset.js` |
| Real-time messaging | ✅ Done | `socket/index.js` (Socket.IO) |
| Real-time presence | ✅ Done | Online/offline broadcasting to followers |
| Global search | ✅ Done | `search.controller.js` — 6 entity types |
| Admin panel | ✅ Done | 4 views + middleware + controller |
| Moment detail view | ✅ Done | `moment-detail.ejs` |
| Lost & Found creation | ✅ Done | `createLostFoundItem` implemented |
| Skill offer creation | ✅ Done | `createSkillOffer` implemented |

## ❌ REMAINING MISSING FEATURES

| Feature | Priority | Notes |
|---------|----------|-------|
| Service Worker (PWA push) | Medium | Socket.IO handles in-app; no offline push yet |
| Story model (`Story.js`) | Low | Currently inline in feed.controller |
| Notification model | Low | Notifications created inline everywhere |
| Rate limiting per user | Low | Only basic IP-based limits |
| Firebase Auth integration | Low | Config loaded but not used for auth |

---

## 🚀 ENVIRONMENT VARIABLES (`.env`)

```env
PORT=3000
NODE_ENV=development
JWT_SECRET=<strong_random_secret>
DB_HOST=
DB_USER=
DB_PASSWORD=
DB_NAME=
DATABASE_URL=               # Render/PlanetScale connection string
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
FIREBASE_API_KEY=           # Firebase client config (passed to views)
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
API_URL=                    # Public API base URL
WS_URL=                     # WebSocket server URL (now same as API_URL)
EMAIL_HOST=smtp.gmail.com   # SMTP host
EMAIL_PORT=587              # SMTP port
EMAIL_USER=                 # SMTP user (e.g. your@gmail.com)
EMAIL_PASS=                 # SMTP password or app password
EMAIL_FROM=                 # From address (defaults to EMAIL_USER)
RENDER_EXTERNAL_URL=        # For keep-alive service
```

---

## 🗄️ DATABASE TABLES REFERENCE

### Core tables (definitely exist)
```sql
users               -- user_id, name, username, email, password_hash, campus, major, 
                    -- year_of_study, bio, avatar_url, is_online, last_seen_at, joined_at
follows             -- follower_id, following_id
posts               -- post_id, user_id, content, media_url, media_type, post_type, 
                    -- campus, group_id, spark_count, comment_count, share_count
sparks              -- spark_id, user_id, post_id
comments            -- comment_id, post_id/moment_id, user_id, content/comment
saved_posts         -- save_id, user_id, post_id
notifications       -- notification_id, user_id, type, title, content, related_id, 
                    -- related_type, actor_id, action_url, is_read
stories             -- story_id, user_id, media_url, media_type, caption, like_count, share_count
story_likes         -- like_id, story_id, user_id (auto-created if missing)
moments             -- moment_id, user_id, caption, media_url, media_type, category, 
                    -- like_count, comment_count, share_count
moment_likes        -- moment_id, user_id
moment_hashtags     -- moment_id, hashtag
saved_moments       -- moment_id, user_id
groups              -- group_id, creator_id, name, slug, description, campus, category, 
                    -- is_public, banner_url, icon_url
group_members       -- membership_id, group_id, user_id, role, status
clubs               -- club_id, ...
confessions         -- confession_id, ...
marketplace_listings -- listing_id, seller_id, title, description, price, category, 
                     -- condition, campus, location, image_url, is_sold, sold_at
```

### Optional tables (checked before use)
```sql
personal_chats          -- chat_id, participant1_id, participant2_id, listing_id, last_message
messages                -- message_id, personal_chat_id, sender_id, type, content, is_read
listing_media           -- media_id, listing_id, media_url, media_type, upload_order
marketplace_favorites   -- favorite_id, user_id, listing_id
wishlist                -- user_id, listing_id
marketplace_reviews     -- review_id, listing_id, reviewer_id, reviewee_id, rating, comment
listing_reports         -- report_id, listing_id, reporter_id, reason, details
marketplace_user_blocks -- block_id, blocker_id, blocked_id, reason
safe_meetup_locations   -- campus, is_verified, has_security, is_24_7, ...
lost_found_items        -- type ('lost'|'found'), reporter_id, campus, status
skill_offers            -- user_id, category, is_active, campus
user_interests          -- user_id, category
```

---

## 🎯 CODING CONVENTIONS

### Adding a new feature — Standard Steps:
1. Create/update model in `models/` with static async SQL methods
2. Create controller in `controllers/` using the standard async/try-catch pattern
3. Add API route in `routes/api/` (use `authMiddleware` for protected routes)
4. Add web route in `routes/web/` if it needs an EJS view (use `ejsAuthMiddleware`)
5. Register routes in `routes/api/index.js` and `routes/web/index.js`
6. Create EJS view in `views/` if needed
7. Link navigation in `views/partials/sidebar.ejs` or equivalent

### Response format conventions:
```javascript
// Success (API)
res.json({ status: 'success', data: result, message: 'Optional message' });

// Error (API)
res.status(500).json({ error: 'Short error', message: 'Longer explanation' });

// Web render success
res.render('view-name', { title: 'Page Title', user: req.user, data: result });

// Web render error (pass empty defaults, don't crash)
res.render('view-name', { title: 'Page Title', user: req.user, data: [], error: 'msg' });
```

### Avatar URL safety pattern:
```javascript
// Always use this helper before passing avatar_url to views
const getSafeAvatarUrl = (url) => {
    if (!url) return '/uploads/avatars/default.png';
    if (url.startsWith('/uploads/')) return url;
    if (url.startsWith('http')) return url;
    return '/uploads/avatars/default.png';
};
```

---

## 🏥 HEALTH CHECKS
- `GET /api/health` — checks DB connectivity
- `GET /api/debug/routes` — dev-only, lists all registered routes (requires auth)
- `GET /api-tester` — dev-only, interactive API tester UI (requires auth)

---

**All critical bugs fixed and all major missing modules implemented!** Remaining work: PWA push notifications, Story/Notification model extraction, and per-user rate limiting. 🚀
