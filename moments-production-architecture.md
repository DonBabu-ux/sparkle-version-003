# MOMENTS DISCOVERY SYSTEM — PRODUCTION ARCHITECTURE (1M+ SCALE)

---

# 1. SYSTEM OVERVIEW

Moments is a **real-time, hybrid recommendation system** combining:

* Shared candidate retrieval (global content intelligence)
* Per-user personalization (session-based ranking)
* Event-driven learning (engagement feedback loop)
* Redis-accelerated caching layer
* Streaming ingestion pipeline (Kafka)

---

## Core Principle

> “Shared intelligence + personalized ranking + cached delivery at scale”

NOT:

* per-user database queries
* per-request full recomputation
* static feed snapshots

---

# 2. HIGH-LEVEL ARCHITECTURE

```
               ┌────────────────────────────┐
               │   Client (Mobile/Web)      │
               └─────────────┬──────────────┘
                             │
                             ▼
               ┌────────────────────────────┐
               │   API Gateway (Rate Limit) │
               └─────────────┬──────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌──────────────┐   ┌────────────────┐   ┌────────────────┐
│ Feed Service │   │ Session Engine │   │ Auth Service   │
└──────┬───────┘   └──────┬─────────┘   └────────────────┘
       │                  │
       ▼                  ▼
┌────────────────────────────────────────────┐
│         Ranking Orchestration Layer        │
└──────────────┬─────────────────────────────┘
               │
   ┌───────────┼──────────────┐
   ▼           ▼              ▼
Redis Pools   Feature Store   Kafka Stream
(Cache Layer) (ML Features)   (Events)
   │
   ▼
Candidate Retrieval Engine
   │
   ▼
Personalized Re-ranker
   │
   ▼
Feed Response Builder
```

---

# 3. CORE DESIGN COMPONENTS

---

# 3.1 REDIS-BASED CONTENT POOL SYSTEM (SHARDED)

## Structure

Instead of single pools:

```
pool:tech:shard_01
pool:tech:shard_02
pool:tech:shard_03
...
pool:trending:shard_01
```

---

## Why sharding matters

Prevents:

* hot-key overload
* cache stampedes
* viral spike collapse

---

## Refresh strategy

* TTL-based + event-triggered updates
* asynchronous rebuild workers

---

# 3.2 CANDIDATE GENERATION LAYER (SHARED)

Runs every 2–5 seconds:

Sources:

* trending pool
* interest embeddings
* follow graph expansion
* high-engagement creators

Output:

> Candidate Set (shared across users per shard group)

---

# 3.3 REQUEST COALESCING ENGINE

## RULE:

Multiple requests → single batch fetch

Example:

100 users request “tech feed”

→ system executes:

* 1 Redis fetch
* 1 ranked candidate pool generation

NOT 100 database queries

---

# 3.4 PERSONALIZATION ENGINE (PER USER LIGHTWEIGHT LAYER)

Each user applies:

### Session Interest Vector (SIV)

* watch time
* skips
* likes
* saves
* shares

### Final ranking formula:

```
FinalScore =
BaseScore (from pool)
× InterestMatch
× AffinityBoost
× FollowSignalBoost
+ ExplorationNoise
```

---

# 3.5 FOLLOWER SOCIAL BOOST SYSTEM

If:

* 1 followed user engages → boost
* 3–5 followed users engage → strong boost
* 5+ → forced injection into feed

Stored in:

```
Redis: social:boost:events
```

---

# 3.6 EVENT STREAMING PIPELINE (KAFKA)

Events:

* view
* like
* comment
* share
* save
* skip

Pipeline:

```
Client → Kafka → Stream Processor → Feature Store → Redis Update
```

Used for:

* real-time trending updates
* engagement scoring
* SIV updates

---

# 3.7 FEED DELIVERY LAYER (LOW LATENCY CORE)

Target:

> < 150ms response time (cache hit path)

Flow:

1. Fetch pooled candidates (Redis shard)
2. Apply per-user ranking overlay
3. Deduplicate (session cache)
4. Apply refresh delta logic
5. Return feed

---

# 4. STRICT FEED RULES (PRODUCTION GUARANTEES)

---

## 4.1 NO DUPLICATION (SESSION GUARANTEE)

Maintain:

```
seen_video_set:user:{id}
```

Rules:

* never repeat video in session
* reappearance only after pool exhaustion

---

## 4.2 CROSS-DEVICE DIVERSITY

Prevent identical feeds by:

* per-session entropy injection
* ranking noise factor ε

```
FinalRank = Score + ε(random_seed)
```

---

## 4.3 INFINITE SCROLL ENGINE

Guarantee:

* always prefetch next batch
* never return empty feed
* auto-expand candidate radius if needed

---

## 4.4 POOL EXHAUSTION HANDLING

If pool < threshold:

Trigger:

* expand embedding similarity range
* merge adjacent categories
* increase trending weight
* regenerate shard snapshot asynchronously

---

# 5. CACHE STRATEGY (CRITICAL FOR 1M+ SCALE)

---

## 5.1 CACHE TIERS

### L1: In-memory API cache

* ultra-fast short-lived results (1–3 sec)

### L2: Redis shard cache

* candidate pools
* ranked snapshots

### L3: Persistent store

* long-term content + features

---

## 5.2 CACHE INVALIDATION MODEL

NOT TTL-only

Instead:

* event-driven invalidation
* engagement threshold triggers refresh

Example:

* viral spike → immediate refresh
* low activity → slow refresh

---

# 6. TRAFFIC SPIKE HANDLING (CAMPUS / VIRAL EVENTS)

Scenario:

> 100K users open Moments at once

System behavior:

### Step 1:

Request coalescing activates

### Step 2:

Shared pool snapshot used

### Step 3:

Ranking applied per user (lightweight)

### Step 4:

Trending pool auto-amplifies viral content

### Step 5:

Redis hot shards replicated

Result:

* no DB overload
* no recomputation storm
* stable latency

---

# 7. PERFORMANCE GUARANTEES

| Metric                 | Target          |
| ---------------------- | --------------- |
| Feed latency           | <150ms          |
| Cache hit rate         | >90%            |
| DB calls per request   | ~0 (ideal path) |
| Duplicate rate         | 0 per session   |
| Feed refresh stability | consistent      |

---

# 8. SEED DATA REQUIREMENT

System initialization:

* MUST seed ≥ 200 videos minimum
* distributed across all categories
* ensures:

  * no cold-start collapse
  * stable initial ranking diversity

---

# 9. FINAL SYSTEM BEHAVIOR

Moments behaves as:

> A distributed, Redis-accelerated, event-driven recommendation system where shared content pools are dynamically ranked, personally re-scored per session, and continuously refreshed through real-time engagement streams.
