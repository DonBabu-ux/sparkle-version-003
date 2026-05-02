import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ShieldCheck, Lock, BarChart3, 
  CreditCard, ShieldAlert, ChevronRight, UserCheck,
  Settings, Eye, Bell, Heart, HelpCircle, ArrowLeft, CheckCircle2, TrendingUp, Package, Users
} from 'lucide-react';
import api from '../../api/api';

interface MarketplaceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenVerification: () => void;
}

export default function MarketplaceSettingsModal({ isOpen, onClose, onOpenVerification }: MarketplaceSettingsModalProps) {
  const [activeView, setActiveView] = useState<'main' | 'analytics' | 'payouts' | 'privacy' | 'support'>('main');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [features, setFeatures] = useState<any>(null);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/marketplace/settings/preferences');
      if (res.data.success) {
        setFeatures(res.data.settings.features);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    setActiveView('analytics');
    try {
      const res = await api.get('/marketplace/analytics');
      if (res.data.success) setData(res.data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPayouts = async () => {
    setLoading(true);
    setActiveView('payouts');
    try {
      const res = await api.get('/marketplace/settings/payouts');
      if (res.data.success) setData(res.data.payouts);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchSettings();
  }, []);

  const getFeatureStatus = (id: string) => {
    if (!features) return { status: 'enabled' };
    return features[id] || { status: 'enabled' };
  };

  const handleAction = (item: any) => {
    const feature = getFeatureStatus(item.id);
    if (feature.status === 'locked') {
      alert(`Feature Locked: ${feature.reason.replace(/_/g, ' ')}`);
      return;
    }
    item.action();
  };

  const sections = [
    {
      title: 'Trust & Safety',
      items: [
        { id: 'verification', icon: <UserCheck className="text-blue-600" />, label: 'Marketplace Verification', desc: 'Get your blue checkmark', action: onOpenVerification },
        { id: 'security', icon: <Lock className="text-emerald-600" />, label: 'Account Security', desc: 'Manage your login & keys', action: () => alert('Security settings enabled') },
        { id: 'safety', icon: <ShieldAlert className="text-rose-600" />, label: 'Safety Center', desc: 'Reporting & blocked users', action: () => alert('Safety Center active') }
      ]
    },
    {
      title: 'Business Tools',
      items: [
        { id: 'analytics', icon: <BarChart3 className="text-indigo-600" />, label: 'Performance Stats', desc: 'Views, clicks & engagement', action: fetchAnalytics },
        { id: 'payouts', icon: <CreditCard className="text-amber-600" />, label: 'Payout Settings', desc: 'Manage where you get paid', action: fetchPayouts },
        { id: 'seller_tools', icon: <Settings className="text-slate-600" />, label: 'Seller Tools', desc: 'Bulk actions & auto-replies', action: () => alert('Auto-replies enabled. Bulk actions coming later.') }
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
        { id: 'notifications', icon: <Bell className="text-orange-600" />, label: 'Marketplace Notifications', desc: 'Alerts for bids & messages', action: () => alert('Notifications active') }
      ]
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          className="fixed inset-0 bg-white z-[200] overflow-y-auto"
        >
          {/* Header */}
          <div className="sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-5 flex items-center justify-between z-10">
            <div className="flex items-center gap-4">
              {activeView !== 'main' && (
                <button onClick={() => setActiveView('main')} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
                  <ArrowLeft size={20} />
                </button>
              )}
              <h2 className="text-2xl font-black tracking-tighter">
                {activeView === 'main' ? 'Settings' : 
                 activeView === 'analytics' ? 'Performance' : 
                 activeView === 'payouts' ? 'Payouts' : 
                 activeView === 'support' ? 'Support' : 'Privacy'}
              </h2>
            </div>
            <button onClick={() => { onClose(); setActiveView('main'); }} className="w-10 h-10 flex items-center justify-center bg-slate-100 rounded-full hover:bg-slate-200 transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="px-6 py-8 max-w-2xl mx-auto">
            {activeView === 'main' && (
              <>
                {sections.map((section, idx) => (
                  <div key={section.title} className={idx !== 0 ? 'mt-10' : ''}>
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 mb-4 px-2">{section.title}</h3>
                    <div className="space-y-2">
                      {section.items.map((item) => {
                        const feature = getFeatureStatus(item.id);
                        return (
                          <button
                            key={item.id}
                            onClick={() => handleAction(item)}
                            className={`w-full flex items-center justify-between p-4 rounded-[24px] transition-all group active:scale-[0.98] ${feature.status === 'locked' ? 'bg-slate-50 opacity-60 grayscale' : 'bg-slate-50 hover:bg-slate-100'}`}
                          >
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                                {item.icon}
                              </div>
                              <div className="text-left">
                                <div className="font-black text-slate-800 flex items-center gap-2">
                                  {item.label}
                                  {feature.status === 'locked' && <Lock size={12} className="text-slate-400" />}
                                  {feature.status === 'limited' && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-widest">Beta</span>}
                                </div>
                                <div className="text-xs font-bold text-slate-500">
                                  {feature.status === 'locked' ? `Verification Required` : item.desc}
                                </div>
                              </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </>
            )}

            {activeView === 'analytics' && (
              <div className="space-y-6">
                <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 mb-6">
                  <p className="text-xs font-bold text-amber-700">Stats are being generated. Check back after more activity on your listings.</p>
                </div>
                {loading ? (
                  <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>
                ) : data ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-slate-50 rounded-[24px]">
                      <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center mb-4"><Eye size={20} /></div>
                      <div className="text-3xl font-black">{data.views}</div>
                      <div className="text-sm font-bold text-slate-500">Total Views</div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-[24px]">
                      <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4"><CheckCircle2 size={20} /></div>
                      <div className="text-3xl font-black">{data.sales}</div>
                      <div className="text-sm font-bold text-slate-500">Total Sales</div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-[24px]">
                      <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mb-4"><Package size={20} /></div>
                      <div className="text-3xl font-black">{data.listings}</div>
                      <div className="text-sm font-bold text-slate-500">Active Listings</div>
                    </div>
                    <div className="p-6 bg-slate-50 rounded-[24px]">
                      <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl flex items-center justify-center mb-4"><TrendingUp size={20} /></div>
                      <div className="text-3xl font-black">{(data.engagement_rate * 100).toFixed(1)}%</div>
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
                {loading ? (
                  <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin"></div></div>
                ) : data && data.length > 0 ? (
                  data.map((payout: any) => (
                    <div key={payout.payout_id} className="p-6 bg-slate-50 border border-slate-200 rounded-[24px] flex items-center justify-between">
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
                  <div className="text-center py-20 bg-slate-50 rounded-[32px] border-2 border-dashed border-slate-200">
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
                 <div className="p-6 bg-slate-50 rounded-[24px] space-y-6">
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

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

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
      console.error(err);
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
      console.error(err);
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
      alert('Ticket submitted successfully!');
      setMode('options');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'options') {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-8 bg-indigo-600 rounded-[32px] text-white overflow-hidden relative">
          <div className="relative z-10">
            <h4 className="text-2xl font-black tracking-tighter mb-2">How can we help?</h4>
            <p className="text-indigo-100 font-bold text-sm mb-6 opacity-80">Search for help or chat with our automated assistant.</p>
            <div className="flex bg-white/20 backdrop-blur-md rounded-2xl p-1">
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
          <button onClick={() => setMode('bot')} className="p-6 bg-slate-50 border border-slate-100 rounded-[24px] text-left hover:border-indigo-200 transition-all group">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <Users size={24} className="text-indigo-600" />
            </div>
            <div className="font-black text-slate-800">Ask Sparky Bot</div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Instant Answers</div>
          </button>
          <button onClick={() => setMode('form')} className="p-6 bg-slate-50 border border-slate-100 rounded-[24px] text-left hover:border-indigo-200 transition-all group">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm mb-4 group-hover:scale-110 transition-transform">
              <ShieldAlert size={24} className="text-indigo-600" />
            </div>
            <div className="font-black text-slate-800">Open Ticket</div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Human Support</div>
          </button>
        </div>

        <button onClick={fetchTickets} className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[24px] flex items-center justify-between group">
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
              <div className={`max-w-[80%] p-4 rounded-2xl font-bold text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 p-4 rounded-2xl rounded-tl-none flex gap-1">
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
              className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 font-bold text-sm outline-none focus:border-indigo-300 transition-colors"
            />
            <button onClick={askBot} className="bg-indigo-600 text-white p-4 rounded-2xl shadow-xl shadow-indigo-100 active:scale-90 transition-transform">
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
          <select name="category" required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300 transition-colors appearance-none">
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
          <input name="subject" required placeholder="Brief title of your issue" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300 transition-colors" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 px-2">Description</label>
          <textarea name="description" required rows={4} placeholder="Describe the problem in detail..." className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-sm outline-none focus:border-indigo-300 transition-colors resize-none" />
        </div>
        <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100 flex items-center gap-3">
          <Package size={20} className="text-indigo-600" />
          <p className="text-[10px] font-bold text-indigo-700">Attach photos on the next screen if needed.</p>
        </div>
        <div className="space-y-3 pt-4">
          <button type="submit" disabled={loading} className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-sm shadow-xl shadow-indigo-100 hover:scale-[1.02] active:scale-95 transition-all">
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
          <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div></div>
        ) : tickets.length > 0 ? (
          tickets.map((t) => (
            <div key={t.ticket_id} className="p-5 bg-slate-50 border border-slate-100 rounded-[24px] hover:border-slate-200 transition-colors cursor-pointer group">
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
