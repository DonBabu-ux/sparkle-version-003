export type UploadErrorType = 
  | 'AUTH_ERROR'       // 401/403 -> don't retry, prompt re-login
  | 'NETWORK_ERROR'    // No connection -> auto-retry when online
  | 'SERVER_ERROR'     // 5xx -> retry with backoff
  | 'FILE_ERROR'       // 413, file missing -> don't retry, discard
  | 'RATE_LIMIT';      // 429 -> retry after Retry-After header

export class UploadError extends Error {
  type: UploadErrorType;
  retryable: boolean;
  retryAfterMs?: number;
  userMessage: string;

  constructor(type: UploadErrorType, userMessage: string, retryable: boolean, retryAfterMs?: number) {
    super(userMessage);
    this.name = 'UploadError';
    this.type = type;
    this.userMessage = userMessage;
    this.retryable = retryable;
    this.retryAfterMs = retryAfterMs;
    Object.setPrototypeOf(this, UploadError.prototype);
  }
}
