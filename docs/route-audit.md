# Route Audit

This document maps every front‑end API call to its corresponding back‑end route. It will be used during the folder re‑organisation to verify import paths and ensure all endpoints remain functional.

## API Call Mapping

| Front‑end location | HTTP Method | API endpoint | Notes |
|--------------------|-------------|--------------|-------|
| frontend/src/services/MediaDownloadManager.ts:64 | GET | /api/media/download-token/${mediaId} | Retrieves download token |
| frontend/src/services/MediaDownloadManager.ts:118 | POST | /api/media/ack-download | Acknowledge download |
| frontend/src/services/MediaDownloadManager.ts:137 | POST | /api/media/request-redelivery | Request re‑delivery |
| frontend/src/store/messageStore.ts:48 | GET | /api/messages/${id}/allowed-actions | Allowed actions |
| frontend/src/store/messageStore.ts:61 | POST | /api/messages/${id}/pin | Pin message |
| frontend/src/store/messageStore.ts:76 | POST | /api/messages/${id}/react | Add reaction |
| frontend/src/store/messageStore.ts:91 | DELETE | /api/messages/${id}/react | Remove reaction |
| frontend/src/store/messageStore.ts:105 | PUT | /api/messages/${id}/edit | Edit message |
| frontend/src/store/messageStore.ts:119 | DELETE | /api/messages/${id}/delete-for-me | Delete for me |
| frontend/src/store/messageStore.ts:129 | DELETE | /api/messages/${id}/delete-for-all | Delete for all |
| frontend/src/store/messageStore.ts:138 | POST | /api/messages/${id}/forward | Forward message |
| frontend/src/pages/CreateStory.tsx:450 | GET | /api/music/search?${params.toString()} | Music search |
| frontend/src/pages/ai/SparkleAIScreen.tsx:29 | POST | /api/ai/chat | AI chat |

*Update this table by searching the `frontend/` codebase for `fetch(` or other HTTP client usages.*
