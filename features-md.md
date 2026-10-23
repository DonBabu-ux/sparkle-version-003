# Sparkle Product Roadmap and Frontend Audit

This document turns the original feature notes into a trackable product and engineering backlog. It preserves the requested work, separates verified defects from ideas, and defines outcomes that can be tested.

## How to use this roadmap

- **P0/P1/P2 are priority labels, not product phases and not a limit on scope.** Assign them to individual backlog items by risk and urgency. A final product needs all applicable release-readiness work below, even if it is P2 or still marked Audit needed.
- **P0 — Release / trust blocker:** fix before relying on the affected user journey in production.
- **P1 — Core product:** important functionality or usability gap; schedule after P0.
- **P2 — Polish / expansion:** worthwhile improvement with lower immediate risk.
- **Audit needed:** inspect the current implementation and test it before deciding whether code changes are needed.
- A page existing in the app does **not** mean that its complete workflow is implemented or production-ready.
- Acceptance criteria describe the intended outcome; they are not claims that the work is already complete.
- Do not promise payment protection, anonymity, moderation action, verification, or recommendations unless the product actually provides them.

### Suggested delivery gates (separate from P0/P1/P2)

These gates describe how to get to a dependable final product. Each backlog item receives its own priority; completing a gate requires evidence for its exit criteria, not just code merged.

1. **Product definition and contract freeze:** decide the supported user journeys, user roles, monetization model, privacy promises, supported countries/currencies, and what is explicitly out of scope. Document API contracts and state transitions.
2. **Core journey completion:** make sign-up/login, profile, posting/discovery, messaging, notifications, account recovery, and the chosen marketplace/creator flows work end-to-end with real persisted data and correct permissions.
3. **Trust, safety, and data correctness:** complete moderation/reporting, blocking, account lifecycle, privacy/security controls, money/ledger guarantees where applicable, and data export/deletion expectations.
4. **Quality and device hardening:** cover backend/frontend contracts and failure paths with tests; validate web and Android on supported devices, networks, screen sizes, and accessibility settings.
5. **Launch and operations readiness:** validate production configuration and secrets, release automation, OTA/APK compatibility, monitoring/alerts, backups/restore, incident response, support, and rollback.
6. **Post-launch learning and scale:** monitor user outcomes and reliability, fix launch feedback, then expand recommendations, campaigns, analytics, and other growth features only when their data and operational foundations exist.

Keep a gate marked **blocked** if a required dependency or product decision is unresolved. Do not use a successful build or APK upload alone as evidence that a gate is complete.

### Audit scope and limits

This is a static code audit performed on the current local `main` worktree. It traces representative user actions through frontend pages, registered routes, backend routes/controllers/services, and the release workflow. Marketplace received a deeper, focused trace; the additional findings cover social/content, account/utility, wallet, support, backend processing, and release checks. Findings below are tied to inspected code; the page inventory remains a checklist, not a claim that every interaction on every page has been individually tested.

No live production/staging API calls, database concurrency tests, payment-provider tests, push/email delivery checks, Android APK install/OTA tests, or screen-reader/device permission tests were run. Any item explicitly marked audit-needed or runtime verification must remain open until tested in the appropriate environment.

## Marketplace audit

**Audit date:** 2026-10-23
**Scope:** Static trace of the frontend screens, API routes, controllers, and marketplace model on `main`. No live backend transaction, database, Android-device, or moderation-queue test was performed.

### P0 — Resolve before treating Marketplace as a complete transaction product

#### MKT-01 — Enforce one active order per listing

**Observed:** `placeOrder` permits a listing whose status is already `pending`. Its existing-order check only rejects another active order from the same buyer. That does not prevent two different buyers from creating pending orders for the same listing.

**Relevant code:** [Marketplace model](./backend/models/Marketplace.js), order creation and listing status update; [marketplace controller](./backend/controllers/marketplace.controller.js); [marketplace routes](./backend/routes/api/marketplace.routes.js).

**Acceptance criteria**
- The server atomically allows at most one active order per listing, including simultaneous requests from different buyers.
- A competing buyer receives a clear “no longer available” response and no order is created.
- Rejected or cancelled orders restore availability exactly once.
- Tests cover concurrent buyers, seller buying their own item, sold items, and retries.

#### MKT-02 — Wire the seller’s listing-management screen to real endpoints

**Observed:** `MyListings` requests `/marketplace/my-listings`, but no matching route was found. The model has a `getUserListings` method that is not exposed through that route. The UI marks sold with `PATCH /marketplace/listings/:id/status`; the backend route found is `PUT /marketplace/listings/:id/sold`. The delete route uses `:id`, while its controller reads `req.params.listingId`.

