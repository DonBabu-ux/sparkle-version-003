import React, { useState, useEffect } from 'react';
import { 
  X, ArrowLeft, Search, Smile, Sparkles, Heart, Frown, 
  Zap, Ghost, Sun, Moon, Star, PartyPopper,
  Tv, Utensils, Coffee, Ticket, Plane, Headphones, 
  Brain, BookOpen, Gamepad2, Megaphone, Check,
  Wind, Shield, Target, Compass, Anchor, Cloud,
  ShoppingBag, PenTool, Footprints, Dumbbell, Bike, Car,
  Users, UserPlus, ChevronRight, Loader2
} from 'lucide-react';
import api from '../../api/api';
import { getAvatarUrl } from '../../utils/imageUtils';

interface SelectionItem {
  name: string;
  icon: any;
  color: string;
  options?: string[];
}

interface TaggedUser {
  user_id: string;
  username: string;
  name: string;
  avatar_url: string;
}

interface FeelingActivitySelectorProps {
  onSelect: (data: { 
    feeling: SelectionItem | null, 
    activity: SelectionItem | null, 
    subOption: string | null,
    taggedUsers: TaggedUser[] 
  }) => void;
  onClose: () => void;
  initialSelection?: { 
    feeling: SelectionItem | null, 
    activity: SelectionItem | null, 
    subOption: string | null,
    taggedUsers: TaggedUser[] 
  };
}

const FEELINGS: SelectionItem[] = [
  { name: 'happy', icon: Smile, color: 'text-yellow-500' },
  { name: 'blessed', icon: Sparkles, color: 'text-blue-400' },
  { name: 'loved', icon: Heart, color: 'text-red-500' },
  { name: 'sad', icon: Frown, color: 'text-indigo-400' },
  { name: 'thankful', icon: Heart, color: 'text-pink-400' },
  { name: 'excited', icon: Zap, color: 'text-yellow-600' },
  { name: 'in love', icon: Heart, color: 'text-rose-600' },
  { name: 'crazy', icon: Ghost, color: 'text-purple-500' },
  { name: 'grateful', icon: Sun, color: 'text-orange-400' },
  { name: 'blissful', icon: Moon, color: 'text-slate-400' },
  { name: 'fantastic', icon: Star, color: 'text-amber-400' },
  { name: 'silly', icon: PartyPopper, color: 'text-green-500' },
  { name: 'relaxed', icon: Wind, color: 'text-teal-400' },
  { name: 'proud', icon: Shield, color: 'text-blue-600' },
  { name: 'focused', icon: Target, color: 'text-red-600' },
  { name: 'curious', icon: Compass, color: 'text-indigo-500' },
  { name: 'calm', icon: Anchor, color: 'text-slate-500' },
  { name: 'bored', icon: Cloud, color: 'text-gray-400' },
];

const ACTIVITIES: SelectionItem[] = [
  { name: 'celebrating', icon: PartyPopper, color: 'text-pink-500', options: ['Birthday', 'Anniversary', 'Graduation', 'Holiday', 'Success', 'Custom...'] },
  { name: 'watching', icon: Tv, color: 'text-blue-500', options: ['Movies', 'TV Shows', 'Matches', 'Animes', 'Series', 'Custom...'] },
  { name: 'eating', icon: Utensils, color: 'text-orange-500', options: ['Lunch', 'Dinner', 'Breakfast', 'Snacks', 'Dessert', 'Custom...'] },
  { name: 'drinking', icon: Coffee, color: 'text-amber-800', options: ['Coffee', 'Tea', 'Soda', 'Wine', 'Beer', 'Juice', 'Custom...'] },
  { name: 'attending', icon: Ticket, color: 'text-purple-500', options: ['Event', 'Concert', 'Wedding', 'Party', 'Workshop', 'Custom...'] },
  { name: 'travelling to', icon: Plane, color: 'text-cyan-500', options: ['Campus', 'Home', 'Vacation', 'The City', 'A Meeting', 'Custom...'] },
  { name: 'listening to', icon: Headphones, color: 'text-green-500', options: ['Music', 'Podcast', 'Audiobook', 'Radio', 'Custom...'] },
  { name: 'looking for', icon: Search, color: 'text-slate-500', options: ['New Friends', 'A Job', 'Inspiration', 'Adventure', 'A Movie', 'Custom...'] },
  { name: 'thinking about', icon: Brain, color: 'text-blue-400', options: ['The Future', 'Sparkle', 'My Goals', 'The Weekend', 'Food', 'Custom...'] },
  { name: 'reading', icon: BookOpen, color: 'text-emerald-500', options: ['Book', 'Magazine', 'Article', 'News', 'Manga', 'Custom...'] },
  { name: 'playing', icon: Gamepad2, color: 'text-red-400', options: ['Video Games', 'Sports', 'Board Games', 'Cards', 'Custom...'] },
  { name: 'supporting', icon: Megaphone, color: 'text-indigo-500', options: ['Local Business', 'A Cause', 'A Friend', 'Team Spirit', 'Charity', 'Custom...'] },
  { name: 'shopping', icon: ShoppingBag, color: 'text-pink-400', options: ['Clothes', 'Groceries', 'Tech', 'Gifts', 'Decor', 'Custom...'] },
  { name: 'studying', icon: PenTool, color: 'text-blue-600', options: ['Math', 'Science', 'History', 'Design', 'Code', 'Custom...'] },
  { name: 'walking', icon: Footprints, color: 'text-orange-400', options: ['In Nature', 'In the City', 'To Class', 'With Friends', 'Custom...'] },
  { name: 'working out', icon: Dumbbell, color: 'text-slate-700', options: ['At the Gym', 'Home Workout', 'Yoga', 'Cardio', 'Custom...'] },
];

