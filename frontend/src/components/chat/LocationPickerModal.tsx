import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  ArrowLeft,
  RotateCw,
  Search,
  Maximize2,
  Minimize2,
  Navigation,
  MapPin,
  Clock,
  Building,
  ShoppingBag,
  GraduationCap,
  Activity,
  Shield,
  Utensils,
  Bus,
  Trees,
  X,
  Loader2
} from 'lucide-react';
import api from '../../api/api';
import { useUserStore } from '../../store/userStore';
import { LiveLocationIntroModal } from './LiveLocationIntroModal';
import { LiveLocationConfigPanel, type LiveDuration } from './LiveLocationConfigPanel';
import { liveLocationService } from '../../services/liveLocationService';

export interface LocationPayload {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  name?: string;
}

interface NearbyPlace {
  id: string;
  name: string;
  category: string;
  icon: string;
  lat: number;
  lng: number;
  distanceMeters: number;
  formattedDistance: string;
  address?: string;
}

interface LocationPickerModalProps {
  isOpen: boolean;
  chatId: string;
  onClose: () => void;
  onSendCurrentLocation: (payload: LocationPayload) => void;
  onSendLiveLocation?: (sessionData: any) => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  chatId,
  onClose,
  onSendCurrentLocation,
  onSendLiveLocation
}) => {
  const currentUser = useUserStore((state) => state.user);

  // States
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string>('GPS acquiring...');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isSendingCurrent, setIsSendingCurrent] = useState<boolean>(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  
  // Map expand toggle state
  const [isMapExpanded, setIsMapExpanded] = useState<boolean>(false);

  // Nearby places state
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingNearby, setLoadingNearby] = useState<boolean>(false);

  // Live Location Mode states
  const [showIntroModal, setShowIntroModal] = useState<boolean>(false);
  const [isLiveConfigMode, setIsLiveConfigMode] = useState<boolean>(false);
  const [isStartingLive, setIsStartingLive] = useState<boolean>(false);

  // Map Refs
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const accuracyCircleRef = useRef<L.Circle | null>(null);

  // Get Category Icon
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'graduation-cap': return <GraduationCap className="w-4 h-4 text-[#ff1493]" />;
      case 'shopping-bag': return <ShoppingBag className="w-4 h-4 text-emerald-400" />;
      case 'activity': return <Activity className="w-4 h-4 text-rose-400" />;
      case 'shield': return <Shield className="w-4 h-4 text-amber-400" />;
      case 'utensils': return <Utensils className="w-4 h-4 text-orange-400" />;
      case 'bus': return <Bus className="w-4 h-4 text-cyan-400" />;
      case 'trees': return <Trees className="w-4 h-4 text-green-400" />;
      default: return <Building className="w-4 h-4 text-[#ff1493]" />;
    }
  };

  // Helper to create custom HTML Leaflet Marker with User Avatar
  const createUserAvatarMarkerIcon = (avatarUrl?: string) => {
    const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80';
    const photo = avatarUrl || currentUser?.avatar_url || defaultAvatar;

    const htmlContent = `
      <div style="position: relative; width: 44px; height: 54px; display: flex; flex-direction: column; align-items: center;">
        <div style="
          width: 40px; 
          height: 40px; 
          border-radius: 50%; 
          border: 3px solid #ff1493; 
          box-shadow: 0 4px 14px rgba(255, 20, 147, 0.6); 
          overflow: hidden; 
          background: #13131a;
        ">
          <img src="${photo}" style="width: 100%; height: 100%; object-fit: cover;" alt="Avatar" />
        </div>
        <div style="
          width: 0; 
          height: 0; 
          border-left: 6px solid transparent; 
          border-right: 6px solid transparent; 
          border-top: 8px solid #ff1493;
          margin-top: -2px;
        "></div>
        <div style="
          width: 8px; 
          height: 8px; 
          background: #ff1493; 
          border-radius: 50%; 
          box-shadow: 0 0 8px #ff1493;
          margin-top: 1px;
        "></div>
      </div>
    `;

    return L.divIcon({
      html: htmlContent,
      className: 'sparkle-custom-map-marker',
      iconSize: [44, 54],
      iconAnchor: [22, 54]
    });
  };

  // Fetch Nearby Places from backend
  const fetchNearbyPlaces = useCallback(async (lat: number, lng: number) => {
    setLoadingNearby(true);
    try {
      const response = await api.get('/location/nearby', { params: { lat, lng } });
      if (response.data.success && response.data.places) {
        setNearbyPlaces(response.data.places);
      }
    } catch (err) {
      console.warn('Failed to fetch nearby places:', err);
    } finally {
      setLoadingNearby(false);
    }
  }, []);

  // Update map marker & view dynamically without destroying map
  const updateMapPosition = useCallback((lat: number, lng: number, accuracy: number, centerMap = true) => {
    if (!mapInstanceRef.current) return;

    const map = mapInstanceRef.current;
    const latLng: [number, number] = [lat, lng];

    if (centerMap) {
      map.setView(latLng, 16, { animate: true });
    }

    // Update or create User Marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng(latLng);
    } else {
      const icon = createUserAvatarMarkerIcon();
      userMarkerRef.current = L.marker(latLng, { icon }).addTo(map);
    }

    // Update or create Accuracy Circle
    if (accuracyCircleRef.current) {
      accuracyCircleRef.current.setLatLng(latLng);
      accuracyCircleRef.current.setRadius(accuracy);
    } else {
      accuracyCircleRef.current = L.circle(latLng, {
        radius: accuracy,
        color: '#ff1493',
        fillColor: '#ff1493',
        fillOpacity: 0.12,
        weight: 1.5
      }).addTo(map);
    }
  }, [currentUser]);

  // Request actual GPS location
  const refreshLocation = useCallback((centerOnFix = true) => {
    setIsRefreshing(true);
    setGpsStatus('GPS acquiring...');

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          const coords = { lat: latitude, lng: longitude, accuracy: Math.round(accuracy) };
          setCurrentCoords(coords);
          
          // Truthful accuracy status display
          const displayAcc = Math.round(accuracy);
          setGpsStatus(`Accurate to ${displayAcc} m`);

          updateMapPosition(latitude, longitude, displayAcc, centerOnFix);
          fetchNearbyPlaces(latitude, longitude);
          setIsRefreshing(false);
        },
        (error) => {
          console.warn('GPS location error:', error.message);
          setGpsStatus('Location unavailable');
          setIsRefreshing(false);
          // Fallback coords (Nairobi)
          const fallbackLat = -1.2921;
          const fallbackLng = 36.8219;
          setCurrentCoords({ lat: fallbackLat, lng: fallbackLng, accuracy: 100 });
          updateMapPosition(fallbackLat, fallbackLng, 100, centerOnFix);
          fetchNearbyPlaces(fallbackLat, fallbackLng);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    } else {
      setGpsStatus('Geolocation not supported');
      setIsRefreshing(false);
    }
  }, [updateMapPosition, fetchNearbyPlaces]);

  // Initialize Map instance on mount when modal opens
  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Default initial view (Nairobi or center)
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([-1.2921, 36.8219], 15);

      // Primary tile layer (CartoDB Voyager)
      const primaryTiles = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd'
      });

      // Fallback tile layer (OpenStreetMap Standard)
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

      setTimeout(() => { map.invalidateSize(); }, 100);
      setTimeout(() => { map.invalidateSize(); }, 350);
    }

    refreshLocation(true);

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
      if (!isOpen && mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        userMarkerRef.current = null;
        accuracyCircleRef.current = null;
      }
    };
  }, [isOpen]);

  // Invalidate map size when expanded state or live config changes
  useEffect(() => {
    if (mapInstanceRef.current) {
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 150);
      setTimeout(() => {
        mapInstanceRef.current?.invalidateSize();
      }, 400);
    }
  }, [isMapExpanded, isLiveConfigMode]);

  // CRITICAL FLOW: Immediate Local-First Send Current Location
  const handleSendCurrentLocation = () => {
    const finalLat = currentCoords?.lat || -1.2921;
    const finalLng = currentCoords?.lng || 36.8219;
    const finalAcc = currentCoords?.accuracy || 18;

    // 1. SYNCHRONOUS LOCAL UI RESPONSE FIRST (Instant close & bubble render)
    onSendCurrentLocation({
      latitude: finalLat,
      longitude: finalLng,
      accuracy: finalAcc,
      address: 'Current Location',
      name: 'Current Location'
    });

    onClose();

    // 2. Resolve reverse geocoded address asynchronously in background
    api.post('/location/resolve', { lat: finalLat, lon: finalLng }).then((res) => {
      if (res.data?.success && res.data?.location?.name) {
        console.log('[LocationPickerModal] Resolved place name in background:', res.data.location.name);
      }
    }).catch(() => {});
  };

  // Handle Nearby Place Select
  const handleSelectNearbyPlace = (place: NearbyPlace) => {
    onSendCurrentLocation({
      latitude: place.lat,
      longitude: place.lng,
      accuracy: 10,
      name: place.name,
      address: place.address || place.name
    });
    onClose();
  };

  // Handle Start Live Location Config
  const handleContinueLiveIntro = () => {
    setShowIntroModal(false);
    setIsLiveConfigMode(true);
    setIsMapExpanded(true);
  };

  // Handle Live Location Send
  const handleSendLiveLocation = async (duration: LiveDuration, comment: string) => {
    if (!currentCoords) return;
    setIsStartingLive(true);
    try {
      const session = await liveLocationService.startSession(
        chatId,
        {
          latitude: currentCoords.lat,
          longitude: currentCoords.lng,
          accuracy: currentCoords.accuracy
        },
        duration,
        comment
      );

      if (onSendLiveLocation) {
        onSendLiveLocation(session);
      }
      onClose();
    } catch (err) {
      console.error('Failed to start live location session:', err);
    } finally {
      setIsStartingLive(false);
    }
  };

  // Search Filtered Places
  const filteredPlaces = nearbyPlaces.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.address && p.address.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-[#13131a] flex flex-col overflow-hidden animate-fade-in text-white">
      {/* ========================================================
          1. TOP BAR
          ======================================================== */}
      <div className="relative z-20 flex items-center gap-3 px-4 py-3 bg-[#13131a]/95 border-b border-white/10 backdrop-blur-md shrink-0">
        {/* Back Button */}
        <button
          onClick={onClose}
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 transition-all"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        {/* Search Input */}
        <div className="relative flex-1">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search location"
            className="w-full bg-white/5 border border-white/10 focus:border-[#ff1493] rounded-2xl py-2 pl-9 pr-8 text-sm text-white placeholder-white/40 focus:outline-none transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Refresh Button */}
        <button
          onClick={() => refreshLocation(true)}
          disabled={isRefreshing}
          className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 active:scale-95 disabled:opacity-50 transition-all"
          title="Refresh location & recenter"
        >
          <RotateCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin text-[#ff1493]' : ''}`} />
        </button>
      </div>

      {/* ========================================================
          2. MAP AREA
          ======================================================== */}
      <div
        className={`relative w-full transition-all duration-300 ${
          isLiveConfigMode || isMapExpanded ? 'flex-1' : 'h-[45vh] min-h-[280px]'
        }`}
      >
        {/* Leaflet Map Canvas */}
        <div ref={mapContainerRef} className="w-full h-full z-0 bg-[#0f0f14]" />

        {/* Map Control Top-Left: Expand / Fullscreen Toggle */}
        <button
          onClick={() => setIsMapExpanded(!isMapExpanded)}
          className="absolute top-4 left-4 z-10 p-2.5 rounded-2xl bg-[#13131a]/80 border border-white/15 text-white backdrop-blur-md shadow-lg hover:bg-[#13131a] active:scale-95 transition-all"
          title="Expand / collapse map"
        >
          {isMapExpanded ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
        </button>

        {/* Map Control Top-Right: Accuracy & Status Control */}
        <div className="absolute top-4 right-4 z-10 flex items-center gap-2 px-3 py-2 rounded-2xl bg-[#13131a]/85 border border-white/15 text-xs font-bold text-white/90 backdrop-blur-md shadow-lg">
          <Navigation className="w-3.5 h-3.5 text-[#ff1493] animate-pulse" />
          <span>{gpsStatus}</span>
        </div>
      </div>

      {/* ========================================================
          3. BOTTOM LOCATION PANEL / LIVE CONFIG PANEL
          ======================================================== */}
      {isLiveConfigMode ? (
        <LiveLocationConfigPanel
          onSend={handleSendLiveLocation}
          onCancel={() => {
            setIsLiveConfigMode(false);
            setIsMapExpanded(false);
          }}
          isSending={isStartingLive}
        />
      ) : (
        <div
          className={`flex-1 flex flex-col bg-[#13131a] border-t border-white/10 rounded-t-3xl overflow-hidden transition-all duration-300 ${
            isMapExpanded ? 'hidden' : 'flex'
          }`}
        >
          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* OPTION 1: SHARE LIVE LOCATION */}
            <button
              onClick={() => setShowIntroModal(true)}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-gradient-to-r from-[#ff1493]/15 to-[#ff69b4]/5 border border-[#ff1493]/30 hover:border-[#ff1493] active:scale-[0.99] transition-all shadow-md shadow-[#ff1493]/10 text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="relative flex items-center justify-center w-11 h-11 rounded-2xl bg-[#ff1493]/20 border border-[#ff1493]/40 text-[#ff1493] group-hover:scale-105 transition-transform">
                  <MapPin className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <div className="font-bold text-base text-white flex items-center gap-2">
                    <span>Share live location</span>
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#ff1493]/20 text-[#ff1493] border border-[#ff1493]/30">
                      Real-time
                    </span>
                  </div>
                  <div className="text-xs text-white/60 mt-0.5">Share your real-time location in chat</div>
                </div>
              </div>
              <div className="text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all">
                ›
              </div>
            </button>

            {/* OPTION 2: SEND CURRENT LOCATION */}
            <button
              onClick={handleSendCurrentLocation}
              disabled={isSendingCurrent}
              className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 active:scale-[0.99] transition-all text-left group"
            >
              <div className="flex items-center gap-3.5">
                <div className="flex items-center justify-center w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 group-hover:scale-105 transition-transform">
                  {isSendingCurrent ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Navigation className="w-6 h-6" />
                  )}
                </div>
                <div>
                  <div className="font-bold text-base text-white">Send your current location</div>
                  <div className="text-xs text-white/60 mt-0.5">
                    {currentCoords ? `Accurate to ${currentCoords.accuracy} m` : gpsStatus}
                  </div>
                </div>
              </div>
            </button>

            {/* OPTION 3: NEARBY LOCATIONS HEADER */}
            <div className="pt-2 pb-1 flex items-center justify-between px-1">
              <span className="text-xs font-black uppercase tracking-wider text-white/50">
                Nearby locations
              </span>
              {loadingNearby && <Loader2 className="w-3.5 h-3.5 text-[#ff1493] animate-spin" />}
            </div>

            {/* NEARBY PLACES LIST (~30 LOCATIONS) */}
            <div className="space-y-1.5 pb-6">
              {filteredPlaces.length > 0 ? (
                filteredPlaces.map((place) => (
                  <button
                    key={place.id}
                    onClick={() => handleSelectNearbyPlace(place)}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 group-hover:border-[#ff1493]/40 transition-colors shrink-0">
                        {getCategoryIcon(place.icon)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-white truncate group-hover:text-[#ff1493] transition-colors">
                          {place.name}
                        </div>
                        <div className="text-xs text-white/50 truncate mt-0.5">
                          {place.address || place.category}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs font-bold text-white/40 shrink-0">
                      {place.formattedDistance}
                    </div>
                  </button>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-white/40">
                  {loadingNearby ? 'Loading nearby places...' : 'No nearby places found'}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Live Location Intro Modal */}
      <LiveLocationIntroModal
        isOpen={showIntroModal}
        onClose={() => setShowIntroModal(false)}
        onContinue={handleContinueLiveIntro}
      />
    </div>
  );
};