**Relevant code:** [MyListings page](./frontend/src/pages/MyListings.tsx), [marketplace routes](./backend/routes/api/marketplace.routes.js), [marketplace controller](./backend/controllers/marketplace.controller.js), [Marketplace model](./backend/models/Marketplace.js).

**Acceptance criteria**
- The authenticated seller can load all of their listings, including active, pending, sold, and removed states as appropriate.
- Create, edit, mark-sold, relist, and remove actions use documented routes and return explicit success or actionable errors.
- The server checks ownership for every mutation; a different user cannot change or remove a listing.
- UI state refreshes from the server after changes; failed mutations do not look successful.
- Tests cover each endpoint, authorization, not-found behavior, and the route/parameter names.

#### MKT-03 — Persist listing reports and connect them to review

**Observed:** The report controller logs the report and returns success; it does not insert a report into the existing `listing_reports` table. The UI says “Immediate Action Guaranteed,” although the only immediate hiding found is a client-side store update.

**Relevant code:** [ReportListing page](./frontend/src/pages/ReportListing.tsx), [marketplace controller](./backend/controllers/marketplace.controller.js), [marketplace schemas](./backend/schemas/marketplace.schemas.js), [admin controller](./backend/controllers/admin.controller.js), [listing reports schema](./backend/utils/database/core_tables.sql).

**Acceptance criteria**
- A report is validated and saved with listing, reporter, reason, details, timestamp, and review status.
- Duplicate or abusive reports are rate-limited and handled without leaking reporter information to the reported seller.
- Authorized moderators can view, action, and resolve the report; actions are auditable.
- The frontend submits values accepted by the backend schema and distinguishes submission success from moderation outcome.
- Remove guaranteed-action wording unless automated action is implemented and verified.
- Tests confirm that a submitted report is persisted and appears in the moderation workflow.

#### MKT-04 — Complete the order lifecycle in the product

**Observed:** The backend exposes order status changes and meetup confirmation. The reviewed frontend creates an order and lists history, but no buyer/seller controls were found for accepting, rejecting, cancelling, confirming a meetup, completing, or disputing an order.

**Relevant code:** [marketplace routes](./backend/routes/api/marketplace.routes.js), [marketplace controller](./backend/controllers/marketplace.controller.js), [Marketplace model](./backend/models/Marketplace.js), [MarketplaceOrder page](./frontend/src/pages/MarketplaceOrder.tsx), [Orders page](./frontend/src/pages/Orders.tsx).

**Acceptance criteria**
- Buyer and seller see only the actions permitted for their role and the order’s current state.
- Server-side state-transition and participant checks remain authoritative.
- Both parties can confirm a meetup; completion is unavailable until the required confirmations exist.
- Cancellation, rejection, dispute, and completion have clear outcomes and update listing availability correctly.
- Notifications and order history reflect the persisted server state.
- Tests cover allowed and rejected transitions for each participant.

#### MKT-05 — Describe the transaction honestly; do not imply escrow

**Observed:** The order UI uses “Confirm Purchase” and “Order Confirmed” and says Sparkle creates a secure transaction record. The traced order path records an order and meetup details; no payment or escrow action was found in this flow.

**Acceptance criteria**
- If this is a meetup request, copy says that the request was sent/placed and explains seller acceptance; it does not imply payment, escrow, or buyer protection.
- If in-app payments are intended, specify provider, authorization/capture/refund/dispute flows, fees, and payment-state ownership before implementation.
- Do not display “protected transaction” or equivalent guarantees until the full protection mechanism exists and is operational.

### P1 — Reliability, correctness, and seller trust

#### MKT-06 — Make order history use the actual response fields

**Observed:** The backend order query returns fields such as `agreed_price` and `price_at_time`. `Orders` renders `amount || price`, which may display KES 0. The list also navigates to the listing, which may have been removed or sold, rather than an order-detail view.

**Acceptance criteria**
- Display the agreed transaction amount with a documented fallback to the snapshot price.
- Show the other party, order state, listing snapshot, and meetup details without relying on the live listing remaining available.
- Add an order-detail route using the existing authenticated order-by-ID endpoint.
- Test each supported status and missing/deleted listing cases.

#### MKT-07 — Align inbox filters with conversation/order states

**Observed:** The marketplace inbox filters “Pending” using `payment_pending`, while the order creation path uses `pending`; the inbox maps listing status rather than order status. This can make filters misleading.

