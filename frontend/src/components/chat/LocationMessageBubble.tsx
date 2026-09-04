import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapPin, Navigation, Clock, ExternalLink, Square } from 'lucide-react';
import { useUserStore } from '../../store/userStore';
import { liveLocationService } from '../../services/liveLocationService';

interface LocationMessageBubbleProps {
  message: {
    message_id: string;
    sender_id: string;
    content: string;
    type?: string;
    created_at?: string;
    sender_name?: string;
    sender_avatar?: string;
  };
  isCurrentUser: boolean;
  onOpenFullMap?: (initialCoords?: { lat: number; lng: number }) => void;
}

export const LocationMessageBubble: React.FC<LocationMessageBubbleProps> = ({
  message,
  isCurrentUser,
  onOpenFullMap
}) => {
  const currentUser = useUserStore((state) => state.user);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Parse payload content
  let parsedContent: any = {};
  try {
    if (message.content && (message.content.startsWith('{') || message.content.startsWith('['))) {
      parsedContent = JSON.parse(message.content);
    }
  } catch (e) {
    parsedContent = {};
  }

  const isLive = message.type === 'live_location' || parsedContent.type === 'live_location';
  
  // Coords extraction helper
  const parseCoord = (val: any, fallback: number): number => {
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (typeof val === 'string' && val.trim() !== '') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) return parsed;
    }
    return fallback;
  };

  const lat = parseCoord(parsedContent.latitude ?? parsedContent.lat ?? parsedContent.location?.lat ?? parsedContent.coords?.lat, -1.2921);
  const lng = parseCoord(parsedContent.longitude ?? parsedContent.lng ?? parsedContent.lon ?? parsedContent.location?.lng ?? parsedContent.coords?.lng, 36.8219);
  const accuracy = Math.round(parseCoord(parsedContent.accuracy, 18));
  const placeName = parsedContent.name || parsedContent.address || (isLive ? 'Live Location' : message.content || 'Current Location');
  const liveLocationId = parsedContent.live_location_id || message.message_id;

  // Live location reactive states
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({ lat, lng });
  const [isActive, setIsActive] = useState<boolean>(parsedContent.is_active !== false);
  const [remainingText, setRemainingText] = useState<string>('');
  const [isStopping, setIsStopping] = useState<boolean>(false);

  // Countdown timer calculation for live location
  useEffect(() => {
    if (!isLive || !isActive) return;

    const expiresAtStr = parsedContent.expires_at;
    if (!expiresAtStr) {
      setRemainingText('Live • Until turned off');
      return;
    }

    const updateCountdown = () => {
      const expiresAt = new Date(expiresAtStr).getTime();
      const now = Date.now();
      const diffMs = expiresAt - now;

      if (diffMs <= 0) {
        setIsActive(false);
        setRemainingText('Live location ended');
      } else {
        const mins = Math.ceil(diffMs / (60 * 1000));
        setRemainingText(`Live • ${mins} min remaining`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 10000);
    return () => clearInterval(interval);
  }, [isLive, isActive, parsedContent.expires_at]);

  // Real-time custom event listeners for live updates
  useEffect(() => {
    if (!isLive) return;

    const handleUpdate = (e: any) => {
      const detail = e.detail;
      if (detail && detail.live_location_id === liveLocationId) {
        if (detail.latitude && detail.longitude) {
          const newLat = parseFloat(detail.latitude);
          const newLng = parseFloat(detail.longitude);
          if (!isNaN(newLat) && !isNaN(newLng)) {
            setCoords({ lat: newLat, lng: newLng });
            
            if (mapInstanceRef.current && markerRef.current) {
              markerRef.current.setLatLng([newLat, newLng]);
              mapInstanceRef.current.panTo([newLat, newLng], { animate: true });
            }
          }
        }
      }
    };

    const handleStopped = (e: any) => {
      const detail = e.detail;
      if (detail && detail.live_location_id === liveLocationId) {
        setIsActive(false);
        setRemainingText('Live location ended');
      }
    };

    window.addEventListener('sparkle_live_location_update', handleUpdate);
    window.addEventListener('sparkle_live_location_stopped', handleStopped);

    return () => {
      window.removeEventListener('sparkle_live_location_update', handleUpdate);
      window.removeEventListener('sparkle_live_location_stopped', handleStopped);
    };
  }, [isLive, liveLocationId]);

  // Initialize mini-map preview & handle container resizes
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const targetLat = !isNaN(coords.lat) ? coords.lat : -1.2921;
    const targetLng = !isNaN(coords.lng) ? coords.lng : 36.8219;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        touchZoom: false,
        scrollWheelZoom: false,
        doubleClickZoom: false
      }).setView([targetLat, targetLng], 15);

      // Primary tile layer: CartoDB Voyager
      const primaryTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      });

      // Fallback tile layer: OpenStreetMap Standard
      const fallbackTiles = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: 'abc'
      });

      primaryTiles.on('tileerror', () => {
        if (map.hasLayer(primaryTiles)) {
          map.removeLayer(primaryTiles);
          fallbackTiles.addTo(map);
        }
      });

      primaryTiles.addTo(map);
      mapInstanceRef.current = map;

      // Custom marker icon
      const avatarUrl = message.sender_avatar || currentUser?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
      const markerHtml = isLive
        ? `
          <div style="position: relative; width: 36px; height: 44px; display: flex; flex-direction: column; align-items: center;">
            <div style="width: 32px; height: 32px; border-radius: 50%; border: 2.5px solid #ff1493; overflow: hidden; background: #13131a; box-shadow: 0 0 10px rgba(255, 20, 147, 0.5);">
              <img src="${avatarUrl}" style="width: 100%; height: 100%; object-fit: cover;" />
            </div>
            <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid #ff1493;"></div>
          </div>
        `
        : `
          <div style="color: #ff1493; filter: drop-shadow(0 2px 6px rgba(255,20,147,0.5));">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#ff1493" stroke="#ffffff" stroke-width="1.5"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3" fill="#ffffff"/></svg>
          </div>
        `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: 'location-bubble-marker',
        iconSize: [36, 44],
        iconAnchor: [18, 44]
      });

      markerRef.current = L.marker([targetLat, targetLng], { icon: customIcon }).addTo(map);

      setTimeout(() => { map.invalidateSize(); }, 100);
      setTimeout(() => { map.invalidateSize(); }, 400);
    }

    const resizeObserver = new ResizeObserver(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    });

    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Stop sharing handler
  const handleStopSharing = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsStopping(true);
    try {
      await liveLocationService.stopSession(liveLocationId);
      setIsActive(false);
      setRemainingText('Live location ended');
    } catch (err) {
      console.error('Failed to stop live location session:', err);
    } finally {
      setIsStopping(false);
    }
  };

  const mapSearchUrl = `https://www.google.com/maps/search/?api=1&query=${coords.lat},${coords.lng}`;

  return (
    <div
      onClick={() => onOpenFullMap && onOpenFullMap(coords)}
      className="my-1 rounded-2xl overflow-hidden max-w-[280px] w-full border border-white/10 bg-[#13131a] shadow-lg cursor-pointer hover:border-[#ff1493]/50 transition-all select-none group"
    >
      {/* Map Preview Canvas */}
      <div className="relative h-[135px] w-full bg-[#0f0f14]">
        <div ref={mapContainerRef} className="w-full h-full z-0 pointer-events-none" />

        {/* Live / Static Overlay Badge */}
        <div className="absolute top-2.5 right-2.5 z-10">
          {isLive ? (
            <div
              className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-md backdrop-blur-md ${
                isActive
                  ? 'bg-[#ff1493] text-white animate-pulse'
                  : 'bg-white/20 text-white/70'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-white' : 'bg-white/40'}`} />
              <span>{isActive ? 'LIVE' : 'ENDED'}</span>
            </div>
          ) : (
            <div className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-white/80 border border-white/10 backdrop-blur-md">
              LOCATION
            </div>
          )}
        </div>
      </div>

      {/* Info Card Content */}
      <div className="p-3.5 space-y-2 bg-[#13131a]">
        {/* Title */}
        <div className="font-bold text-sm text-white truncate leading-snug group-hover:text-[#ff1493] transition-colors">
          {isLive
            ? `${message.sender_name || (isCurrentUser ? 'You' : 'User')} is sharing live location`
            : placeName}
        </div>

        {/* Optional Comment */}
        {parsedContent.comment && (
          <p className="text-xs italic text-white/80 bg-white/5 p-2 rounded-lg border border-white/5">
            "{parsedContent.comment}"
          </p>
        )}

        {/* Subtitle / Accuracy / Duration */}
        <div className="flex items-center gap-1.5 text-xs text-white/60 font-medium">
          {isLive ? (
            <>
              <Clock className="w-3.5 h-3.5 text-[#ff1493]" />
              <span className={isActive ? 'text-[#ff1493] font-semibold' : 'text-white/40'}>
                {remainingText || 'Live location'}
              </span>
            </>
          ) : (
            <>
              <Navigation className="w-3.5 h-3.5 text-emerald-400" />
              <span>Accurate to {accuracy} m</span>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div className="pt-1 flex items-center gap-2">
          {isLive && isCurrentUser && isActive && (
            <button
              onClick={handleStopSharing}
              disabled={isStopping}
              className="flex-1 py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 text-xs font-bold transition-all flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{isStopping ? 'Stopping...' : 'Stop sharing'}</span>
            </button>
          )}

          <a
            href={mapSearchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex-1 py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 text-center active:scale-95"
          >
            <span>Open in Maps</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-60" />
          </a>
        </div>
      </div>
    </div>
  );
};
