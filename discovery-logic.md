# Sparkle Discovery Engine: Comparative Analysis

This document provides a technical breakdown of the two primary discovery engines powering the Sparkle platform: the **Home Feed Algorithm (v7.7)** and the **Moments Discovery Algorithm (Production Sync)**.

---

## 1. Home Feed Algorithm (v7.7)
The Home Feed is the flagship discovery engine designed for long-form consumption, campus updates, and social networking.

### Core Logic:
- **Interest Modeling**: Fetches the user's `major` and `interests` from their profile and recent category clicks to build a real-time interest vector.
- **Dual-Layer Retrieval**: Combines a "Following" slice (chronological) with a "Discovery" slice (weighted ranking).
- **The Scoring Formula**: 
  `Engagement Score = ((Sparks * 5 + Comments * 10 + Shares * 15 + 1) / (Views + 10))`
- **Weighted Multipliers**:
    - **Follow Affinity**: 1.5x boost for creators already in the user's follow list.
    - **Campus Proximity**: 1.2x boost for posts originating from the same campus.
    - **Self-Post Penalty**: 0.05x multiplier for own posts to ensure the user sees external content.
- **Time Decay (Gravity)**: `1 / POW(Age_in_Hours + 2, 0.8)`. This "Gravity" factor ensures that older content falls off the feed exponentially rather than linearly.
- **Diversity Layer**: A post-retrieval loop that ensures no more than two posts from the same creator appear consecutively.

---

## 2. Moments Discovery Algorithm (Production Sync)
The Moments feed is an immersive, high-velocity discovery engine modeled after TikTok's "For You" page, designed for short-form video discovery.

### Core Logic:
- **Engagement-First Ranking**: Optimized for rapid scrolls. It uses the same **Normalized Engagement Ratio** as the Home Feed to identify viral potential early.
- **Search Intent Integration**: Unlike the Home Feed, the Moments algorithm is heavily wired to **Categorized Tabs** (Top, Videos, Users, Sounds, etc.). It filters the candidate pool based on intent while maintaining high-quality ranking.
- **Personalized Category Boost**: 
  `Interest Boost = (CASE WHEN m.category LIKE '%interest%' THEN 1.3 ELSE 1.0 END)`
- **Hierarchical Fallback**: If a specific query yields no results, it automatically transitions into a **Trending Content Pipeline**, ensuring the user never sees an empty screen.
- **Real-Time Analytics**: Integrated `trackView` signals increment `view_count` on every playback, allowing the algorithm to adjust content relevance in seconds.

---

## 3. Key Similarities (The Shared DNA)

Both algorithms share a common "Production-Grade" architecture to ensure consistency across the platform:

1.  **Normalized Scoring**: Both use the `Engagement / (Views + 10)` ratio. This is a industry standard to prevent "Viral Loop Bias" (where big posts just keep getting bigger) and allows new, high-quality content to surface quickly.
2.  **Power Decay (Gravity 0.8)**: Both use a non-linear time decay. This means content is "Hot" for the first 12-18 hours, "Warm" for 48 hours, and then rapidly makes way for fresh signals.
3.  **Campus-First Localization**: Both engines prioritize content from the user's own campus (**1.2x boost**), reinforcing Sparkle's identity as a campus-centric social graph.
4.  **Affinity Preservation**: Both ensure that creators you follow are never buried by the discovery algorithm (**1.5x boost**).

---

## 4. Key Differences

| Feature | Home Feed (7.7) | Moments Feed (Sync) |
| :--- | :--- | :--- |
| **Primary Goal** | Social Connection & Campus News | Immersive Discovery & Entertainment |
| **Media Priority** | Mixed (Text, Image, Carousel) | Video-First (9:16 aspect ratio) |
| **Search Interaction** | Minimal (Standard Search) | Deep (Categorized Tabs & Intent Parsing) |
| **Diversity Filter** | Strict (Creator spacing) | Relaxed (Viral-loop priority) |
| **Fallback System** | None (Empty state allowed) | Robust (Auto-trending fallback) |

---

## Summary
By synchronizing the Moments engine with the Home Feed algorithm, Sparkle now provides a unified discovery experience. Whether a user is reading a post or watching a short video, the same intelligent "Interest + Affinity + Quality" logic ensures they are seeing the best content Sparkle has to offer.