export default function FeelingActivitySelector({ onSelect, onClose, initialSelection }: FeelingActivitySelectorProps) {
  const [activeTab, setActiveTab] = useState<'feeling' | 'activity' | 'tag'>('feeling');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [selections, setSelections] = useState({
    feeling: initialSelection?.feeling || null,
    activity: initialSelection?.activity || null,
    subOption: initialSelection?.subOption || null,
    taggedUsers: initialSelection?.taggedUsers || [] as TaggedUser[]
  });

  const [view, setView] = useState<'main' | 'suboptions' | 'custom'>('main');
  const [currentOptions, setCurrentOptions] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');
  
  const [friends, setFriends] = useState<TaggedUser[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  useEffect(() => {
    if (activeTab === 'tag') {
      fetchFriends();
    }
  }, [activeTab]);

  const fetchFriends = async () => {
    setLoadingFriends(true);
    try {
      const { data } = await api.get('/users/following'); 
      setFriends(data || []);
    } catch (err) {
      console.error('Failed to fetch following:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleActivityClick = (item: SelectionItem) => {
    if (item.options) {
      setSelections(prev => ({ ...prev, activity: item }));
      setCurrentOptions(item.options);
      setView('suboptions');
    } else {
      setSelections(prev => ({ 
        ...prev, 
        activity: prev.activity?.name === item.name ? null : item,
        subOption: null 
      }));
    }
  };

  const handleSubOptionClick = (option: string) => {
    if (option === 'Custom...') {
      setView('custom');
    } else {
      setSelections(prev => ({ ...prev, subOption: option }));
      setView('main');
    }
  };

  const handleCustomSubmit = () => {
    if (customInput.trim()) {
      setSelections(prev => ({ ...prev, subOption: customInput.trim() }));
      setView('main');
      setCustomInput('');
    }
  };

  const toggleUserTag = (user: TaggedUser) => {
    setSelections(prev => {
      const isTagged = prev.taggedUsers.find(u => u.user_id === user.user_id);
      if (isTagged) {
        return { ...prev, taggedUsers: prev.taggedUsers.filter(u => u.user_id !== user.user_id) };
      } else {
        return { ...prev, taggedUsers: [...prev.taggedUsers, user] };
      }
    });
  };

  const filteredList = (activeTab === 'feeling' ? FEELINGS : ACTIVITIES).filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredFriends = friends.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (view === 'suboptions') {
    return (
      <div className="absolute inset-0 z-[110] bg-white flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center px-4 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => setView('main')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft size={22} className="text-gray-900" strokeWidth={2.5} />
          </button>
          <h2 className="flex-1 text-center text-lg font-black text-gray-900 uppercase italic tracking-tight pr-10">
            {selections.activity?.name}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {currentOptions.map(opt => (
            <button
              key={opt}
              onClick={() => handleSubOptionClick(opt)}
              className="w-full flex items-center justify-between p-4 bg-white border border-gray-100 rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
            >
              <span className="text-[15px] font-black italic text-gray-700">{opt}</span>
              <ChevronRight size={18} className="text-gray-300 group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (view === 'custom') {
    return (
      <div className="absolute inset-0 z-[120] bg-white flex flex-col animate-in slide-in-from-right duration-300">
        <div className="flex items-center px-4 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <button onClick={() => setView('suboptions')} className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft size={22} className="text-gray-900" strokeWidth={2.5} />
          </button>
          <h2 className="flex-1 text-center text-lg font-black text-gray-900 uppercase italic tracking-tight pr-10">
            What are you {selections.activity?.name}?
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <input 
            type="text" 
            autoFocus
            placeholder="Type here..."
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleCustomSubmit()}
            className="w-full text-center text-2xl font-black italic border-none focus:ring-0 placeholder:text-gray-200"
          />
          <button 
            onClick={handleCustomSubmit}
            disabled={!customInput.trim()}
            className="w-full py-4 bg-primary text-white rounded-lg font-black text-lg tracking-widest shadow-xl shadow-primary/30 disabled:bg-gray-100 disabled:shadow-none transition-all"
          >
            CONFIRM
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center px-4 py-4 border-b border-gray-100 bg-white sticky top-0 z-10">
        <button 
          onClick={onClose}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={22} className="text-gray-900" strokeWidth={2.5} />
        </button>
        <h2 className="flex-1 text-center text-lg font-black text-gray-900 uppercase italic tracking-tight">
          Feeling & Activity
        </h2>
        <button 
          onClick={() => onSelect(selections)}
          className="px-5 py-2.5 bg-primary text-white rounded-lg font-black text-xs uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
        >
          Done
        </button>
      </div>

      {/* Selected Preview */}
      {(selections.feeling || selections.activity || selections.taggedUsers.length > 0) && (
        <div className="px-4 pt-4 flex flex-wrap gap-2">
          {selections.feeling && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-50 text-yellow-700 rounded-full border border-yellow-100 text-[12px] font-black uppercase tracking-tighter">
              <selections.feeling.icon size={14} />
              <span>{selections.feeling.name}</span>
              <button onClick={() => setSelections(prev => ({ ...prev, feeling: null }))} className="ml-0.5"><X size={12} /></button>
            </div>
          )}
          {selections.activity && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full border border-blue-100 text-[12px] font-black uppercase tracking-tighter">
              <selections.activity.icon size={14} />
              <span>{selections.activity.name}{selections.subOption ? `: ${selections.subOption}` : ''}</span>
              <button onClick={() => setSelections(prev => ({ ...prev, activity: null, subOption: null }))} className="ml-0.5"><X size={12} /></button>
            </div>
          )}
          {selections.taggedUsers.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-700 rounded-full border border-pink-100 text-[12px] font-black uppercase tracking-tighter">
              <Users size={14} />
              <span>{selections.taggedUsers.length} tagged</span>
              <button onClick={() => setSelections(prev => ({ ...prev, taggedUsers: [] }))} className="ml-0.5"><X size={12} /></button>
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex px-4 pt-4 gap-2">
        {[
          { id: 'feeling', label: 'Feeling', icon: Smile },
          { id: 'activity', label: 'Activity', icon: Sparkles },
          { id: 'tag', label: 'Tag Friends', icon: UserPlus },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); setSearchQuery(''); }}
            className={`flex-1 py-3 rounded-lg font-black text-[11px] uppercase tracking-widest transition-all flex flex-col items-center justify-center gap-1.5 ${
              activeTab === tab.id 
                ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="p-4">
        <div className="relative">
          <input 
            type="text" 
            placeholder={activeTab === 'tag' ? "Search friends..." : `Search for a ${activeTab}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border-none rounded-lg py-3 px-6 text-[14px] font-bold text-center focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
      </div>

      {/* List Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-12 pt-1">
        {activeTab === 'tag' ? (
          loadingFriends ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="animate-spin text-primary" size={32} />
              <p className="text-gray-400 font-bold uppercase text-[10px] tracking-widest">Loading followers...</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {filteredFriends.map(user => {
                const isTagged = selections.taggedUsers.find(u => u.user_id === user.user_id);
                return (
                  <button
                    key={user.user_id}
                    onClick={() => toggleUserTag(user)}
                    className={`flex flex-col items-center p-4 bg-white border rounded-lg transition-all relative group ${
                      isTagged ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-gray-100 hover:border-primary/40'
                    }`}
                  >
                    <div className="relative">
                      <img 
                        src={getAvatarUrl(user.avatar_url, user.username)} 
                        className="w-14 h-14 rounded-full object-cover border-2 border-white shadow-md" 
                        alt="" 
                      />
                      {isTagged && (
                        <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white shadow-md animate-in zoom-in duration-200">
                          <Check size={12} strokeWidth={4} />
                        </div>
                      )}
                    </div>
                    <p className={`mt-3 text-[13px] font-black italic truncate w-full text-center ${isTagged ? 'text-primary' : 'text-gray-900'}`}>
                      {user.name || user.username}
                    </p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">@{user.username}</p>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {filteredList.map((item) => {
              const active = selections[activeTab]?.name === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => activeTab === 'activity' ? handleActivityClick(item) : setSelections(prev => ({ ...prev, feeling: active ? null : item }))}
                  className={`flex flex-col items-center justify-center p-4 aspect-square bg-white border rounded-lg transition-all group relative ${
                    active ? 'border-primary ring-1 ring-primary bg-primary/5' : 'border-gray-100 hover:border-primary/40'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center transition-transform group-hover:scale-110 mb-2 ${item.color}`}>
                    <item.icon size={22} strokeWidth={2.5} />
                  </div>
                  <span className={`text-[11px] font-black italic capitalize text-center leading-tight ${active ? 'text-primary' : 'text-gray-600'}`}>
                    {item.name}
                  </span>
                  
                  {active && activeTab === 'activity' && selections.subOption && (
                    <span className="text-[9px] font-black text-primary italic uppercase tracking-tighter mt-1 truncate w-full text-center">
                      {selections.subOption}
                    </span>
                  )}

                  {active && !item.options && (
                    <div className="absolute top-2 right-2 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-white shadow-sm animate-in zoom-in duration-200">
                      <Check size={10} strokeWidth={4} />
                    </div>
                  )}
                  
                  {item.options && (
                    <div className="absolute top-2 right-2">
                      <ChevronRight size={14} className="text-gray-300" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
        {((activeTab === 'tag' && filteredFriends.length === 0) || (activeTab !== 'tag' && filteredList.length === 0)) && (
          <div className="py-20 text-center">
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">No results found</p>
          </div>
        )}
      </div>
    </div>
  );
}
