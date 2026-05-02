import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield, UserX, MessageSquare, Bell, Eye, EyeOff, Check, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';

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
      console.error("Failed to fetch settings", err);
      setError("Failed to load settings. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (updated: Partial<MarketplaceSettings>) => {
    if (!settings) return;
    const newSettings = { ...settings, ...updated };
    setSettings(newSettings);
    
    try {
      setSaving(true);
      await api.put('/marketplace/settings', newSettings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to save settings", err);
      setError("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10 px-4 py-4 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Marketplace Settings</h1>
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

        {saving && (
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 animate-pulse">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />
            <span>Saving changes...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceSettings;
