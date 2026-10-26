# Media Sharing — canonical-link design (WhatsApp-style)

**Problem:** today every share builds a new URL (`/post/:id`, `/moments/:id`, dashboard for stories) and sharing is tracked as a `share_count += 1` — an analytics event, not a relationship. Sending one moment to 5 people creates 5 detached links; nothing records who may see what; revoking is impossible; media access is public-by-guess.

**Goal (owner's spec):** *"We don't create another link for a new share. To send 5 people we pick the same link, register the origin and the recipients, and share it like that."*

## How WhatsApp actually does it

- The **media blob has one canonical URL**, forever. It never changes per recipient.
- Sending to 5 people = **one blob, five message rows** in each recipient's chat. The link is the capability; the per-chat rows are the ACL.
- Forwarding = a new message row (new origin) pointing at the **same blob** — the link is still one link.
- Delete-for-everyone = tombstone on the blob reference; recipients' links stop resolving.

## Sparkle's model — same shape, our tables

```
content (post | moment | story | listing)      ← media lives ONCE (Cloudinary URL is canonical)
   │  canonical link: /p/:content_id            ← ONE url per content, forever
   ▼
shares                                         ← "who sent it to whom" (the ACL)
   │
   ├── share_recipients                        ← the 5 people (or a conversation_id for groups)
   ▼
recipients see the SAME canonical link in their chat
```

```sql
CREATE TABLE shares (
  share_id      INT AUTO_INCREMENT PRIMARY KEY,
  content_type  ENUM('post','moment','story','listing') NOT NULL,
  content_id    INT NOT NULL,
  shared_by     INT NOT NULL,                  -- origin user
  caption       TEXT NULL,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at    TIMESTAMP NULL,                -- delete-for-everyone
  INDEX (content_type, content_id)
);

CREATE TABLE share_recipients (
  share_id      INT NOT NULL,
  user_id       INT NOT NULL,
  conversation_id INT NULL,                    -- group shares: one row per conversation instead
  delivered_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  seen_at       TIMESTAMP NULL,
  PRIMARY KEY (share_id, user_id)
);
```

Send to 5 people = **1 INSERT into `shares` + 5 INSERTs into `share_recipients`**. The URL every recipient receives is `/p/:content_id` — identical for all five, and identical if any of them forwards it.

## API

| Route | Purpose |
|---|---|
| `POST /shares` `{content_type, content_id, recipients[] \| conversation_ids[], caption}` | Create the share + recipient rows. Returns `{share_id, url: "/p/:content_id"}`. Re-share to the same person = new share row (forwarding), same URL. |
| `GET /p/:content_id` | **The one canonical route** for all content types. Authorization: owner OR recipient of a non-revoked share OR public content. This replaces per-type share URLs. |
| `DELETE /shares/:share_id` | `revoked_at = now`. Recipients' links stop resolving. Content survives for the owner. |
| `GET /shares/:share_id/recipients` | "Shared with" list for the sender's UI. |

Frontend: the existing `MomentShareModal` / `ProfileShareModal` "Send to" flow becomes `POST /shares` with picked contacts; the message each recipient receives renders `/p/:content_id`. Outbound (copy-link / WhatsApp / FB) keeps using `/p/:content_id` too — same string everywhere.

## Edge cases (decided, not deferred)

| Case | Behavior |
|---|---|
| Link leaked to a non-recipient | ACL denies. This is the whole point — today any `/post/:id` is world-readable by guessing. |
| Forwarding | New `shares` row (new `shared_by`), same `content_id`, same URL. "Forwarded" chain is queryable. |
| Original content deleted | `/p/:id` renders tombstone: "content no longer available". Shares keep their rows for audit. |
| Groups | Recipient = `conversation_id`; the chat renders the link once per conversation. |
| Revocation granularity | Revoke kills **that share row** (those recipients). Owner's own access never affected. |
| Share counts | `share_count = COUNT(DISTINCT share_id)` — real number, replaces the current `+= 1` per outbound click. |
| Private/anonymous content | Same ACL; confessions resolve only for recipients (owner anonymity preserved — no user lookup leaks). |

## Why this beats per-recipient links

- **Revoke once, not N times.** One ACL row per share, not N guessable URLs.
- **One cache key per blob.** CDN/browser cache works; a viral share is one object, not N copies.
- **Auditable.** "Who saw this and when" is a query, not a guess.
- **WhatsApp mental model.** Users already understand "same photo, five chats, forwarded tag".

## Migration note (existing data)

Backfill is optional: existing `share_count` columns stay as denormalized analytics. New `shares` rows only cover in-app sends. No downtime needed — `/p/:id` can coexist with `/post/:id` during rollout and redirect.
