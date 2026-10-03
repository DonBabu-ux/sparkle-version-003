import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { getSocket } from '../../services/socketService';
import api from '../../api/api';

interface SecurityAlertData {
  event_id: string;
  event_type: string;
  actor_session_id?: string;
  time?: string;
  created_at?: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown> | string;
}

export const CrossDeviceSecurityAlertOverlay: React.FC = () => {
  const navigate = useNavigate();
  const [activeAlert, setActiveAlert] = useState<SecurityAlertData | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());

  // Check unacknowledged alerts on mount & resume
  const checkUnacknowledgedAlerts = async () => {
    try {
      const res = await api.get('/security/alerts/unacknowledged');
      if (res.data?.status === 'success' && res.data.data?.alerts?.length > 0) {
        const alert = res.data.data.alerts[0];
        if (!seenEventIds.current.has(alert.event_id)) {
          seenEventIds.current.add(alert.event_id);
          setActiveAlert(alert);
        }
      }
    } catch {
      // Suppress if unauthorized / offline
    }
  };

  useEffect(() => {
    checkUnacknowledgedAlerts();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkUnacknowledgedAlerts();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Listen to realtime socket events
    const socket = getSocket();
    const handleAlert = (data: SecurityAlertData) => {
      if (!data || !data.event_id) return;
      if (seenEventIds.current.has(data.event_id)) return;

      seenEventIds.current.add(data.event_id);
      setActiveAlert(data);
    };

    if (socket) {
      socket.on('security:alert', handleAlert);
      socket.on('security:password_changed', handleAlert);
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (socket) {
        socket.off('security:alert', handleAlert);
        socket.off('security:password_changed', handleAlert);
      }
    };
  }, []);

  const handleAcknowledge = async (action: 'review' | 'dismiss') => {
    if (!activeAlert) return;
    const eventId = activeAlert.event_id;
    setActiveAlert(null);

    try {
      await api.post(`/security/alerts/${eventId}/acknowledge`);
    } catch {
      // Suppress error
    }

    if (action === 'review') {
      navigate('/settings/security');
    }
  };

  if (!activeAlert) return null;

  // Format device / agent cleanly
  const parseDevice = (ua?: string) => {
    if (!ua) return 'Unknown Device';
    if (/android/i.test(ua)) return 'Android Device';
    if (/iphone|ipad|ipod/i.test(ua)) return 'iOS Device';
    if (/windows/i.test(ua)) return 'Windows PC';
    if (/macintosh|mac os x/i.test(ua)) return 'Mac';
    if (/linux/i.test(ua)) return 'Linux';
    return 'Web Browser';
  };

  const formattedTime = activeAlert.time || activeAlert.created_at
    ? new Date(activeAlert.time || activeAlert.created_at || '').toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short'
      })
    : 'Just now';

  return (
    <div className="fixed inset-0 z-[10001] bg-black/90 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-300">
      <div className="w-full max-w-md bg-zinc-900 border border-red-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-red-500/10 flex flex-col items-center text-center">
        {/* Pulsing Warning Icon */}
        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5 animate-pulse">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>

        {/* Header */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 text-red-400 text-[11px] font-bold tracking-wider uppercase mb-2">
          <AlertTriangle className="w-3.5 h-3.5" /> High-Priority Security Alert
        </div>
        <h2 className="text-xl font-bold tracking-tight text-white mb-2">
          Your Sparkle password was changed
        </h2>
        <p className="text-xs text-zinc-400 leading-relaxed mb-6">
          This password change happened on another device or session. If this wasn't you, your account may be compromised.
        </p>

        {/* Activity Details Card */}
        <div className="w-full p-4 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 text-left space-y-2.5 mb-6 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Device</span>
            <span className="font-semibold text-zinc-200">{parseDevice(activeAlert.user_agent)}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">Time</span>
            <span className="font-semibold text-zinc-200">{formattedTime}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">IP Address</span>
            <span className="font-mono text-zinc-300">{activeAlert.ip_address || 'Unavailable'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-zinc-400">MAC Address</span>
            <span className="font-mono text-zinc-500">MAC address unavailable</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col gap-3">
          <button
            type="button"
            onClick={() => handleAcknowledge('review')}
            className="w-full py-3.5 rounded-2xl bg-red-600 hover:bg-red-500 active:scale-98 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-600/30"
          >
            Review Security & Secure Account <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => handleAcknowledge('dismiss')}
            className="w-full py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 active:scale-98 text-zinc-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4 text-emerald-400" /> This was me
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrossDeviceSecurityAlertOverlay;
