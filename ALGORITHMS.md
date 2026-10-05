# Algorithms — Current Inventory & Candidate Roadmap

**Part A** inventories the algorithms this codebase already ships (every `file:line` verified 2026-10-05 via grep/read).
**Part B** is the roadmap of algorithms we *can add*, each with mechanics, plug-in point, tier, and score.
**Part C** is the scored, phased plan.

**Ratings (Part A):** `production-grade` (correct, tested, sane defaults) · `fragile` (works, but wrong under edge cases or duplicated/dead) · `placeholder` (mock/stub/pretend data) · `bug` (broken at runtime).

**Scoring (Parts B/C), 1–5 each:**
- **Impact** — user-visible quality. 5 = daily-driver, 1 = niche.
- **Sec** — security/abuse value. 5 = closes a known attack class, 1 = none.
- **Cap** — capacity/reliability value. 5 = lifts max concurrent users / prevents outages, 1 = none.
- **Effort** — inverted cost. 5 = ≤½ day, 4 = ~1 day, 3 = 2–4 days, 2 = 1–2 weeks, 1 = large/ongoing.
- **Total** = I + Sec + Cap + Effort (max 20).
- **Tier:** `H` heuristic (JS/SQL/Redis only, no new services) · `M` local ML (npm lib, in-process) · `X` external service/API.

**Phases:** `A` = quick wins (H, effort ≥ 4), ship one at a time · `B` = medium heuristic builds · `C` = heavy/ML/external, revisit after A+B.

---

## Part A — Existing algorithms

### A1. Home feed weighted scorer — `models/Post.js:466` (`getFeed`)
- Mechanism: `final = discovery × categoryAffinity × trendBoost × dwell × skipPenalty × replayBoost × fatigueMultiplier` (`:683`), after a weighted pass `0.5·followed + 0.3·interest + 0.15·trending + 0.05·discover` (`:660`), exponential time decay (Algorithm 7.7 comment, `:665`), and a 10% "guided exploration" roll ×(1.3 + 0.5·random) (`:687`).
- **`discover_score = Math.random()` (`:660`) and exploration uses `Math.random()` (`:687`) → ranking is non-reproducible** (same user + same data → different order; cache `feed:candidate_pool` at `:560` and 60s result memo at `:768` freeze a random draw per window).
- `dwellScore/skipPenalty/replayBoost` are hard-coded `1.0` (`:671-673`) — dead multipliers; fatigue is binary (`recentCount/20 > 0.6 → ×0.85`, `:680-681`).
- **Rating: fragile.**

### A2. Category-affinity sigmoid + interaction counters — `models/Post.js`
- Mechanism: per-category engagement → sigmoid `calculateCategoryAffinity` (`:1478` live copy), stats in Redis `user:{id}:category_stats` (hgetall, 24h TTL `:446`), incremented via `hincrbyfloat` on likes/dwell/skips/replays (`:438-441`).
- **Both `getCategoryStats` and `calculateCategoryAffinity` are defined twice** (`:354/:398` and `:1478/:1435`); JS class semantics → later definition wins, earlier copy is unreachable dead code. Confirm intended variant before deleting.
- Also: recent-category session window `lrange/lpush` 1h TTL (`:528-543`).
- **Rating: fragile** (duplication; all-time sums never decay — see B4).

### A3. Trend score — `models/Post.js:~655` (and duplicate `:~1495`)
- Mechanism: `min(1.0, (sparks×3 + comments×5) / (views + 10))`.
- Issues: no time window (old posts trend forever), view-count denominator is gameable, duplicated alongside A2's duplicates.
- **Rating: fragile.**

### A4. Feed candidate pool — `jobs/candidatePool.js`
- Mechanism: cron `0 */3 * * * *` (`:58`) builds a **global** `LIMIT 150` (`:23`) candidate set into Redis key `feed:candidate_pool`.
- Issues: one pool for all users (recall cap starves long-tail/affiliation variety); 3-min staleness; not per-user segmented.
- **Rating: fragile.**

