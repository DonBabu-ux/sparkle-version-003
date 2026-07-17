type UploadEvent = 
  | 'UPLOAD_STARTED' 
  | 'UPLOAD_PROGRESS' 
  | 'UPLOAD_COMPLETED' 
  | 'UPLOAD_FAILED' 
  | 'UPLOAD_CANCELLED';

type Listener = (data: any) => void;

class EventBus {
  private listeners = new Map<UploadEvent, Set<Listener>>();

  public on(event: UploadEvent, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unbind/unsubscribe callback
    return () => {
      const eventSet = this.listeners.get(event);
      if (eventSet) {
        eventSet.delete(listener);
      }
    };
  }

  public emit(event: UploadEvent, data?: any): void {
    const eventSet = this.listeners.get(event);
    if (eventSet) {
      eventSet.forEach((listener) => {
        try {
          listener(data);
        } catch (error) {
          console.error(`[UploadEventBus] Listener error for ${event}:`, error);
        }
      });
    }
  }
}

export const UploadEventBus = new EventBus();