**Acceptance criteria**
- Define separate, documented conversation and order statuses.
- Populate filters from the correct resource state and display a useful empty state.
- Test buying/selling tabs, pending/completed/archived/pinned filters, and stale/deleted listings.

#### MKT-08 — Use consistent date/time formats for meetup scheduling

**Observed:** The order screen invites free-text input such as “Tomorrow at 2 PM”; the backend schema expects an ISO date.

**Acceptance criteria**
- Use a date/time input with timezone-aware serialization, or explicitly accept and safely parse natural language server-side.
- Validate past dates and invalid formats and show field-level feedback before submission.
- Tests cover timezone boundaries and invalid input.

#### MKT-09 — Make seller profiles truthful and actions work

**Observed:** Seller profile displays a default 5.0 rating when rating data is absent and a hard-coded 2024 join year. Its contact request uses `/marketplace/listings/contact`, while the traced route is `/marketplace/listings/:id/contact`; its review-reply request has no matching route found, though a model reply method exists.

**Acceptance criteria**
- Show “No ratings yet” when there are no reviews; show a rating only when derived from real reviews.
- Derive the join date and listing counts from server data.
- Message seller and reply-to-review actions call implemented, authenticated endpoints with server-side ownership checks.
- Show success or failure feedback and cover these paths in tests.

#### MKT-10 — Implement a real recommendation/sort contract

**Observed:** The marketplace sends `sort=recommended`, but the generic listing query falls through to newest. The query sets `order_count` to zero, so its “popular” sort has no meaningful signal. A separate recommendation model method exists, but the reviewed recommendation controller calls the generic listing query instead.

**Acceptance criteria**
- Document what “Recommended” means and which user signals it uses.
- Connect the UI option to the actual recommendation endpoint or a real recommendation query.
- Do not label newest or random results “Recommended.”
- Provide a non-personalized fallback for new/anonymous users and test it.

#### MKT-11 — Add pagination or deliberate feed loading

**Observed:** The backend returns pagination metadata and defaults to 20 listings. The Marketplace screen does not appear to use an offset or `hasMore`.

**Acceptance criteria**
- Support accessible “Load more” or infinite scrolling with stable ordering and no duplicate/missing listings.
- Preserve filters and location while paging; reset the page when filters change.
- Show loading, end-of-results, and retry states.
- Test paging with changing filters and a changing listing set.

### P2 — Safety, usability, and growth

- **Seller reputation:** only show verified status when backed by the actual verification state; distinguish account verification from transaction history and ratings.
- **Search and filters:** agree category IDs and labels between Sell Item, category filters, and server validation. Add tests for all supported categories, prices, condition, distance, and empty results.
- **Images and listing quality:** validate image count, type, size, upload failures, and cleanup of abandoned media. Preview saved media and support edit/reorder.
- **Seller controls:** support edit price/details, mark sold, relist, and remove with clear consequences; keep sold listings available in seller history if desired.
- **Safety center:** make recommendations accurate, actionable, and consistent with actual payment/meetup protections.
- **Marketplace metrics:** ensure view/share/favorite counts are deduplicated and displayed only when backed by reliable server data.
- **Accessibility/mobile:** verify keyboard operation, screen-reader labels, focus behavior, safe areas, responsive layout, and Android keyboard/scroll behavior on real devices.
- **User blocks:** prevent blocked parties from contacting one another and ensure the UI reflects the block state.
- **Tests:** add frontend/API contract tests for listing, report, order, seller profile, and inbox flows. Existing targeted Marketplace test coverage found in this audit was limited to image fallbacks.

## Cross-app roadmap

The original notes name many existing pages. Treat these as **audit/verification targets**, not a claim that the pages are absent. For every target, check the real user journey, API wiring, authorization, loading/error/empty states, accessibility, mobile layouts, and automated tests.

### Navigation behavior recorded from the latest UI change

**Status: implemented in the current worktree; not committed.** These are the intended behaviors and their implementation locations, not a claim that unrelated navigation QA has passed.

- **Homepage quick-message button:** the desktop floating action is now rendered only when the route is exactly `/dashboard`. It opens `/messages` directly and no longer expands a secondary menu or appears on other pages. It remains hidden on mobile by its responsive display class.
- **Sidebar create button:** the desktop sidebar’s `+ Create` item opens the shared Creation Hub. The hub’s current options include a post, Afterglow story, Moment, highlight, marketplace listing, skill offer, poll, event, and confession. The item now has an accessible name and tooltip when the sidebar is collapsed.
- **Keep create and message actions separate:** the floating homepage button is exclusively for Messages; content creation remains under the sidebar `+`. The mobile navigation’s existing create button/menu is unchanged.
- **Validation performed:** focused ESLint on `FloatingAction.tsx` and `Sidebar.tsx`, plus `git diff --check`. No browser interaction, responsive-device, keyboard, or screen-reader test has been performed.

