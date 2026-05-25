# Refactor Messaging System – Detailed Implementation Plan

## Goal Description

Implement a modern, premium‑grade messaging experience matching WhatsApp/Telegram/Instagram/Messenger. This includes:
- New design system with tokens, dark/light mode, glass‑morphism aesthetics.
- Front‑end component suite for each media type.
- Virtualized chat list using **react‑window**.
- State management with **Zustand**.
- Backend schema updates, edit enforcement, reply linkage, media metadata.
- New multipart upload endpoint with Cloudinary integration and MIME validation.
- Strict server‑side permission checks using JWT `userId`.
- 5‑minute edit window enforced with 403 error payload.

## Proposed Changes

---
### Frontend

#### 1. Design System
- Add `/frontend/src/theme/designTokens.ts` defining colors, spacings, radii, typography, shadows, motion.
- Implement dark/light theme toggling via context.
- Export a `useTheme` hook.

#### 2. State Management (Zustand)
- Create `/frontend/src/store/chatStore.ts` with slices for messages, users, UI state (replyTarget, editTarget, uploadProgress).
- Replace existing Redux/Context usage.

#### 3. New Message Renderer Components
- `TextMessage.tsx`
- `ImageMessage.tsx`
- `VideoMessage.tsx`
- `GifMessage.tsx`
- `AudioMessage.tsx`
- `DocumentMessage.tsx`
- Each component receives a `message` prop with typed fields and handles loading skeletons, lazy loading, and edited badge.

#### 4. Reply Preview
- `ReplyPreview.tsx` – shows sender name, snippet, media icon/thumbnail, left border, clickable to scroll.
- Integrate into message composer UI.

#### 5. MessageRenderer
- Switch based on `media_type` and render the appropriate component.
- Include edited indicator badge.

#### 6. Virtualized Chat List
- Install `react-window`.
- Refactor `Messages.tsx` to wrap the message list with `VariableSizeList`.
- Provide `getItemSize` based on message content height (estimate via refs).

#### 7. Edit/Delete UI Logic
- In `MessageActionModals.tsx`, show edit button only when `message.userId === currentUser.id && withinEditWindow`.
- On edit attempt after window, handle 403 error and show toast.

#### 8. Media Upload Flow
- New hook `useMediaUpload.ts` handling multipart FormData, progress, MIME validation, optional client‑side compression (using `browser-image-compression`).
- Upload endpoint URL stored in env `VITE_UPLOAD_URL`.

#### 9. Voice Note Integration
- Use `RecordRTC` for press‑hold recording.
- Preview modal with waveform (wavesurfer.js).

#### 10. Styles & Animations
- Apply glass‑morphic bubbles, subtle hover scaling, smooth scroll for reply navigation (CSS `scroll-behavior: smooth`).
- Micro‑animations via `framer‑motion` for message entry, edit fade‑in.

---
### Backend (Node/Express)

1. **Database Schema** – Add columns to `messages` table:
   ```sql
   edited_at   DATETIME NULL,
   is_edited   BOOLEAN   DEFAULT FALSE,
   reply_to_message_id BIGINT NULL,
   media_type  ENUM('text','image','video','gif','audio','document') NOT NULL DEFAULT 'text',
   status      ENUM('sent','delivered','seen') NOT NULL DEFAULT 'sent'
   ```
   Add foreign key on `reply_to_message_id`.

2. **Edit Message Endpoint** (`PUT /api/messages/:id`)
   - Verify JWT `userId` matches message `user_id`.
   - Compute time diff: if `now - created_at > 5 * 60 * 1000` → respond 403 with error payload:
     ```json
     {"success":false,"code":"MESSAGE_EDIT_WINDOW_EXPIRED","message":"Message can no longer be edited."}
     ```
   - On success, update `content`, set `edited_at = NOW()`, `is_edited = true`.

3. **Reply Linkage** – Ensure `send-message` can include optional `replyToMessageId`; store in DB.

4. **Media Upload Endpoint** (`POST /api/upload`)
   - Accept `multipart/form-data` with fields `category` (story|chat|post|avatar|confession).
   - Validate MIME type against allowed list per category.
   - Optionally compress images/videos server‑side using `sharp`/`ffmpeg` if client did not compress.
   - Upload to Cloudinary (use `cloudinary` npm package) and return `{url, public_id, type}`.
   - Store metadata in a new `media` table linked to messages.

5. **Message Creation** – Extend `send-message` handling to accept `media_type` and `mediaUrl` from upload response.

6. **Read Receipts** – Update status field on receipt events via socket `message-seen`.

---
### Testing & Verification

- **Unit Tests** for each new React component (Jest + React Testing Library). Snapshot tests for visual consistency.
- **Integration Tests** for edit API (attempt edit after 5 min → 403). Use Supertest.
- **E2E Tests** (Cypress) covering:
  - Sending each media type.
  - Reply preview navigation (smooth scroll).
  - Edit workflow within/after window.
  - Virtualized list performance with 2000 messages.
- **Accessibility Audit** using axe.

---
## Timeline (approx.)
1. Backend schema & endpoints – 2 days
2. Design system & Zustand store – 1 day
3. Frontend component suite – 4 days
4. Virtualization & integration – 2 days
5. Media upload & Cloudinary integration – 2 days
6. Voice note flow – 2 days
7. Testing & bug‑fixes – 3 days
8. Polish UI, dark mode, micro‑animations – 1 day

---
## Next Steps
- Await your confirmation of this detailed plan.
- Once approved, we will begin implementation following the timeline above.
