import api from '../api/api';

export interface TrackingSignal {
  postId: string;
  userId?: string;
  action: 'impression' | 'dwell' | 'exit' | 'like' | 'share' | 'comment' | 'click' | 'skip';
  watchTime?: number; // Total watch time in seconds
  duration?: number;  // Total media duration in seconds
  timestamp?: number;
  metadata?: any;
}

class TrackingService {
  private activeSignals: Map<string, number> = new Map();

  /**
   * Track an impression when a post enters the viewport
   */
  trackImpression(postId: string) {
    if (this.activeSignals.has(postId)) return;
    this.activeSignals.set(postId, Date.now());
    
    this.sendSignal({
      postId,
      action: 'impression',
      timestamp: Date.now()
    });
  }

  /**
   * Track dwell time (periodic update or exit)
   */
  trackDwell(postId: string, watchTime: number, duration?: number) {
    this.sendSignal({
      postId,
      action: 'dwell',
      watchTime: Math.round(watchTime / 1000), // Convert to seconds
      duration: duration ? Math.round(duration / 1000) : undefined,
      timestamp: Date.now()
    });
  }

  /**
   * Track explicit exit when post leaves viewport
   */
  trackExit(postId: string, totalWatchTime: number, duration?: number) {
    const startTime = this.activeSignals.get(postId);
    this.activeSignals.delete(postId);

    // Skip detection: if watched < 20% of content and total time < 3s
    let action: 'exit' | 'skip' = 'exit';
    if (duration && (totalWatchTime / duration < 0.2) && totalWatchTime < 3000) {
      action = 'skip';
    }

    this.sendSignal({
      postId,
      action,
      watchTime: Math.round(totalWatchTime / 1000),
      duration: duration ? Math.round(duration / 1000) : undefined,
      timestamp: Date.now()
    });
  }

  /**
   * Track explicit engagement (like, share, etc)
   */
  trackEngagement(postId: string, action: 'like' | 'share' | 'comment') {
    this.sendSignal({
      postId,
      action,
      timestamp: Date.now()
    });
  }

  public async sendSignal(signal: TrackingSignal) {
    try {
      // Mapping internal signal actions to backend action_types
      const actionTypeMap: Record<string, string> = {
        'impression': 'view',
        'dwell': 'dwell',
        'exit': 'exit',
        'skip': 'skip',
        'like': 'like',
        'share': 'share',
        'comment': 'comment',
        'click': 'click'
      };

      await api.post(`/posts/${signal.postId}/action`, {
        action_type: actionTypeMap[signal.action] || signal.action,
        duration: signal.watchTime, // Backend uses duration column for watch time in user_actions
        total_duration: signal.duration,
        timestamp: signal.timestamp
      });
    } catch (err) {
      // Silently fail telemetry to avoid disrupting UX
    }
  }
}

export const trackingService = new TrackingService();