### Additional code-derived findings

These findings came from tracing the page implementation against the API routes/controllers. They should be fixed or explicitly accepted before the related feature is presented as complete.

#### P0 — Release and trust blockers

- **Ads is a local simulation, not a campaign feature.** [Ads page](./frontend/src/pages/Ads.tsx) (lines 27, 74, 109–123) initializes campaigns from `MOCK_CAMPAIGNS` and simulates submission with a timeout; no campaign create/list endpoint was found in the reviewed API routes/controllers. It displays a success message and deducts nothing server-side. Either implement a real campaign backend with moderation, billing, authorization, and audit history, or mark creation unavailable and remove sample/live-looking campaign data. Never present simulated campaigns or submission as real.
- **Marketplace order mock IDs can show false completion.** [MarketplaceOrder page](./frontend/src/pages/MarketplaceOrder.tsx) (lines 36–92) has mock listing and order-success branches for IDs beginning `l-` or `mock-`. Remove them from production flows or isolate them behind an explicit development-only flag that cannot be enabled in a release build.
- **Support can report success when no ticket is created.** [Support page](./frontend/src/pages/Support.tsx) (lines 44, 59) uses plural `/support/tickets` endpoints, while [support routes](./backend/routes/api/support.routes.js) (lines 27, 36–56) expose a singular create endpoint and no ticket-list endpoint. The create handler also catches a storage error and returns success. Align and implement the list/create contract, return success only after durable storage, and verify a submitted ticket is visible after reload.
- **Production releases have no effective automated test gate.** [`npm test`](./package.json) (line 23) exits with an error, while [release workflow](./.github/workflows/release.yml) (lines 17–24, 57–91) builds and publishes OTA/APK artifacts without running tests. Add working focused test commands and make required checks pass before publishing; prove a failing check blocks release.
- **Wallet deposit callbacks can acknowledge and deduplicate an incomplete credit.** [Wallet controller](./backend/controllers/wallet.controller.js) (lines 236, 252–260) acknowledges the provider callback and records it handled before the deposit confirmation has completed. A transient failure can therefore prevent a provider retry from crediting the wallet. Persist callback work durably, mark it complete only after the ledger transaction commits, and test retry plus exactly-once credit behavior.
- **Wallet settlement does not reconcile provider amount/currency with the pending deposit.** [Wallet service](./backend/services/wallet.service.js) (lines 259–261, 306) credits the amount and currency returned by provider verification without comparing them with the stored pending deposit. Reject and flag mismatches before changing the ledger or balance; tests must prove mismatch leaves balances unchanged.
- **Withdrawal execution is not durably recoverable across process failure.** [Wallet service](./backend/services/wallet.service.js) (lines 370–438, 470–570) commits the withdrawal then starts provider transfer work in-process; a process exit can strand it, and a database update failure after provider success can be mistaken for transfer failure/refund. Move execution to durable retryable processing with provider idempotency and reconciliation; test restart and post-provider persistence failures without duplicate payout or incorrect balance.

#### P1 — Data integrity, user control, and error-state correctness

