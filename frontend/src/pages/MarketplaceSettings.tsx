import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Shield, UserX, MessageSquare, Bell, Eye, EyeOff, Check, AlertTriangle,
  Lock, BarChart3, CreditCard, ShieldAlert, ChevronRight, UserCheck, Settings,
  HelpCircle, CheckCircle2, TrendingUp, Package, Users, Flag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import Spinner from '../components/ui/Spinner';
import { logger } from '../utils/logger';
import { showInfo, showSuccess } from '../utils/toast';
import { promptDialog } from '../store/dialogStore';
import IdentityVerificationModal from '../components/modals/IdentityVerificationModal';

interface MarketplaceSettings {
  who_can_message_me: 'everyone' | 'vouched_only' | 'none';
  message_filter: boolean;
  read_receipts: boolean;
  typing_indicators: boolean;
  show_online_status: boolean;
  auto_reply_enabled: boolean;
  auto_reply_text: string;
}

const MarketplaceSettings = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<MarketplaceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Sub-view state (ported from MarketplaceSettingsModal — one marketplace settings surface)
  const [activeView, setActiveView] = useState<'main' | 'analytics' | 'payouts' | 'privacy' | 'support' | 'blocked'>('main');
  const [viewLoading, setViewLoading] = useState(false);
  const [viewData, setViewData] = useState<any>(null);
  const [isVerificationOpen, setIsVerificationOpen] = useState(false);

  const fetchAnalytics = async () => {
    setViewLoading(true);
    setActiveView('analytics');
    try {
      const res = await api.get('/marketplace/analytics');
      if (res.data.success) setViewData(res.data.data);
    } catch (err) {
      logger.error(err);
    } finally {
      setViewLoading(false);
    }
  };

  const fetchPayouts = async () => {
    setViewLoading(true);
    setActiveView('payouts');
    try {
      const res = await api.get('/marketplace/settings/payouts');
      if (res.data.success) setViewData(res.data.payouts);
    } catch (err) {
      logger.error(err);
    } finally {
      setViewLoading(false);
    }
  };

  const sections = [
    {
      title: 'Trust & Safety',
      items: [
        { id: 'verification', icon: <UserCheck className="text-blue-600" />, label: 'Marketplace Verification', desc: 'Get your blue checkmark', action: () => setIsVerificationOpen(true) },
        { id: 'security', icon: <Lock className="text-emerald-600" />, label: 'Account Security', desc: 'Manage your login & keys', action: () => showInfo('Security settings enabled') },
        { id: 'safety', icon: <ShieldAlert className="text-rose-600" />, label: 'Safety Center', desc: 'Reporting & blocked users', action: () => setActiveView('blocked') }
      ]
    },
    {
      title: 'Business Tools',
      items: [
        { id: 'analytics', icon: <BarChart3 className="text-indigo-600" />, label: 'Performance Stats', desc: 'Views, clicks & engagement', action: fetchAnalytics },
        { id: 'payouts', icon: <CreditCard className="text-amber-600" />, label: 'Payout Settings', desc: 'Manage where you get paid', action: fetchPayouts },
        { id: 'seller_tools', icon: <Settings className="text-slate-600" />, label: 'Seller Tools', desc: 'Bulk actions & auto-replies', action: () => showInfo('Auto-replies enabled. Bulk actions coming later.') }
      ]
    },
    {
      title: 'Support & Help',
      items: [
        { id: 'support', icon: <HelpCircle className="text-indigo-600" />, label: 'Marketplace Support', desc: 'Tickets & Chat Bot', action: () => setActiveView('support') }
      ]
    },
    {
      title: 'Preferences',
      items: [
        { id: 'privacy', icon: <Eye className="text-purple-600" />, label: 'Privacy Settings', desc: 'Who can see your shop', action: () => setActiveView('privacy') },
        { id: 'notifications', icon: <Bell className="text-orange-600" />, label: 'Marketplace Notifications', desc: 'Alerts for bids & messages', action: () => showInfo('Notifications active') }
      ]
    }
  ];

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/marketplace/settings');
      setSettings({
        ...res.data,
        message_filter: !!res.data.message_filter,
        read_receipts: !!res.data.read_receipts,
        typing_indicators: !!res.data.typing_indicators,
        show_online_status: !!res.data.show_online_status,
        auto_reply_enabled: !!res.data.auto_reply_enabled,
      });
    } catch (err) {
      logger.error("Failed to fetch settings", err);
      setError("Failed to load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updated: Partial<MarketplaceSettings>) => {
    if (!settings) return;
    const prev = settings;
    const newSettings = { ...settings, ...updated };
    setSettings(newSettings);
    
    try {
      setSaving(true);
      await api.put('/marketplace/settings', newSettings);
      setError(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      logger.error("Failed to save settings", err);
      setSettings(prev);
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-dvh bg-gray-50 flex items-center justify-center">
        <Spinner size="medium" color="text-primary" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-dvh bg-gray-50 pb-20">
        <div className="bg-white border-b sticky top-0 z-10 px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold text-gray-900">Marketplace Settings</h1>
        </div>
        <div className="max-w-2xl mx-auto p-4">
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-4 rounded-xl flex items-center gap-3">
            <AlertTriangle size={20} />
            <p className="text-sm font-medium">{error || 'Something went wrong while loading settings.'}</p>
          </div>
          <button
            onClick={fetchSettings}
            className="mt-4 px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => (activeView !== 'main' ? setActiveView('main') : navigate(-1))}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          aria-label={activeView !== 'main' ? 'Back to settings menu' : 'Go back'}
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">
          {activeView === 'main' ? 'Marketplace Settings' :
           activeView === 'analytics' ? 'Performance' :
           activeView === 'payouts' ? 'Payouts' :
           activeView === 'support' ? 'Support' :
           activeView === 'blocked' ? 'Blocked Users' : 'Privacy'}
        </h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3">
            <AlertTriangle size={20} />
            <p className="text-sm font-medium">{error}</p>
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-100 text-green-600 px-4 py-3 rounded-xl flex items-center gap-3">
            <Check size={20} />
            <p className="text-sm font-medium">Settings updated successfully!</p>
          </div>
        )}

        {activeView === 'main' && (
          <>
            {/* Settings menu (ported from MarketplaceSettingsModal) */}
            {sections.map((section, idx) => (
              <div key={section.title} className={idx !== 0 ? 'mt-10' : ''}>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-2">{section.title}</h3>
                <div className="space-y-2">
                  {section.items.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => item.action()}
                      className="w-full flex items-center justify-between p-4 rounded-lg transition-all group bg-slate-50 hover:bg-slate-100 active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                          {item.icon}
                        </div>
                        <div className="text-left">
                          <div className="font-black text-slate-800 flex items-center gap-2">
                            {item.label}
                          </div>
                          <div className="text-xs font-bold text-slate-500">{item.desc}</div>
                        </div>
                      </div>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ))}

        {/* Section 1: Privacy */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3 bg-gray-50/50">
            <Shield size={18} className="text-blue-600" />
            <h2 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Messaging Privacy</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-bold text-gray-700">Who can message me?</label>
              <select 
                value={settings.who_can_message_me}
                onChange={(e) => handleSave({ who_can_message_me: e.target.value as any })}
                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
              >
                <option value="everyone">Everyone</option>
                <option value="vouched_only">Vouched Users Only (Trust Score 2.0+)</option>
                <option value="none">No One (Disable New Chats)</option>
              </select>
              <p className="text-xs text-gray-500">Controls who can initiate a new marketplace conversation with you.</p>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-gray-900">Spam Filter</p>
                <p className="text-sm text-gray-500">Automatically hide suspicious or spammy messages.</p>
              </div>
              <button 
                onClick={() => handleSave({ message_filter: !settings.message_filter })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.message_filter ? 'bg-blue-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.message_filter ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Section 2: Experience */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3 bg-gray-50/50">
            <Eye size={18} className="text-indigo-600" />
            <h2 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Chat Experience</h2>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-gray-900">Read Receipts</p>
                <p className="text-sm text-gray-500">Show when you've read messages.</p>
              </div>
              <button 
                onClick={() => handleSave({ read_receipts: !settings.read_receipts })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.read_receipts ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.read_receipts ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-gray-900">Typing Indicators</p>
                <p className="text-sm text-gray-500">Show when you're typing a message.</p>
              </div>
              <button 
                onClick={() => handleSave({ typing_indicators: !settings.typing_indicators })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.typing_indicators ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.typing_indicators ? 'right-1' : 'left-1'}`} />
              </button>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-[15px] font-bold text-gray-900">Online Status</p>
                <p className="text-sm text-gray-500">Show your active status in marketplace chats.</p>
              </div>
              <button 
                onClick={() => handleSave({ show_online_status: !settings.show_online_status })}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.show_online_status ? 'bg-indigo-600' : 'bg-gray-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${settings.show_online_status ? 'right-1' : 'left-1'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* Section 3: Safety */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3 bg-gray-50/50">
            <UserX size={18} className="text-red-600" />
            <h2 className="font-bold text-gray-900 uppercase tracking-wider text-xs">Safety & Blocks</h2>
          </div>
          
          <div className="p-6">
            <button 
              onClick={() => navigate('/settings/blocked')}
              className="w-full flex items-center justify-between group"
            >
              <div className="text-left">
                <p className="text-[15px] font-bold text-gray-900">Blocked Users</p>
                <p className="text-sm text-gray-500">Manage users you've blocked globally.</p>
              </div>
              <ArrowLeft size={18} className="text-gray-400 group-hover:text-gray-600 rotate-180 transition-all" />
            </button>
          </div>
        </div>
          </>
        )}

        {activeView === 'analytics' && (
          <div className="space-y-6">
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mb-6">
              <p className="text-xs font-bold text-amber-700">Stats are being generated. Check back after more activity on your listings.</p>
            </div>
            {viewLoading ? (
              <div className="flex justify-center py-20"><Spinner size="medium" color="text-primary" /></div>
            ) : viewData ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Eye size={20} /></div>
                  <div className="text-3xl font-black">{viewData.views}</div>
                  <div className="text-sm font-bold text-slate-500">Total Views</div>
                </div>
                <div className="p-6 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4"><CheckCircle2 size={20} /></div>
                  <div className="text-3xl font-black">{viewData.sales}</div>
                  <div className="text-sm font-bold text-slate-500">Total Sales</div>
                </div>
                <div className="p-6 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4"><Package size={20} /></div>
                  <div className="text-3xl font-black">{viewData.listings}</div>
                  <div className="text-sm font-bold text-slate-500">Active Listings</div>
                </div>
                <div className="p-6 bg-slate-50 rounded-lg">
                  <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-4"><TrendingUp size={20} /></div>
                  <div className="text-3xl font-black">{(viewData.engagement_rate * 100).toFixed(1)}%</div>
                  <div className="text-sm font-bold text-slate-500">Engagement</div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-500 font-bold">No analytics data available yet.</div>
            )}
          </div>
        )}

        {activeView === 'support' && (
          <MarketplaceSupportView />
        )}

        {activeView === 'payouts' && (
          <div className="space-y-6">
            {viewLoading ? (
              <div className="flex justify-center py-20"><Spinner size="medium" color="text-primary" /></div>
            ) : viewData && viewData.length > 0 ? (
              viewData.map((payout: any) => (
                <div key={payout.payout_id} className="p-6 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center font-black text-amber-600 uppercase">
                      {payout.provider.substring(0,2)}
                    </div>
                    <div>
                      <div className="font-black">{payout.account_name}</div>
                      <div className="text-sm font-bold text-slate-500">{payout.provider.toUpperCase()} ••••</div>
                    </div>
                  </div>
                  {payout.is_default ? (
                    <span className="px-3 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-wider rounded-full">Default</span>
                  ) : (
                    <button className="text-sm font-bold text-slate-400 hover:text-slate-700">Make Default</button>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mx-auto mb-4">
                  <CreditCard size={24} className="text-slate-400" />
                </div>
                <div className="font-black text-slate-800 mb-2">No Payout Methods</div>
                <div className="text-sm font-bold text-slate-500 mb-6">Add a bank or mobile wallet to receive funds.</div>
                <button className="px-6 py-3 bg-slate-800 text-white font-black text-sm rounded-xl hover:bg-slate-700">Add Method</button>
              </div>
            )}
          </div>
        )}

        {activeView === 'privacy' && (
          <div className="space-y-6">
             <div className="p-6 bg-slate-50 rounded-lg space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black">Private Shop Mode</div>
                    <div className="text-sm font-bold text-slate-500">Only verified users can see your items</div>
                  </div>
                  <div className="w-12 h-6 bg-slate-300 rounded-full relative cursor-pointer">
                    <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full"></div>
                  </div>
                </div>
                <hr className="border-slate-200" />
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-black">Direct Messages</div>
                    <div className="text-sm font-bold text-slate-500">Who can message you</div>
                  </div>
                  <select className="bg-white border border-slate-200 rounded-xl px-4 py-2 font-bold text-sm outline-none">
                    <option>Everyone</option>
                    <option>Verified Only</option>
                    <option>Nobody</option>
                  </select>
                </div>
             </div>
          </div>
        )}

        {activeView === 'blocked' && (
          <BlockedUsersView />
        )}

        {saving && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 animate-pulse">
            <Spinner size="small" color="text-primary" />
            <span>Saving changes...</span>
          </div>
        )}
      </div>

      <IdentityVerificationModal
        isOpen={isVerificationOpen}
        onClose={() => setIsVerificationOpen(false)}
        onComplete={(data) => {
          logger.log('Verification completed:', data);
          setIsVerificationOpen(false);
        }}
      />
    </div>
  );
};

function MarketplaceSupportView() {
  const [mode, setMode] = useState<'options' | 'bot' | 'form' | 'tickets'>('options');
  const [botMessages, setBotMessages] = useState<{ role: 'bot' | 'user', text: string }[]>([
    { role: 'bot', text: 'Hi! I am the Sparkle Marketplace Bot. How can I help you today?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<any[]>([]);

  const askBot = async () => {
    if (!input.trim()) return;
    const userMsg = input;
    setInput('');
    setBotMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setLoading(true);
    try {
      const res = await api.post('/support/bot/ask', { message: userMsg });
      setBotMessages(prev => [...prev, { role: 'bot', text: res.data.response }]);
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTickets = async () => {
    setLoading(true);
    setMode('tickets');
    try {
      const res = await api.get('/support/tickets');
      if (res.data.success) setTickets(res.data.tickets);
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = Object.fromEntries(formData);
    setLoading(true);
    try {
      await api.post('/support/tickets', data);
      showSuccess('Ticket submitted successfully!');
      setMode('options');
    } catch (err) {
      logger.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'options') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-8 bg-indigo-600 rounded-xl text-white overflow-hidden relative">
          <div className="relative z-10">
            <h4 className="text-2xl font-black tracking-tighter mb-2">How can we help?</h4>
            <p className="text-indigo-100 font-bold text-sm mb-6 opacity-80">Search for help or chat with our automated assistant.</p>
            <div className="flex bg-white/20 backdrop-blur-md rounded-xl p-1">
              <input 
                placeholder="Search help articles..." 
                className="bg-transparent border-none outline-none flex-1 px-4 py-3 text-sm font-bold placeholder:text-indigo-200"
              />
              <button className="bg-white text-indigo-600 p-3 rounded-xl shadow-lg">
                <Users size={18} />
              </button>
            </div>
          </div>
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <button onClick={() => setMode('bot')} className="p-6 bg-slate-50 border border-slate-100 rounded-lg text-left hover:border-indigo-200 transition-all group">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <Users size={24} className="text-indigo-600" />
            </div>
            <div className="font-black text-slate-800">Ask Sparky Bot</div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Instant Answers</div>
          </button>
          <button onClick={() => setMode('form')} className="p-6 bg-slate-50 border border-slate-100 rounded-lg text-left hover:border-indigo-200 transition-all group">
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <ShieldAlert size={24} className="text-indigo-600" />
            </div>
            <div className="font-black text-slate-800">Open Ticket</div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Human Support</div>
          </button>
        </div>

        <button onClick={fetchTickets} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between group">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm"><Package size={20} className="text-slate-400" /></div>
            <div className="font-black text-slate-800">Your Support History</div>
          </div>
          <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-600" />
        </button>
      </div>
    );
  }

  if (mode === 'bot') {
    return (
      <div className="flex flex-col h-[600px] animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar pb-6">
          {botMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] p-4 rounded-xl font-bold text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 p-4 rounded-xl rounded-tl-none flex gap-1">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 bg-white pt-4 border-t border-slate-100">
          <div className="flex gap-2">
            <input 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && askBot()}
              placeholder="Ask anything..." 
              className="flex-1 bg-slate-50 border border-slate-100 rounded-xl px-5 py-4 font-bold text-sm outline-none focus:border-indigo-300 transition-colors"
            />
            <button onClick={askBot} className="bg-indigo-600 text-white p-4 rounded-xl shadow-xl shadow-indigo-100 active:scale-90 transition-transform">
              <TrendingUp size={20} />
            </button>
          </div>
          <button onClick={() => setMode('options')} className="w-full py-2 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Back to Options</button>
        </div>
      </div>
    );
  }

  if (mode === 'form') {
    return (
      <form onSubmit={submitTicket} className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Category</label>
          <select name="category" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-300 transition-colors appearance-none">
            <option value="verification">Verification Issue</option>
            <option value="payment">Payment & Payouts</option>
            <option value="abuse">Safety & Abuse</option>
            <option value="listing">Listing Support</option>
            <option value="account">Account Access</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Subject</label>
          <input name="subject" required placeholder="Brief title of your issue" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-300 transition-colors" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Description</label>
          <textarea name="description" required rows={4} placeholder="Describe the problem in detail..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl font-bold text-sm outline-none focus:border-indigo-300 transition-colors resize-none" />
        </div>
        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100 flex items-center gap-3">
          <Package size={20} className="text-indigo-600" />
          <p className="text-[10px] font-bold text-indigo-700">Attach photos on the next screen if needed.</p>
        </div>
        <div className="space-y-3 pt-4">
          <button type="submit" disabled={loading} className="w-full py-5 bg-indigo-600 text-white rounded-lg font-black text-sm shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">
            {loading ? 'Submitting...' : 'Submit Support Ticket'}
          </button>
          <button type="button" onClick={() => setMode('options')} className="w-full py-4 text-slate-400 font-black text-sm hover:text-slate-600 transition-colors">Cancel</button>
        </div>
      </form>
    );
  }

  if (mode === 'tickets') {
    return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-black text-slate-800">Support History</h4>
          <button onClick={() => setMode('options')} className="text-xs font-black text-indigo-600 hover:underline">New Request</button>
        </div>
        {loading ? (
          <div className="flex justify-center py-20"><Spinner size="medium" color="text-primary" /></div>
        ) : tickets.length > 0 ? (
          tickets.map((t) => (
            <div key={t.ticket_id} className="p-5 bg-slate-50 border border-slate-100 rounded-lg hover:border-slate-200 transition-colors cursor-pointer group">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest ${t.status === 'open' ? 'bg-blue-100 text-blue-700' : t.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                  {t.status}
                </span>
                <span className="text-[10px] font-bold text-slate-400">{new Date(t.created_at).toLocaleDateString()}</span>
              </div>
              <div className="font-black text-slate-800 group-hover:text-indigo-600 transition-colors">{t.subject}</div>
              <div className="text-xs font-bold text-slate-500 line-clamp-1 mt-1">{t.description}</div>
            </div>
          ))
        ) : (
          <div className="text-center py-20 text-slate-400 font-bold">You haven't submitted any tickets yet.</div>
        )}
        <button onClick={() => setMode('options')} className="w-full py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors">Back to Options</button>
      </div>
    );
  }

  return null;
}

function BlockedUsersView() {
  const [blockedUsers, setBlockedUsers] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);

  const fetchBlocked = async () => {
      try {
          const res = await api.get('/users/blocks');
          // Assuming res.data is an array of users
          setBlockedUsers(res.data);
      } catch (err) {
          logger.error(err);
      } finally {
          setLoading(false);
      }
  };

  const handleUnblock = async (userId: string) => {
      try {
          await api.delete(`/users/block/${userId}`);
          setBlockedUsers(prev => prev.filter(u => u.user_id !== userId));
      } catch (err) {
          logger.error(err);
      }
  };

  React.useEffect(() => {
      fetchBlocked();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Spinner size="medium" color="text-primary" /></div>;

  const handleReport = async (userId: string) => {
    const reason = await promptDialog("Enter reason for reporting this user:");
    if (!reason) return;
    try {
      await api.post(`/users/report/${userId}`, { reason, targetType: 'user' });
      showSuccess("Report submitted successfully.");
    } catch (err) {
      logger.error(err);
    }
  };

  return (
      <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500">
          {blockedUsers.length > 0 ? (
              blockedUsers.map(u => (
                  <div key={u.user_id} className="p-4 bg-slate-50 rounded-xl flex items-center justify-between border border-slate-100">
                      <div className="flex items-center gap-3">
                          <img src={u.avatar_url || `https://ui-avatars.com/api/?name=${u.username}`} className="w-10 h-10 rounded-full object-cover border border-white shadow-sm" alt="" />
                          <div>
                              <div className="font-black text-slate-800">{u.name || u.username}</div>
                              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">@{u.username}</div>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => handleReport(u.user_id)} 
                          className="p-2 bg-white border border-slate-200 rounded-lg text-rose-500 hover:bg-rose-50 transition-colors"
                          title="Report User"
                        >
                          <Flag size={14} />
                        </button>
                        <button 
                          onClick={() => handleUnblock(u.user_id)} 
                          className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                          Unblock
                        </button>
                      </div>
                  </div>
              ))
          ) : (
              <div className="text-center py-20 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                 <ShieldAlert size={32} className="text-slate-300 mx-auto mb-4" />
                 <div className="font-black text-slate-800">No Blocked Users</div>
                 <div className="text-xs font-bold text-slate-500">People you block will appear here.</div>
              </div>
          )}
      </div>
  );
}

export default MarketplaceSettings;
