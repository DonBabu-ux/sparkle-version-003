# DELETIONS.md

Dead-code removal log. Each entry: what, evidence of zero live references, and date.
Batches are named after the UI audit (`UI_AUDIT.md`) P1 wave they close.

---

## Batch A6 — dead-code sweep (P1 §3 "Dead-code sweep", UI_AUDIT line 137)

Verification method: `grep -rn '<name>' src --include='*.tsx' --include='*.ts' --include='*.css'`
excluding self-references, plus import-graph check. Deletion performed only when the
reference count was zero (or the only importer was itself deleted in this batch).

| Artifact | Evidence | Notes |
|---|---|---|
| `src/App.css` (184 lines) | 0 importers, 0 string refs anywhere in `src/` or `index.html` | Never imported; `.app`, `.dashboard-grid`, `.glass-input` era styles |
| `src/components/chat/MessageBubble.tsx` | Only self; `Messages.tsx` inlines its own bubble (`MessageBubbleWrapper`, a distinct component) | Also held the last native `prompt()` call in `src` |
| `src/components/chat/SwipeableMessage.tsx` | 0 refs | Audit: `setPointerCapture` stole vertical scroll; dead |
| `src/components/chat/GifMessage.tsx` | 0 refs | Audit: no aspect box (CLS); dead |
| `src/components/modals/MessageActionModal.tsx` (singular) | Only importer = `MessageBubble.tsx` (deleted in this batch) | Not to be confused with live `chat/MessageActionModals.tsx` (plural) |
| `src/components/video/RemotePlaceholder.tsx` + `.css` | 0 refs | `/placeholder-avatar.png` also 404s |
| `src/components/FloatingAIButton.tsx` | Only refs were the commented-out JSX in `App.tsx` (+ its commented import) — both removed | Audit: would cover content at bottom-center; `z-999` inconsistent |
| `src/components/AnalyticsDashboard.tsx` | 0 importers (audit: mockStats) | |
| `src/components/AnalyticsCard.tsx` | Only importer = `AnalyticsDashboard.tsx` (deleted) | Orphaned by the above |

### Also removed (props/CSS, not whole files)

- **Invalid `md:size={…}` props** (3): lucide icons don't accept responsive size props —
  `SearchHistory.tsx:93`, `Verified.tsx:80`, `Verified.tsx:308`. Base `size` kept.
- **Dead CSS in `index.css`**: `.dashboard-grid` section (base + two media queries,
  `DASHBOARD LAYOUT` header) and `.glass-input` — 0 usages in any `.tsx`.
- **Dead `exit` variants without a wrapping `AnimatePresence`**:
  `SkillDetailModal.tsx` (2 × `exit={{…}}`; rendered from `Navbar.tsx` — no AnimatePresence in chain)
  and `RewardCarousel.tsx` (`exit="exit"`; rendered from `LearnMorePage.tsx` — no AnimatePresence).
  Removal changes nothing behaviorally — these exits never played.
  (Onboarding `Slide*` files also have file-local exits but are **live**: wrapped by
  `Onboarding.tsx:116` `<AnimatePresence mode="wait">` — verified, not touched.)

### Audit discrepancies — claimed dead, actually LIVE (kept)

- **`PrivacySettingsModal`** — audit's "dead chat set" claim is wrong in current tree:
  imported and rendered in `ChatSettingsModal.tsx:25/:2005` behind `showPrivacyModal`.
- **`Leaderboard`** (`src/components/Leaderboard.tsx`) — audit said "0 importers";
  `Invite.tsx:7` imports and renders it (`:157`).

### Already done in earlier batch (`f445fac`)

- `ForwardMessage` + `forward/*` + `NewChatModal` (audit line 400 confirms).
- `hooks/useToast` dead import (lived in ForwardMessage).

### Skipped with reason

- **`.video-error-placeholder` missing CSS** (`GlobalEffects.tsx:29` sets the class): not a
  deletion — an absent style. Tracked as audit line 79 follow-up, not A6 scope.
- **`sidebar popup` clipping**: no `sidebar-popup` selector or component exists in `src`
  (grep 0 hits) — audit phrase doesn't map to current tree. No action.
- **`Analytics` route wiring / `Leaderboard` route check**: out of A6 scope (C-wave orphan routes).

---

## B5 — gamification entry points hidden (UI_AUDIT §3 P2-5)

Invite page no longer renders these; each had zero remaining importers after
`src/pages/Invite.tsx` was cleaned up (verified with
`grep -rn '<name>' src --include='*.tsx' --include='*.ts'`).

| Artifact | Reason |
|---|---|
| `src/components/Leaderboard.tsx` | hardcoded Alice/Bob/Carol, no `/referral/leaderboard` backend — hidden per §3 P2-5 |
| `src/components/FloatingRewardWidget.tsx` | renders `mockStats.rewardsEarned` (always undefined→0) from `mocks/referralData` — hidden per §3 P2-5 |
| `src/components/MilestoneTracker.tsx` | zero-input placeholder shell ("XP progress coming soon") — no real data behind it, hidden per §3 P2-5 |
| `src/components/RewardVault.tsx` | only input is `invitedCount`, always 0 because `/referral/stats` 404s — hidden per §3 P2-5 |

Kept (not deleted): `AchievementGrid.tsx` and `RewardCarousel.tsx` — now rendered
only when real data exists / made reachable (clipping fix), respectively.
`referralService.ts` + `useReferralData.ts` retained as the documented seam for a
future backend; the `/referral/*` endpoints still do not exist.
- `src/mocks/referralData.ts` — orphaned mock (last importer `FloatingRewardWidget` deleted in B5).