- **Some notification deep links do not match registered app routes.** [Notifications page](./frontend/src/pages/Notifications.tsx) (lines 245, 305) builds `/orders/:id`, `/marketplace/listing/:id`, and singular `/moment/:id`, while [App routes](./frontend/src/App.tsx) register `/marketplace/orders`, `/marketplace/listings/:id`, and `/moments/:id`. Centralize target-to-route mapping and test every notification type, deleted/private targets, and authentication redirects.
- **Ads currency units are inconsistent.** [Ads page](./frontend/src/pages/Ads.tsx) (lines 101–104, 204–208) labels the entry in KES and converts the amount to cents, but validates the entered value against `100000` while telling the user the minimum is KES 1,000. Decide whether the input is KES or minor units, use one typed money representation, and test min/max/balance boundaries against the server.
- **Wallet verification is not scoped to the signed-in owner, and amount parsing is permissive.** [Wallet routes](./backend/routes/api/wallet.routes.js) (line 13) authenticate deposit verification, but [wallet controller](./backend/controllers/wallet.controller.js) (lines 36–47, 116–126) looks up by reference without requiring it to belong to the current user and partially parses malformed/fractional values using `parseInt`/`parseFloat`. Bind references to the authenticated account and require valid safe-integer minor units; test cross-account references, malformed values, fractions, and overflow.
- **Club detail and leave actions do not match the backend contract.** [ClubDetail page](./frontend/src/pages/ClubDetail.tsx) (lines 46–48, 67) requests `GET /clubs/:id/posts`, which is not registered, inside a `Promise.all` that can prevent the detail page from loading; it also uses `DELETE /clubs/:id/leave` while [club routes](./backend/routes/api/clubs.routes.js) (lines 11–16) register `POST`. Align routes and prove detail loading/leave works with API integration tests.
- **Group request-status and branding actions use unregistered methods/paths.** [GroupDetail page](./frontend/src/pages/GroupDetail.tsx) (lines 77, 122) requests a missing `GET /groups/:id/my-request` and sends `PUT /groups/:id/branding`; [group routes](./backend/routes/api/groups.routes.js) (line 35) expose a different update operation. Define a single API contract, ensure authorization for branding changes, and test pending-member status and authorized uploads.
- **Messaging attachment failure can upload fake placeholder content.** [Messages page](./frontend/src/pages/Messages.tsx) (lines 1076–1082) substitutes a blob containing `"mock content"` if fetching selected media fails, then proceeds as if it were an attachment. Abort the send, show an actionable error, and test that no upload/message is created on fetch failure.
- **Messaging media-access copy does not invoke a permission flow.** [Messages page](./frontend/src/pages/Messages.tsx) (lines 5900–5914) has an “Allow Access” action that only changes local permission state. Request and reflect the actual platform permission, or relabel it to describe the browser file picker; verify grant and denial behavior on supported web/Android targets.
- **Events tabs and RSVP handling are misleading.** [Events page](./frontend/src/pages/Events.tsx) (lines 22, 64–84) sends no distinct filter for “Trending,” so it returns the same unfiltered request as “All”; RSVP failures are logged without user feedback. Implement a real ranking/filter contract or remove the tab, and show errors while preserving the last confirmed RSVP state.
- **Optimistic notification read state can diverge from the server.** [Notifications page](./frontend/src/pages/Notifications.tsx) (lines 104–108, 141–171) updates local state before the request and silently ignores failures for individual and bulk read actions. Roll back or clearly display unsynced state and provide retry; test both failure paths.
- **Settings can look saved when theme persistence fails.** [Settings page](./frontend/src/pages/Settings.tsx) (lines 92–95) changes the local theme and suppresses errors from the settings API. On persistence failure, restore the previous value or clearly report that the change was not saved; test reload and cross-session behavior.
- **Dashboard “trends” are hard-coded sample counts.** [Dashboard page](./frontend/src/pages/Dashboard.tsx) (lines 186–191, 662–666) displays fixed trend names and counts as current. Replace them with measured server data or label/remove the sample values so users are not shown fabricated activity.
- **Marketplace settings include controls that appear presentational.** [MarketplaceSettings page](./frontend/src/pages/MarketplaceSettings.tsx) explicitly says payout setup is unavailable; private-shop and message-preference controls need verification that they persist via an API. Disable unavailable controls rather than making static toggles look active. Do not allow ad/campaign or seller payout flows to imply money movement before payment provider and reconciliation support are implemented.
- **Explore can turn API errors into an empty feed.** [Explore page](./frontend/src/pages/Explore.tsx) catches feed and moments requests and substitutes empty data. Distinguish an actual empty result from a failed request, surface retry/offline states, and test partial success when only one feed source fails.
- **Explore and visible dashboard metrics need data provenance and resilience checks.** For feed errors, preserve cached/current data where appropriate and distinguish a true empty response from an outage. For every displayed count/rank, document its source, freshness, and whether it is measured or illustrative.
- **Avoid silent failure fallbacks in user actions.** Audit the app for `.catch(() => {})`, catch-and-return-empty behavior, and success notifications without persisted server confirmation. For each action, define whether failure should retry, remain visible, or offer recovery; log operational detail without exposing it to ordinary users.
- **Creator-owned editing needs an action-by-action audit.** Verify the frontend has owner-facing edit/delete controls for posts, polls, moments, stories, skills, and listings, and that each is backed by an API operation. For each, test server-side ownership, validation, notification behavior, media cleanup, and how an edited/deleted item appears in feeds and saved views.

#### Audit-needed — Runtime, worker, and broader journey verification

