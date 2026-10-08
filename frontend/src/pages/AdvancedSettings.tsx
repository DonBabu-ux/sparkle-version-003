import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Search,
  ChevronRight,
  Info
} from 'lucide-react';
import { SettingCardGroup } from '../components/settings/SettingCardGroup';
import { SettingRow } from '../components/settings/SettingRow';
import { useUserStore } from '../store/userStore';

export default function AdvancedSettings() {
  const navigate = useNavigate();
  const { user } = useUserStore();
  const [searchQuery, setSearchQuery] = useState('');

  const isCreator = user?.user_type === 'Creator' || user?.is_verified || (user as any)?.followers_count > 100;

  const advancedSections = [
    {
      id: 'privacy',
      title: 'Privacy Architecture',
      description: 'Default audience, discoverability, search indexing, and copy/forward permissions',
      icon: Shield,
      category: 'Core Controls',
    },
    {
      id: 'security',
      title: 'Security Centre',
      description: 'Two-factor authentication, active sessions, trusted devices, and security logs',
      icon: Lock,
      category: 'Core Controls',
    },
    {
      id: 'account',
      title: 'Account & Identity',
      description: 'Username history, verification badge state, deactivation, and recovery options',
      icon: UserIcon,
      category: 'Core Controls',
    },
    {
      id: 'messaging',
      title: 'Messaging Architecture',
      description: 'Disappearing message defaults, media auto-download, and sender filtering',
      icon: MessageSquare,
      category: 'Communication',
    },
    {
      id: 'content',
      title: 'Content Intelligence',
      description: 'Recommendation ranking preferences, sensitive content threshold, and AI filters',
      icon: Sparkles,
      category: 'Communication',
    },
    {
      id: 'data',
      title: 'Data & Storage',
      description: 'Data usage breakdown, media cache clearing, download quality, and data exports',
      icon: Database,
      category: 'System & Storage',
    },
    {
      id: 'notifications',
      title: 'Notification Engine',
      description: 'Quiet hours, notification priorities, sound profiles, and push privacy',
      icon: Bell,
      category: 'Communication',
    },

    ...(isCreator
      ? [
          {
            id: 'creator',
            title: 'Creator Controls',
            description: 'Default post audience, remix permissions, analytics privacy, and monetization',
            icon: Wand2,
            category: 'Monetization & Creation',
          },
        ]
      : []),

    {
      id: 'accessibility',
      title: 'Accessibility & Interface',
      description: 'Reduced motion, font scaling, contrast, haptic intensity, and video autoplay',
      icon: Sliders,
      category: 'System & Storage',
    },
    {
      id: 'developer',
      title: 'Developer & Diagnostics',
      description: 'WebSocket connection status, network quality, API reachability, and version info',
      icon: Terminal,
      category: 'Diagnostics & Rules',
    },
    {
      id: 'automation',
      title: 'Automation & Rules',
      description: 'Automated notification suppression, data-saving rules, and request filters',
      icon: Workflow,
      category: 'Diagnostics & Rules',
    },
    {
      id: 'transparency',
      title: 'Account Transparency',
      description: 'Personalization profile data, retention schedules, and collected data report',
      icon: FileSearch,
      category: 'Diagnostics & Rules',
    },
  ];

  const filteredSections = advancedSections.filter(
    (sec) =>
      sec.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      sec.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const categories = Array.from(new Set(filteredSections.map((s) => s.category)));

  return (
    <div className="min-h-dvh bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-zinc-100 pb-24 transition-colors">

      <main className="max-w-2xl mx-auto px-4 pt-4 sm:pt-6">
        {/* Header Navigation */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/settings')}
            className="w-9 h-9 rounded-full bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300 hover:scale-105 active:scale-95 transition-all shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-[#ff1493] via-[#fb7185] to-[#ff1493] bg-clip-text text-transparent">
              Advanced Settings
            </h1>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Control Centre & System Architecture
            </p>
          </div>
        </div>

        {/* Intro Card */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-pink-500/10 via-purple-500/5 to-transparent border border-pink-500/20 flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-full bg-[#ff1493]/15 text-[#ff1493] flex items-center justify-center shrink-0 mt-0.5">
            <Info className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
              System Control Centre
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mt-0.5 leading-relaxed">
              Fine-tune how Sparkle behaves, protects your data, and interacts with your account. All settings are server-authoritative and synchronized in real-time.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-500" />
          <input
            type="text"
            placeholder="Search advanced settings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-sm focus:outline-none focus:border-[#ff1493] dark:focus:border-pink-500 transition-colors shadow-sm"
          />
        </div>

        {/* Categorized Settings Groups */}
        {categories.map((categoryName) => {
          const groupItems = filteredSections.filter((s) => s.category === categoryName);
          if (groupItems.length === 0) return null;

          return (
            <SettingCardGroup key={categoryName} title={categoryName}>
              {groupItems.map((item) => (
                <SettingRow
                  key={item.id}
                  icon={item.icon}
                  title={item.title}
                  description={item.description}
                  rightElement="chevron"
                  onClick={() => navigate(`/settings/advanced/${item.id}`)}
                />
              ))}
            </SettingCardGroup>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800">
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              No matching settings found for "{searchQuery}".
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