### A5. Moments ranking — `services/moments-ranking.service.js`
- Mechanism: `base_score = (sparks / (views + 10)) × completion_rate × quality_score` (`:84`), preselect top 200 (`:88`), then **Fisher–Yates shuffle within score bands per user** (`:17,28-29`) so ties differ across users — the *right* way to do what A1 does with `Math.random()`.
- **Rating: production-grade** (still inherits the views+10 trend-formula weaknesses).

### A6. Session interest (SIV engine) — `services/session-interest.service.js`
- Mechanism: Redis key `siv:{userId}`; weighted event formula (watch-time, skip −5, like +10, comment +15, share +20, save +15, rewatch +8) feeding Home Feed v7.7.
- Issues: weights are hand-tuned and untested; no decay/rebalance logic verified.
- **Rating: fragile** (sound structure, unvalidated constants).

### A7. Moderation scoring — `services/moderation.service.js:42` (`evaluatePost`)
- Mechanism: explicitly *"mock scores based on report count"* (`:62`) → writes `moderation_scores` (toxicity/nsfw/violence `:71`) → auto-hide / `visibility_score` (`:94,160`).
- **Rating: placeholder.**

### A8. Username suggester — `services/auth.service.js:112` (`generateAvailableUsernames`)
- Mechanism: Instagram-style separator transforms → name-derived candidates → numeric ladder (`:137,160`); used by check-username, suggestions, signup 409s, profile 409s.
- **Rating: production-grade** (probe suite 18/18 green).

### A9. Message dedup / status merge — `frontend/src/store/chatStore.ts:548-575`
- Mechanism: exact-ID match → status-rank merge `sending 0 < sent 1 < delivered 2 < read 3`, `failed −1` (never downgrade).
- **BUG: `existing` is referenced in 8 places (`:561-568`) but never declared** (should be `currentMsgs[exactIndex]`) → `ReferenceError` on the first socket-echoed duplicate message.
- **Rating: bug.**

### A10. Privacy-settings cache write — `frontend/src/hooks/useMessageSocket.ts:140`
- Mechanism: fetch per-chat privacy settings → `SparkleStorage.setPrivacyCache(...)`.
- **BUG: `SparkleStorage` is never imported in this file** (all other callers import from `services/SparkleStorageService`) → `ReferenceError` whenever the fetch succeeds.
- **Rating: bug.**

### A11. Inbox conversation ordering — `frontend/src/pages/Messages.tsx:3408-3420`
- Mechanism: strict tiers — pinned → priority/favorite → `last_message_at` desc.
- **Rating: production-grade.**

### A12. Password/OTP hashing
- Mechanism: bcrypt, but **inconsistent cost**: 12 at `services/auth.service.js:286` and `controllers/auth.controller.js:724`, 10 at `controllers/user.controller.js:511`, `controllers/security.controller.js:1269`, and all OTP hashes (`auth.controller.js:149,534`, `security.controller.js:27,640`); mix of `bcryptjs` and native `bcrypt`.
- Anti-enumeration dummy compare is correct (`controllers/auth.controller.js:75-78`, fixed hash, constant-time).
- **Rating: fragile** (cost split means equal passwords hash differently per code path).

### A13. Rate limiting
- Mechanism: `express-rate-limit` — `loginLimiter` **is** wired on `POST /login` (`routes/api/auth.routes.js:34`), plus `strictLimiter` and user-keyed limiter (`middleware/rateLimiter.middleware.js`).
- Gap: limits are per-IP; **no per-account failure counter** — `login_attempts` table exists (`utils/database/init.js:2003`) but *nothing reads or writes it* (dead schema), and `ACCOUNT_LOCKED` (`auth.controller.js:120`) only reflects a manually-set status.
- **Rating: production-grade** (the per-account lockout gap is tracked as B14).

### A14. Refresh tokens
- Mechanism: 40-byte random hex (`services/auth.service.js:23`), stored **plaintext** in `refresh_tokens` (`:28`, verified by `SELECT ... WHERE token = ?` `:38`), rotation deletes the old token (`:59`) but has **no token-family / reuse detection**; client keeps the token in zustand `persist` → **localStorage** (`frontend/src/store/userStore.ts:2,32`); signup also writes `sparkle_signup_refresh` (`Signup.tsx:179`).
- **Rating: fragile.**

