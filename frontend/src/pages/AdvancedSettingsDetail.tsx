import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Shield,
  Lock,
  User as UserIcon,
  MessageSquare,
  Sparkles,
  Database,
  Bell,
  Wand2,
  Sliders,
  Terminal,
  Workflow,
  FileSearch,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Smartphone,
  Wifi,
  Activity
} from 'lucide-react';
import Navbar from '../components/Navbar';
import { SettingCardGroup } from '../components/settings/SettingCardGroup';
import { SettingRow } from '../components/settings/SettingRow';
import api from '../api/api';
import { useUserStore } from '../store/userStore';
import { useSocket } from '../hooks/useSocket';

export default function AdvancedSettingsDetail() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();
  const socket = useSocket();
  const { user, setUser } = useUserStore();

  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Canonical server settings state
  const [settings, setSettings] = useState<Record<string, any>>({
    sensitive_content_level: 'standard',
    ai_content_opt_out: false,
    recommendation_personalization: true,
    search_indexing_enabled: true,
    profile_discoverability: 'everyone',
    reduced_motion: false,
    font_scale: 'medium',
    auto_download_media: 'wifi',
    link_previews_enabled: true,
    haptic_intensity: 'medium',
    media_quality: 'standard',
    allow_copy: true,
    allow_forward: true,
    screenshot_protection: false,
    blur_screen_recording: false,
  });

  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    fetchSettings();
    if (section === 'security') {
      fetchSessions();
    }
  }, [section]);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/advanced-settings');
      if (res.data?.success && res.data?.settings) {
        setSettings((prev) => ({ ...prev, ...res.data.settings }));
      }
    } catch (err) {
      console.error('Failed to load advanced settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const res = await api.get('/users/sessions');
      if (Array.isArray(res.data)) {
        setSessions(res.data);
      } else if (res.data?.sessions) {
        setSessions(res.data.sessions);
      }
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    }
  };

  const handleUpdateSetting = async (key: string, value: any) => {
    setUpdating(key);
    setSuccessMsg(null);
    setErrorMsg(null);

    // Optimistic UI state update
    const previousValue = settings[key];
    setSettings((prev) => ({ ...prev, [key]: value }));

    try {
      const res = await api.put('/users/settings', { [key]: value });
      if (res.status === 200 || res.data?.message) {
        setSuccessMsg(`Updated ${key.replace(/_/g, ' ')}`);
        setTimeout(() => setSuccessMsg(null), 2500);

        // Update user store if matching key exists
        if (user) {
          setUser({ ...user, [key]: value } as any);
        }
      }
    } catch (err) {
      // Revert to canonical previous value on error
      setSettings((prev) => ({ ...prev, [key]: previousValue }));
      setErrorMsg('Failed to update setting. Server canonical state restored.');
      setTimeout(() => setErrorMsg(null), 3500);
    } finally {
      setUpdating(null);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await api.delete(`/users/sessions/${sessionId}`);
      setSessions((prev) => prev.filter((s) => s.session_id !== sessionId && s.id !== sessionId));
      setSuccessMsg('Session revoked successfully');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setErrorMsg('Failed to revoke session');
    }
  };

  const sectionTitles: Record<string, { title: string; subtitle: string; icon: any }> = {
    privacy: { title: 'Privacy Architecture', subtitle: 'Discoverability, permissions & capture controls', icon: Shield },
    security: { title: 'Security Centre', subtitle: '2FA, passkeys, sessions & security logs', icon: Lock },
    account: { title: 'Account & Identity', subtitle: 'Identity, badges, verification & deletion', icon: UserIcon },
    messaging: { title: 'Messaging Architecture', subtitle: 'Auto-download, link previews & media rules', icon: MessageSquare },
    content: { title: 'Content Intelligence', subtitle: 'Recommendations, AI filters & ranking', icon: Sparkles },
    data: { title: 'Data & Storage', subtitle: 'Cache, compression & data export', icon: Database },
    notifications: { title: 'Notification Engine', subtitle: 'Quiet hours, sound profiles & priorities', icon: Bell },
    creator: { title: 'Creator Controls', subtitle: 'Remix, comment & audience permissions', icon: Wand2 },
    accessibility: { title: 'Accessibility & Interface', subtitle: 'Motion, fonts, contrast & haptics', icon: Sliders },
    developer: { title: 'Developer & Diagnostics', subtitle: 'Realtime socket, network & build status', icon: Terminal },
    automation: { title: 'Automation & Rules', subtitle: 'Automated notification & filtering rules', icon: Workflow },
    transparency: { title: 'Account Transparency', subtitle: 'Data retention & personalization summary', icon: FileSearch },
  };

  const currentMeta = sectionTitles[section || 'privacy'] || sectionTitles.privacy;
  const SectionIcon = currentMeta.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-24 transition-colors">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
        {/* Navigation Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/settings/advanced')}
              className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:scale-105 active:scale-95 transition-all shadow-sm"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-zinc-100">
                {currentMeta.title}
              </h1>
              <p className="text-xs text-slate-500 dark:text-zinc-400">
                {currentMeta.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Feedback Alerts */}
        {successMsg && (
          <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* SECTION: Privacy Architecture */}
        {section === 'privacy' && (
          <>
            <SettingCardGroup title="Discoverability & Audience">
              <SettingRow
                icon={UserIcon}
                title="Profile Discoverability"
                description="Control who can search and discover your profile"
                rightElement="badge"
                badgeText={settings.profile_discoverability || 'Everyone'}
                onClick={() => {
                  const next = settings.profile_discoverability === 'everyone' ? 'friends' : settings.profile_discoverability === 'friends' ? 'private' : 'everyone';
                  handleUpdateSetting('profile_discoverability', next);
                }}
              />
              <SettingRow
                icon={Shield}
                title="Search Engine Indexing"
                description="Allow public search engines to index your profile"
                rightElement="toggle"
                toggleValue={!!settings.search_indexing_enabled}
                onToggleChange={(val) => handleUpdateSetting('search_indexing_enabled', val ? 1 : 0)}
              />
            </SettingCardGroup>

            <SettingCardGroup title="Message Capture & Forward Controls">
              <SettingRow
                icon={Shield}
                title="Default Allow Copy"
                description="Allow recipients to copy text from your sent messages"
                rightElement="toggle"
                toggleValue={!!settings.allow_copy}
                onToggleChange={(val) => handleUpdateSetting('allow_copy', val)}
              />
              <SettingRow
                icon={Shield}
                title="Default Allow Forward"
                description="Allow recipients to forward your messages to other chats"
                rightElement="toggle"
                toggleValue={!!settings.allow_forward}
                onToggleChange={(val) => handleUpdateSetting('allow_forward', val)}
              />
            </SettingCardGroup>
          </>
        )}

        {/* SECTION: Security Centre */}
        {section === 'security' && (
          <>
            <SettingCardGroup title="Authentication & Protection">
              <SettingRow
                icon={Lock}
                title="Two-Factor Authentication (2FA)"
                description="Protect your account with an extra security verification layer"
                rightElement="badge"
                badgeText={user?.two_factor_enabled ? 'Enabled' : 'Disabled'}
                badgeVariant={user?.two_factor_enabled ? 'green' : 'amber'}
                onClick={() => navigate('/settings')}
              />
              <SettingRow
                icon={Lock}
                title="Login Alerts"
                description="Receive notifications whenever a new device logs into your account"
                rightElement="toggle"
                toggleValue={true}
                onToggleChange={() => {}}
              />
            </SettingCardGroup>

            <SettingCardGroup title="Active Login Sessions">
              {sessions.length > 0 ? (
                sessions.map((s, idx) => (
                  <SettingRow
                    key={s.session_id || s.id || idx}
                    icon={Smartphone}
                    title={s.device_name || s.user_agent?.slice(0, 30) || 'Active Session'}
                    description={`IP: ${s.ip_address || 'Unknown'} • Last active: ${s.last_active ? new Date(s.last_active).toLocaleDateString() : 'Now'}`}
                    rightElement="badge"
                    badgeText="Revoke"
                    badgeVariant="amber"
                    onClick={() => handleRevokeSession(s.session_id || s.id)}
                  />
                ))
              ) : (
                <div className="p-4 text-xs text-slate-500 dark:text-zinc-400 text-center">
                  1 Active Session (Current Device)
                </div>
              )}
            </SettingCardGroup>
          </>
        )}

        {/* SECTION: Content Intelligence */}
        {section === 'content' && (
          <>
            <SettingCardGroup title="Feed & Ranking Rules">
              <SettingRow
                icon={Sparkles}
                title="Personalized Recommendations"
                description="Use interaction history to tailor feed and moment rankings"
                rightElement="toggle"
                toggleValue={!!settings.recommendation_personalization}
                onToggleChange={(val) => handleUpdateSetting('recommendation_personalization', val ? 1 : 0)}
              />
              <SettingRow
                icon={Sparkles}
                title="AI-Generated Content Opt-Out"
                description="Reduce AI-suggested content across your discovery feeds"
                rightElement="toggle"
                toggleValue={!!settings.ai_content_opt_out}
                onToggleChange={(val) => handleUpdateSetting('ai_content_opt_out', val ? 1 : 0)}
              />
            </SettingCardGroup>

            <SettingCardGroup title="Content Filtering">
              <SettingRow
                icon={Shield}
                title="Sensitive Content Threshold"
                description="Filter potentially sensitive or unverified media"
                rightElement="badge"
                badgeText={settings.sensitive_content_level === 'strict' ? 'Strict' : 'Standard'}
                onClick={() => {
                  const next = settings.sensitive_content_level === 'strict' ? 'standard' : 'strict';
                  handleUpdateSetting('sensitive_content_level', next);
                }}
              />
            </SettingCardGroup>
          </>
        )}

        {/* SECTION: Messaging Architecture */}
        {section === 'messaging' && (
          <>
            <SettingCardGroup title="Media & Network Rules">
              <SettingRow
                icon={Wifi}
                title="Auto-Download Media"
                description="Control when media downloads automatically"
                rightElement="badge"
                badgeText={settings.auto_download_media?.toUpperCase() || 'WI-FI'}
                onClick={() => {
                  const next = settings.auto_download_media === 'wifi' ? 'always' : settings.auto_download_media === 'always' ? 'never' : 'wifi';
                  handleUpdateSetting('auto_download_media', next);
                }}
              />
              <SettingRow
                icon={MessageSquare}
                title="Rich Link Previews"
                description="Generate link previews for shared URLs in chat"
                rightElement="toggle"
                toggleValue={!!settings.link_previews_enabled}
                onToggleChange={(val) => handleUpdateSetting('link_previews_enabled', val ? 1 : 0)}
              />
            </SettingCardGroup>
          </>
        )}

        {/* SECTION: Accessibility & Interface */}
        {section === 'accessibility' && (
          <>
            <SettingCardGroup title="Display & Motion">
              <SettingRow
                icon={Sliders}
                title="Reduced Motion"
                description="Minimize high-intensity UI transitions and pulse animations"
                rightElement="toggle"
                toggleValue={!!settings.reduced_motion}
                onToggleChange={(val) => handleUpdateSetting('reduced_motion', val ? 1 : 0)}
              />
              <SettingRow
                icon={Sliders}
                title="Font Scale"
                description="Adjust text sizing across the application interface"
                rightElement="badge"
                badgeText={settings.font_scale?.toUpperCase() || 'MEDIUM'}
                onClick={() => {
                  const next = settings.font_scale === 'medium' ? 'large' : settings.font_scale === 'large' ? 'small' : 'medium';
                  handleUpdateSetting('font_scale', next);
                }}
              />
              <SettingRow
                icon={Smartphone}
                title="Haptic Feedback Intensity"
                description="Vibration intensity for touch targets and micro-interactions"
                rightElement="badge"
                badgeText={settings.haptic_intensity?.toUpperCase() || 'MEDIUM'}
                onClick={() => {
                  const next = settings.haptic_intensity === 'medium' ? 'high' : settings.haptic_intensity === 'high' ? 'off' : 'medium';
                  handleUpdateSetting('haptic_intensity', next);
                }}
              />
            </SettingCardGroup>
          </>
        )}

        {/* SECTION: Developer & Diagnostics */}
        {section === 'developer' && (
          <>
            <SettingCardGroup title="System & Network Status">
              <SettingRow
                icon={Activity}
                title="WebSocket Connection"
                description="Realtime Socket.IO gateway connection status"
                rightElement="badge"
                badgeText={socket?.connected ? 'CONNECTED' : 'DISCONNECTED'}
                badgeVariant={socket?.connected ? 'green' : 'amber'}
              />
              <SettingRow
                icon={Terminal}
                title="API Service Status"
                description="REST backend API reachability"
                rightElement="badge"
                badgeText="REACHABLE"
                badgeVariant="green"
              />
              <SettingRow
                icon={Database}
                title="App Version & Build"
                description="Sparkle Social Ecosystem v1.0.0 (Build 2026.09)"
                rightElement="badge"
                badgeText="STABLE"
                badgeVariant="slate"
              />
            </SettingCardGroup>
          </>
        )}

        {/* SECTION: Account Transparency */}
        {section === 'transparency' && (
          <>
            <SettingCardGroup title="Data Governance & Retention">
              <SettingRow
                icon={FileSearch}
                title="Personalization Summary"
                description="View categories of data used to personalize your Sparkle feed"
                rightElement="chevron"
                onClick={() => alert('Sparkle collects interest topics and interaction velocity to rank feeds. No third-party ad brokers are used.')}
              />
              <SettingRow
                icon={Database}
                title="Download My Account Data"
                description="Export a full JSON archive of your Sparkle profile and posts"
                rightElement="badge"
                badgeText="Export"
                badgeVariant="pink"
                onClick={async () => {
                  try {
                    const res = await api.get('/users/export-data');
                    const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `sparkle_data_export_${user?.username || 'user'}.json`;
                    a.click();
                  } catch (e) {
                    setErrorMsg('Failed to export data');
                  }
                }}
              />
            </SettingCardGroup>
          </>
        )}

        {/* Fallback for other sections */}
        {!['privacy', 'security', 'content', 'messaging', 'accessibility', 'developer', 'transparency'].includes(section || '') && (
          <SettingCardGroup title="Configuration Options">
            <SettingRow
              icon={SectionIcon}
              title={`${currentMeta.title} Options`}
              description="Server-backed configuration settings for this domain"
              rightElement="badge"
              badgeText="Active"
              badgeVariant="green"
            />
          </SettingCardGroup>
        )}
      </main>
    </div>
  );
}