- **Readiness can be reported before database initialization finishes.** [Server startup](./backend/server.js) (lines 107–115, 341–355) binds the listener before `initDB()` completes, while `/health` is success-only. Confirm the deployment probes readiness correctly; readiness must stay false until required initialization succeeds.
- **Reminder worker may send duplicates across overlapping instances.** [Inactivity notifier](./backend/workers/inactivityNotifier.js) (lines 7–40) reads unsent reminders, sends them, and then marks them sent without an atomic claim. Verify the deployed replica/scheduler topology; if multiple workers can overlap, use a claim/lease or another idempotent mechanism and test concurrent runs.
- **Frontend flow audit:** club/group detail, event trend/Rsvp behavior, messaging permissions/attachments, support ticket history, and every notification target need integration tests against the deployed API and registered app routes. The code review was static; no live API, email/push delivery, database failure, or device permission test was performed.
- **Uncovered/partially covered surfaces:** perform the page inventory below as journey-by-journey testing; a page list is not evidence that each journey has passed. Record actual coverage for AI, search, wallet history/withdrawals, boosts, clubs, group membership, event administration, live streams, lost-and-found, skills, support, and admin moderation.

#### Existing work to verify, not rebuild blindly

- **30-day account deletion grace period is already represented in the backend.** [Account lifecycle service](./backend/services/accountLifecycle.service.js) schedules deletion 30 days after a request and has cancellation logic; [Account Recovery page](./frontend/src/pages/AccountRecoveryPortal.tsx) exposes cancellation. Verify the actual scheduled worker runs, pending-deletion sessions are revoked, cancellation restores access, and deletion is irreversible only after the deadline. The feature should not remain labeled “not implemented.”
- **Story authors are already excluded from their own viewer records.** [Feed controller](./backend/controllers/feed.controller.js) skips view recording for the owner and restricts viewer lists to the owner. [StoryViewer page](./frontend/src/pages/StoryViewer.tsx) tracks the owner’s current story separately. Test the requested WhatsApp-like ordering/seen behavior on device rather than replacing this backend rule.
- **A security transaction system already exists.** [Security routes](./backend/routes/api/security.routes.js) and [Change Password page](./frontend/src/pages/ChangePassword.tsx) implement factor selection, verification, and a scoped token for password changes. Validate this end-to-end, ensure the password change endpoint consumes the transaction token safely, and connect it to the user's stated “current password/re-authentication” requirement rather than adding a second competing password flow.
- **Marketplace boosts and wallet endpoints exist, but are distinct from ad campaigns.** [Boost routes](./backend/routes/api/boost.routes.js), [boost controller](./backend/controllers/boost.controller.js), and wallet routes provide boost and wallet operations. Verify server-side price calculation, idempotent charging, refunds/expiry, ledger reconciliation, and truthful reach language. Do not reuse boost as an ad campaign without a separate product contract.

### P0 — Account safety and user trust

- **Admin dashboard:** professionalize the dashboard. Admin API routes already require authentication and admin middleware ([admin routes](./backend/routes/api/admin.routes.js)); add step-up verification for sensitive actions using the existing server-verified security transaction system, not a client-only PIN. Rate-limit attempts, audit access, and provide recovery. A 6–8 digit code alone is not a strong security boundary.
- **Change password:** require the current password or a recent re-authentication step; rate-limit attempts and notify the user after changes.
- **Account recovery portal:** the backend already schedules account deletion after 30 days. Verify the public flow, cancellation path, identity verification, final deletion scheduler, and user-facing deadline/status; add coverage for exact deadline and timezone boundaries. Recovery challenges currently need a security hardening pass: use a cryptographically secure generator, store only a verifier/hash, enforce consistent rate limits, and ensure the scoped action token is short-lived, one-time, and bound to the requested action.
- **Sign-up:** temporarily remove Google sign-up if unsupported; ensure it is removed consistently from the UI and auth config.
- **Login / remember me:** verify persistence duration, secure token storage, logout/revocation, and behavior after app restart on web and Android.
- **Confessions:** define what “anonymous” means, prevent identity exposure through API/logs/notifications, and provide abuse reporting and moderation. Do not promise absolute anonymity if operators can identify authors.

### P1 — Core navigation and daily-use experience