### A15. Analytics engagement stats — `controllers/analytics.controller.js:287-291`
- Mechanism: real DB engagement counts, but when zero it falls back to `getDeterministicValue(userId + 'sparks', …)` **fabricated numbers**, then `applyBoost` on top — fake values presented as real stats.
- **Rating: placeholder** (misleading; see B25).

---

## Part B — Candidate algorithms (what we can add)

### Feed & discovery

**B1. Deterministic feed scoring** — replace `Math.random()` discover/exploration with a stable per-(user,post) hash (seeded noise) or an engagement-derived novelty term; delete the three dead `=1.0` multipliers; resolve the A2/A3 duplicate methods. *Plug-in:* `models/Post.js:660,671-673,687`. Tier `H`. Makes ranking reproducible, cacheable, and A/B-testable — prerequisite for tuning anything else.

**B2. Diversity re-ranking (MMR-style)** — after scoring, cap consecutive same-category/same-author items; penalize near-identical sources; spread-affiliation quotas. *Plug-in:* final ordering in `getFeed` before cache (`models/Post.js:768`). Tier `H`. Fights feed echo chambers.

**B3. Cold-start feed** — for users with little history: rank by affiliation/campus trending + onboarding-declared interests + fresh-content floor instead of empty affinity. *Plug-in:* `getFeed` when category stats empty (`models/Post.js:547`). Tier `H`.

**B4. Decaying interest model (EMA)** — replace all-time `hincrbyfloat` sums with exponentially-decayed per-category EMAs (half-life ~7d) so interests track current taste. *Plug-in:* counters at `models/Post.js:438-441`, read at `:1467`. Tier `H`.

**B5. Author reputation prior** — dampen/surface authors by: account age, verification, report ratio (sustained), reply latency of their audience. Multiplier in final score. *Plug-in:* `models/Post.js:683`. Tier `H`. Also suppresses low-quality posters and reply-bait.

**B6. People-you-may-know** — score non-followed users by: mutual-follow overlap, shared groups/clubs, same affiliation + interaction proximity. *Plug-in:* new `services/recommend.service.js` + existing follow graph. Tier `H`. Standard follow-growth lever; no history needed beyond graph.

**B7. Marketplace recommendations** — "viewers also viewed" item-based co-visitation + seller reputation (deal completion, dispute ratio, response time). *Plug-in:* `controllers/marketplace.controller.js`. Tier `H` → `M` (co-visitation first, embedding upgrade later). Needs interaction logging (absent today).

**B8. Proper trending** — velocity vs. per-category baseline over time buckets (e.g., 5-min windows in Redis ZSET), novelty decay, minimum-velocity gate — replaces A3's gameable views+10 formula everywhere it's used. *Plug-in:* `models/Post.js:655,1495` + moments. Tier `H`.

### Search

**B9. FULLTEXT/BM25 search** — add MySQL `FULLTEXT` indexes (posts, marketplace, users) + `MATCH … AGAINST` with relevance ordering; currently **confirmed absent** (no `FULLTEXT`/`AGAINST` anywhere in server code). *Plug-in:* search endpoints + boot DDL (ties into pending M6 boot-DDL work). Tier `H`.

**B10. Typo tolerance** — trigram (3-gram) similarity or `SOUNDEX` fallback for short queries and usernames. *Plug-in:* search query path. Tier `H`.

**B11. Trending search queries** — ranked autocomplete from query logs (time-weighted counts, Redis ZSET); requires query-log capture that doesn't exist yet. *Plug-in:* search UI. Tier `H`.

### Messaging

**B12. Inbox priority ranking** — replace A11's pure tier+time with a thread score: unread recency × reply-latency expectation × pinned × muted-decay, keeping pinned as a hard tier. *Plug-in:* `frontend/src/pages/Messages.tsx:3408` + `chatStore`. Tier `H`.

**B13. Rapid-fire message throttle** — per-conversation token bucket (Redis) + exact/near-duplicate content hash to stop spam blasts and auto-retry storms. *Plug-in:* message POST middleware. Tier `H`.

### Security & abuse

**B14. Per-account login lockout** — wire the dead `login_attempts` table (or Redis counter): N failures per account (IP-agnostic) → exponential-backoff lockout surfaced via the existing `ACCOUNT_LOCKED` 423 path (`auth.controller.js:120`), reset on success. Closes credential-stuffing that per-IP limits miss (attacker rotates IPs). *Plug-in:* `auth.controller.js` login flow. Tier `H`.

