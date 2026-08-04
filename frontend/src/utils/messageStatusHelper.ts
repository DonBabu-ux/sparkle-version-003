/**
 * messageStatusHelper.ts
 *
 * Pure helper that derives a message's display status exclusively from
 * server-authoritative timestamp fields. Using timestamps instead of an
 * arbitrary status string prevents impossible state combinations such as
 * status='delivered' with read_at set.
 *
 * Architecture Pillar #1: Timestamp-Derived Message States
 */

export type DerivedMessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface MessageTimestamps {
  /** Set by the server when message is persisted. Null while locally queued. */
  sent_at?: string | null;
  /** Set when at least one recipient session ACKs delivery. */
  delivered_at?: string | null;
  /** Set when recipient satisfies tri-condition read (foreground + focused + visible). */
  read_at?: string | null;
  /** Set if all delivery attempts permanently fail. */
  failed_at?: string | null;
}

/**
 * Returns the derived display status for a message.
 *
 * Priority order (highest first):
 *   failed > read > delivered > sent > pending
 */
export function getDerivedMessageStatus(msg: MessageTimestamps): DerivedMessageStatus {
  if (msg.failed_at) return 'failed';
  if (msg.read_at) return 'read';
  if (msg.delivered_at) return 'delivered';
  if (msg.sent_at) return 'sent';
  return 'pending';
}

/**
 * Returns a human-readable tick label for the status.
 * Used for accessibility aria-labels on tick icons.
 */
export function getStatusLabel(status: DerivedMessageStatus): string {
  switch (status) {
    case 'pending':   return 'Sending…';
    case 'sent':      return 'Sent';
    case 'delivered': return 'Delivered';
    case 'read':      return 'Read';
    case 'failed':    return 'Failed to send';
  }
}

/**
 * Returns the latest ISO timestamp present on the message (useful for sorting).
 */
export function getLatestTimestamp(msg: MessageTimestamps): string | null {
  return msg.read_at ?? msg.delivered_at ?? msg.sent_at ?? null;
}
