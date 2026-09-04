import api from '../api/api';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number | null;
  speed?: number | null;
}

export interface LiveLocationSession {
  live_location_id: string;
  message_id: string;
  chat_id: string;
  user_id: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  started_at: string;
  expires_at: string | null;
  duration: '15m' | '1h' | '8h' | 'off';
  is_active: boolean;
  comment?: string;
}

class LiveLocationService {
  private activeWatcherId: number | null = null;
  private currentSessionId: string | null = null;
  private lastPosition: { lat: number; lng: number; time: number } | null = null;

  // Calculate distance between two coordinates in meters (Haversine formula)
  private getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  // Start live location session
  public async startSession(
    chatId: string,
    coords: LocationCoords,
    duration: '15m' | '1h' | '8h' | 'off',
    comment?: string
  ): Promise<LiveLocationSession> {
    const response = await api.post('/location/live/start', {
      chatId,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      duration,
      comment: comment || ''
    });

    if (!response.data.success) {
      throw new Error(response.data.message || 'Failed to start live location');
    }

    const session: LiveLocationSession = response.data.data;
    this.currentSessionId = session.live_location_id;
    this.startBackgroundWatching(session.live_location_id);
    return session;
  }

  // Start continuous position tracking
  public startBackgroundWatching(liveLocationId: string) {
    this.stopBackgroundWatching();
    this.currentSessionId = liveLocationId;

    if ('geolocation' in navigator) {
      this.activeWatcherId = navigator.geolocation.watchPosition(
        (position) => {
          this.handlePositionUpdate(position);
        },
        (error) => {
          console.warn('Live location watch position error:', error.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 5000
        }
      );
    }
  }

  // Handle watch position fix with smart throttling
  private async handlePositionUpdate(position: GeolocationPosition) {
    if (!this.currentSessionId) return;

    const { latitude, longitude, accuracy, heading, speed } = position.coords;
    const now = Date.now();

    // Throttle check: update if moved >= 10 meters OR if >= 10 seconds have elapsed
    if (this.lastPosition) {
      const distance = this.getDistanceMeters(
        this.lastPosition.lat,
        this.lastPosition.lng,
        latitude,
        longitude
      );
      const timeElapsed = now - this.lastPosition.time;

      if (distance < 10 && timeElapsed < 10000) {
        return; // Skip negligible update
      }
    }

    this.lastPosition = { lat: latitude, lng: longitude, time: now };

    try {
      await api.post('/location/live/update', {
        live_location_id: this.currentSessionId,
        latitude,
        longitude,
        accuracy: accuracy || 0,
        heading: heading || 0,
        speed: speed || 0
      });
    } catch (err) {
      console.error('Failed to transmit live location update:', err);
    }
  }

  // Stop active live location session
  public async stopSession(liveLocationId: string): Promise<boolean> {
    this.stopBackgroundWatching();
    try {
      const response = await api.post(`/location/live/stop/${liveLocationId}`);
      if (this.currentSessionId === liveLocationId) {
        this.currentSessionId = null;
      }
      return response.data.success;
    } catch (err) {
      console.error('Failed to stop live location session:', err);
      return false;
    }
  }

  // Stop watching without API call
  public stopBackgroundWatching() {
    if (this.activeWatcherId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.activeWatcherId);
      this.activeWatcherId = null;
    }
  }
}

export const liveLocationService = new LiveLocationService();