**B15. Refresh-token hardening** — hash tokens at rest (SHA-256 lookup), token-family IDs with reuse detection (stolen-token replay ⇒ revoke family), move client storage out of persisted localStorage toward httpOnly cookie or memory. *Plug-in:* `services/auth.service.js:23-59`, `frontend/src/api/api.ts:123-138`. Tier `H`.

**B16. Adaptive rate-limit tiers** — tighten limiter budgets as a function of live load (pool wait queue / p95 latency / error rate), relax when healthy. *Plug-in:* `middleware/rateLimiter.middleware.js` + pool metrics. Tier `H`. Turns rate limits into a load-shedding valve.

**B17. Real toxicity/NSFW scorer (lexical tier)** — replace A7's report-count mock with a weighted lexicon/regex tier (slurs, harassment patterns, spam signatures, link/phone spam) + report-signal weighting; keep `moderation_scores` schema so an ML model (`M`) can slot in later. *Plug-in:* `services/moderation.service.js:62`. Tier `H` (→ `M`).

**B18. Report triage scoring** — order the admin queue by `severity × reporter credibility × target's recent-report history`, not arrival time. *Plug-in:* `controllers/admin.controller.js` reports aggregate. Tier `H`.

**B19. Sockpuppet/alt signals** — signup-time risk score from IP/device reuse, email/name similarity to existing accounts, burst timing, disposable-domain emails; soft-flag for review rather than block. *Plug-in:* signup flow (`auth.service.js`). Tier `H` → `M`.

**B20. Near-duplicate spam detection** — SimHash/MinHash over post & message text; cluster and quarantine high-similarity bursts. *Plug-in:* post/message pipeline. Tier `H`.

### Capacity & reliability

**B21. Cache stampede protection** — jittered TTLs + `SETNX` lock or stale-while-revalidate on `feed:candidate_pool`, `feed result` 60s memo (`Post.js:768`), and `user:{id}:category_stats`. Tier `H`. Cheap; protects Redis/MySQL at high concurrency.

**B22. Anomaly detection on health signals** — EWMA + z-score over error rate, pool wait time, socket disconnects; auto-alert and trigger B16/B23. *Plug-in:* existing pool metrics + logger. Tier `H`.

**B23. Graceful load-shedding** — under pressure: skip exploration/affinity scoring (serve cached feed), drop non-critical fan-out (notifications batch), reject lowest-value writes first. *Plug-in:* middleware gate keyed off B22 signal. Tier `H`.

**B24. Pool autotuning** — size the MySQL pool from observed wait-queue depth and query latency instead of a fixed constant. *Plug-in:* `config/database.js` pool setup. Tier `H`.

### Analytics & engagement

**B25. Honest analytics** — remove `getDeterministicValue` fabricated fallbacks (`analytics.controller.js:287-291`); show real zeros / empty states. Also un-fake `applyBoost` outputs. Tier `H`. Not an algorithm so much as an anti-algorithm — but it corrupts every metric-driven decision.

**B26. Churn/retention signals** — per-user session-cadence exponential decay → risk band → re-engagement prompts (and a cohort view for admins). Tier `M`.

---

## Part C — Scorecard & phases

### Scorecard (sorted within phase by Total)