- **Bottom navigation:** requested order is Home, Connect, Explore, Create (+), Messages, Moments, Profile. Confirm selected states, accessibility, route behavior, and compact/mobile layouts.
- **Universal loader:** standardize loading presentation using the splash-screen loader where appropriate; distinguish initial app boot from local page/action loading and avoid blocking the entire app for small requests.
- **Messages:** make surfaces follow light/dark theme. On Android, verify keyboard resizing, safe areas, scroll position, and composer visibility on physical devices; avoid forced viewport jumps.
- **Notifications:** clicking each notification should open the referenced post, profile, message, listing, or event. Provide fallback for deleted/private targets and mark as read consistently.
- **Explore:** after skeletons, prioritize visible image/video previews; lazy-load below the fold, respect data-saving preferences, and avoid delaying first interaction.
- **Stories:** the author should see their own story in the author view, not count themselves as a viewer; move viewers between unseen/seen states only after actual viewing. Verify privacy and expiry rules.
- **Moments feed:** default audio unmuted as requested, with a clear pause/mute control; test autoplay policy, accessibility, and data usage. Rank content using a documented, explainable feed policy rather than random repetition.
- **Profiles / Accounts Center:** replace generic loading text with consistent loading states; test mobile safe areas, dialogs, and content overlap at narrow widths.

### P1 — Creation, ownership, and monetization

- **Creator controls:** provide a clear owner-facing place to edit, remove, or mark owned posts/listings as sold; include skills and price updates. Enforce ownership in the backend and confirm the public view updates. Preserve author story self-view exclusion and ensure user-facing seen state reflects actual viewing.
- **Ads:** the current Ads screen is a mock. Define advertiser eligibility, campaign creation, targeting/privacy rules, budgets, billing, review, reporting, and ad labeling before building a Meta-like advertising product. Keep this separate from paid listing boosts.
- **Boosts:** document what a boost changes, its price/payment lifecycle, duration, eligibility, and disclosures. Never imply guaranteed reach or engagement.
- **Creator Studio / Creator Analytics:** verify data provenance, date ranges, empty states, and whether each displayed metric is actually measured.
- **Polls and moments:** connect creator moderation/removal tools and document how deleted or expired content appears to participants.

### P2 — Remaining page inventory

Audit the following pages/flows and record their status, gaps, and test coverage:

- **Account and settings:** Advanced Settings, Blocked Users, Data Center, Forgot Password, Reset Password, Security Center, Settings, Verify Email.
- **Social and community:** Club Details, Clubs, Connect, Follow Requests, Group Admin, Group Details, Groups, Hashtags, Invite, Invite Landing, Onboarding.
- **Content and discovery:** Create Moments, Create Story, Explore, Gallery, Memories, Moments, Notifications, Poll Details, Polls, Post Details, Search, Search History, Story Snapshot, Story Viewer.
- **Marketplace and commerce:** Listing Details, Lost and Found, Marketplace, Marketplace Chat, Marketplace Order, Marketplace Safety, Marketplace Settings, My Listings, Orders, Report Listing, Seller Profile, Sell Item, Wishlist, Skill Hub, Skill Marketplace.
- **Live, creator, and utility:** Ads, Creator Analytics, Creator Studio, Events, Event Admin, Help, Learn More, Legal Viewer, Locked Live, Professional Dashboard, Sparkle Hub, Sparkly Bot, Storage Intelligence Panel, Streams, Support, Verified, Wallet History.
- **Errors and navigation:** Not Found / error handling, route permissions, deep links, and notification destinations.

### Final-product readiness backlog — audit needed

The following are additional product-wide workstreams, not claims that each is currently broken. Inspect the implementation, assign owners/priorities, write focused tickets for verified gaps, and record evidence before marking them complete.

#### Product completeness and consistent user experience

- **Journey map and state coverage:** map each supported user goal from entry point to completion, including first-time, returning, empty, loading, offline, retry, validation, permission-denied, and cancelled states. Remove dead ends, duplicate flows, placeholder actions, and success-shaped mock data.
- **Navigation and content consistency:** verify every visible link, push notification, email link, deep link, back action, and Android system-back behavior against registered routes and authorization rules. Provide useful not-found/deleted/private-content states.
- **Design system and localization:** standardize components, typography, spacing, colors, theme behavior, date/time, currency, pluralization, and language handling. Check truncation and translation expansion on small screens.
- **User preferences:** ensure theme, notification preferences, privacy settings, and relevant feed/media preferences are stored, restored across devices as intended, and honored by every affected surface.

#### Backend, data, and integration reliability

- **API contract inventory:** document routes, methods, auth requirements, request/response schemas, pagination, error shape, idempotency, and ownership rules. Add contract tests that catch frontend/backend drift.
- **Database integrity and migrations:** review constraints, indexes, foreign keys, transaction boundaries, migration rollback/retry behavior, seed data, and production migration safety. Test upgrades from a production-like prior schema.
- **Background work and external services:** inventory schedulers, queues, email/SMS, object storage, push notifications, payment providers, and AI integrations. Define retries, timeouts, idempotency, dead-letter/replay handling, and operator alerts. Do not silently replace a failed dependency with fabricated success.
- **Consistency and recovery:** define behavior for duplicate requests, app restarts, token expiry, network interruptions, partial uploads, stale caches, and concurrent edits. Make destructive or financial actions safe to retry.
- **Data lifecycle:** define retention, deletion, export, backup, restore, and anonymization for user content, messages, media, logs, analytics, and moderation records. Verify actual behavior rather than relying on UI copy.