| # | Candidate | I | Sec | Cap | Eff | Total | Tier | Phase |
|---|-----------|---|-----|-----|-----|-------|------|-------|
| B14 | Per-account login lockout | 3 | 5 | 4 | 4 | **16** | H | **A** |
| B13 | Rapid-fire message throttle | 3 | 4 | 4 | 4 | **15** | H | **A** |
| B1 | Deterministic feed scoring | 5 | 1 | 3 | 4 | **13** | H | **A** |
| B17 | Lexical toxicity (replace mock) | 3 | 4 | 2 | 4 | **13** | H | **A** |
| B21 | Cache stampede protection | 2 | 0 | 5 | 5 | **12** | H | **A** |
| B25 | Honest analytics | 3 | 0 | 3 | 5 | **11** | H | **A** |
| B8 | Proper trending | 4 | 3 | 4 | 3 | **14** | H | **B** |
| B16 | Adaptive rate-limit tiers | 2 | 3 | 5 | 3 | **13** | H | **B** |
| B6 | People-you-may-know | 5 | 2 | 2 | 3 | **12** | H | **B** |
| B9 | FULLTEXT/BM25 search | 4 | 1 | 4 | 3 | **12** | H | **B** |
| B5 | Author reputation prior | 3 | 4 | 2 | 3 | **12** | H | **B** |
| B18 | Report triage scoring | 3 | 4 | 2 | 3 | **12** | H | **B** |
| B4 | Decaying interest (EMA) | 4 | 1 | 3 | 3 | **11** | H | **B** |
| B12 | Inbox priority ranking | 4 | 1 | 3 | 3 | **11** | H | **B** |
| B15 | Refresh-token hardening | 2 | 5 | 1 | 3 | **11** | H | **B** |
| B22 | Anomaly detection (health) | 1 | 2 | 5 | 3 | **11** | H | **B** |
| B2 | Diversity re-ranking | 4 | 1 | 2 | 3 | **10** | H | **B** |
| B3 | Cold-start feed | 4 | 1 | 2 | 3 | **10** | H | **B** |
| B23 | Graceful load-shedding | 2 | 0 | 5 | 3 | **10** | H | **B** |
| B10 | Typo tolerance | 3 | 1 | 3 | 3 | **10** | H | **C** |
| B19 | Sockpuppet/alt signals | 2 | 4 | 2 | 2 | **10** | H→M | **C** |
| B20 | Near-dup spam (SimHash) | 3 | 3 | 2 | 2 | **10** | H | **C** |
| B7 | Marketplace recommendations | 4 | 1 | 2 | 2 | **9** | H→M | **C** |
| B11 | Trending search queries | 2 | 1 | 3 | 3 | **9** | H | **C** |
| B24 | Pool autotuning | 1 | 0 | 5 | 2 | **8** | H | **C** |
| B26 | Churn signals | 3 | 0 | 2 | 2 | **7** | M | **C** |

### Phase A — quick wins (H, effort ≥ 4)
1. **B14** per-account login lockout — highest total; closes credential-stuffing with the already-dead `login_attempts` schema.
2. **B13** rapid-fire message throttle — anti-abuse + protects message fan-out under load.
3. **B1** deterministic feed scoring — prerequisite for tuning A1; removes non-reproducibility bug-class.
4. **B17** lexical toxicity — replaces the mock in A7 with real signal, same schema.
5. **B21** cache stampede protection — half-day, direct concurrency win.
6. **B25** honest analytics — removes fabricated metrics.

### Phase B — medium heuristic builds
**B8** trending → **B9** FULLTEXT search → **B16** adaptive limits → **B6** PYMK → **B5** reputation → **B18** report triage → **B4** EMA interests → **B12** inbox ranking → **B15** refresh hardening → **B22** anomaly detection → **B2** diversity → **B3** cold-start → **B23** load-shedding.
(Suggested sequencing: B8/B9 are user-visible wins; B16/B22/B23 form a capacity cluster that serves the concurrent-user objective — do them together.)

### Phase C — later: low-score, heavy, or ML/external (revisit after A+B)
**B10** typo tolerance · **B19** alt detection · **B20** SimHash spam · **B7** marketplace CF · **B11** trending queries · **B24** pool autotuning · **B26** churn (`M`).

### Known bugs riding along (already tracked in `FIXES_NEEDED.md`)
- **A9** `chatStore.ts:561` — undeclared `existing` → `ReferenceError` on socket echo.
- **A10** `useMessageSocket.ts:140` — missing `SparkleStorage` import → `ReferenceError`.
Both are runtime crashes (H7's frozen TS2304 bucket) and must be fixed regardless of roadmap priority.
*(Both fixed 2026-10-05 as H15/H16 — see `FIXES_NEEDED.md`; Part A entries A9/A10 describe the original defects.)*

### Conventions for future entries
- Every Part A/B claim in this file was verified against source on 2026-10-05; update `file:line` references when touching those files.
- New candidates: add to Part B with mechanics + plug-in point + tier, score them in Part C, assign a phase.