#### Security, privacy, and safety

- **Threat and permission review:** audit authentication, session revocation, authorization at every API boundary, object-level ownership, admin/support access, rate limits, input validation, secret handling, and dependency updates.
- **Privacy controls:** document what profile/content data is public, who can see it, how blocking affects existing and future interactions, and how private content appears in search, feeds, notifications, and cached views.
- **Abuse response:** provide report/block/mute flows for applicable content and users; define moderation queues, escalation, appeals, reviewer permissions, audit trails, and user feedback without promising a particular outcome before review.
- **Secure account lifecycle:** test signup verification, recovery, password/credential changes, MFA/step-up verification, lost-device response, account suspension, deletion grace period, and post-deletion token/session invalidation.
- **Sensitive-data handling:** minimize personal data in logs, analytics, notifications, and error reports; define redaction, access, and retention policies.

#### Quality, accessibility, and performance

- **Automated test strategy:** cover unit/business rules, API integration, database migrations, frontend component behavior, end-to-end critical journeys, authorization failures, and regression cases. Keep deterministic fixtures and avoid tests that rely on production accounts/services.
- **Accessibility:** validate keyboard-only operation, visible focus, semantic labels, contrast, screen-reader announcements, reduced motion, captions/alternatives for media, and accessible validation/errors.
- **Responsive and Android usability:** test supported viewport sizes, safe areas, notches, keyboard/IME resize, gestures, lifecycle pause/resume, permissions, offline/reconnect, and app-link handling on physical devices as well as emulators.
- **Performance and data use:** set measurable budgets for startup, route transitions, API latency, feed rendering, image/video transfer, memory, and battery. Test low-end Android devices and constrained networks; add caching only with correct invalidation/privacy boundaries.
- **Resilience:** test server restarts, database/network failures, slow APIs, expired auth, rate limiting, partial dependency outages, and retry behavior. Distinguish empty state from failure and expose a safe next action.

#### Release, operations, and support

- **Environment/release parity:** define development, staging, and production configuration; validate required variables and prevent localhost, test credentials, debug flags, and mock data from entering release artifacts.
- **Web/Android release verification:** verify versioning, signing secrets, Capacitor/native plugin compatibility, permissions, deep links, API/socket hosts, OTA compatibility and rollback behavior, APK installation/update, and release notes. Test the produced artifact, not only the source build.
- **Observability:** establish health checks, structured/redacted logs, error and performance monitoring, key journey metrics, alert ownership, and dashboards. Verify alerts using controlled staging failures.
- **Backup and incident recovery:** document and test database/media backups, restore time/objectives, incident roles, escalation contacts, credential rotation, and rollback procedures.
- **Support and policy readiness:** provide a discoverable support/contact path, ticket status and ownership controls, privacy policy/terms, account/data request handling, and clear guidance for payment, marketplace safety, and moderation. Confirm legal/product claims match actual behavior.
- **Rollout control:** use staged rollout/feature flags for risky changes where appropriate, define rollback criteria, and verify old clients remain compatible with backend changes during deployment.

## User-facing language audit

Replace developer-facing or misleading phrases—including words such as “node,” “sync,” internal engine names, and technical status labels—with plain language that explains the user's next step. Do not expose internal implementation details unless needed for troubleshooting.

**Acceptance criteria**
- Maintain a glossary for user-visible terms and a list of approved transaction/safety claims.
- Review labels, error messages, loading states, empty states, notifications, and Android permission prompts.
- Keep technical detail in developer/admin diagnostics, not ordinary consumer screens.
- Check translations, truncation, and screen-reader wording for all changed strings.

## Definition of done for each roadmap item

Before marking an item complete:

1. Record its priority, owner, status, affected page/API/model, and dependencies.
2. Define expected behavior for normal, loading, empty, error, offline, unauthorized, and mobile states as relevant.
3. Enforce permissions and business rules on the server; frontend-only hiding is not authorization.
4. Add focused tests for the required behavior and important failure cases.
5. Validate responsive web and Android behavior where applicable.
6. Update this document with implementation status and evidence; do not label an item “done” based only on the page existing or the bundle compiling.
