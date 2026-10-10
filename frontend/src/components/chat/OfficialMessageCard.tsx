import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, 
  Wrench, 
  Sparkles, 
  Heart, 
  Megaphone, 
  Lightbulb, 
  Gift, 
  AlertTriangle,
  ArrowRight,
  ExternalLink
} from 'lucide-react';

export type SystemMessageCategory = 
  | 'security' 
  | 'maintenance' 
  | 'feature' 
  | 'welcome' 
  | 'announcement' 
  | 'tips' 
  | 'promotion' 
  | 'warning';

export interface OfficialMessageCardProps {
  category?: SystemMessageCategory;
  title?: string;
  body: string;
  sentAt?: string;
  payload?: {
    title?: string;
    description?: string;
    buttonText?: string;
    buttonRoute?: string;
    badge?: string;
    icon?: string;
    accentColor?: string;
    actions?: Array<{ label: string; route: string; style?: 'primary' | 'secondary' | 'ghost' }>;
  } | null;
}

const CATEGORY_CONFIG: Record<SystemMessageCategory, {
  icon: React.ElementType;
  badge: string;
  borderClass: string;
  badgeClass: string;
  iconBgClass: string;
}> = {
  security: {
    icon: ShieldCheck,
    badge: 'Security Alert',
    borderClass: 'border-pink-500/40 bg-gradient-to-br from-pink-950/30 via-slate-900 to-slate-950',
    badgeClass: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    iconBgClass: 'bg-pink-500/20 text-pink-400'
  },
  maintenance: {
    icon: Wrench,
    badge: 'System Maintenance',
    borderClass: 'border-slate-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950',
    badgeClass: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    iconBgClass: 'bg-slate-500/20 text-slate-300'
  },
  feature: {
    icon: Sparkles,
    badge: 'Feature Update',
    borderClass: 'border-purple-500/40 bg-gradient-to-br from-purple-950/30 via-slate-900 to-slate-950',
    badgeClass: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    iconBgClass: 'bg-purple-500/20 text-purple-400'
  },
  welcome: {
    icon: Heart,
    badge: 'Welcome to Sparkle',
    borderClass: 'border-rose-500/40 bg-gradient-to-br from-rose-950/30 via-purple-950/20 to-slate-950',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    iconBgClass: 'bg-rose-500/20 text-rose-400'
  },
  announcement: {
    icon: Megaphone,
    badge: 'Official Announcement',
    borderClass: 'border-sky-500/40 bg-gradient-to-br from-sky-950/30 via-slate-900 to-slate-950',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    iconBgClass: 'bg-sky-500/20 text-sky-400'
  },
  tips: {
    icon: Lightbulb,
    badge: 'Sparkle Tip',
    borderClass: 'border-amber-500/40 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    iconBgClass: 'bg-amber-500/20 text-amber-400'
  },
  promotion: {
    icon: Gift,
    badge: 'Special Offer',
    borderClass: 'border-emerald-500/40 bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-950',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    iconBgClass: 'bg-emerald-500/20 text-emerald-400'
  },
  warning: {
    icon: AlertTriangle,
    badge: 'System Notice',
    borderClass: 'border-orange-500/40 bg-gradient-to-br from-orange-950/30 via-slate-900 to-slate-950',
    badgeClass: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    iconBgClass: 'bg-orange-500/20 text-orange-400'
  }
};

export const OfficialMessageCard: React.FC<OfficialMessageCardProps> = ({
  category = 'announcement',
  title,
  body,
  sentAt,
  payload
}) => {
  const navigate = useNavigate();
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.announcement;
  const CategoryIcon = config.icon;

  const cardTitle = payload?.title || title || config.badge;
  const actions = payload?.actions || [];
  const singleRoute = payload?.buttonRoute;
  const singleButtonText = payload?.buttonText;

  // Poll state
  const isPoll = actions.some(a => a.route?.includes('/vote-official-replies'));
  const [voted, setVoted] = React.useState<number | null>(null);
  const [pollVotes, setPollVotes] = React.useState([4530, 212]); // Mock real-time votes

  const handleAction = (route: string, index: number) => {
    if (isPoll) {
      setVoted(index);
      const newVotes = [...pollVotes];
      newVotes[index]++;
      setPollVotes(newVotes);
      return;
    }
    if (route) navigate(route);
  };

  const totalVotes = pollVotes.reduce((a, b) => a + b, 0);

  return (
    <div className={`my-3 max-w-xl md:max-w-2xl w-full rounded-3xl p-5 border-2 backdrop-blur-xl shadow-2xl transition-all duration-300 ${config.borderClass}`}>
      {/* Header Badge */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-xl flex items-center justify-center ${config.iconBgClass}`}>
            <CategoryIcon className="w-4.5 h-4.5" />
          </div>
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.badgeClass}`}>
            {payload?.badge || config.badge}
          </span>
        </div>
        {sentAt && (
          <span className="text-[10px] text-slate-400 font-mono">
            {new Date(sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* Title & Body */}
      {cardTitle && (
        <h4 className="font-bold text-sm text-slate-100 mb-1.5 leading-snug">
          {cardTitle}
        </h4>
      )}
      <p className="text-xs text-slate-300 leading-relaxed font-normal whitespace-pre-wrap">
        {body}
      </p>

      {/* Dynamic CTAs / Poll */}
      {(actions.length > 0 || (singleButtonText && singleRoute)) && (
        <div className="mt-3.5 pt-3 border-t border-slate-800/80 flex flex-col gap-2">
          {isPoll && voted !== null ? (
            <div className="flex flex-col gap-2 w-full mt-2">
              <span className="text-xs text-emerald-400 font-bold mb-1">✓ Your vote has been recorded! Live results:</span>
              {actions.map((act, idx) => {
                const percent = Math.round((pollVotes[idx] / totalVotes) * 100);
                return (
                  <div key={idx} className="relative w-full h-10 bg-slate-800/50 rounded-xl overflow-hidden flex items-center px-4 border border-slate-700/50">
                    <div 
                      className={`absolute top-0 left-0 h-full transition-all duration-700 ease-out ${idx === 0 ? 'bg-rose-600/40' : 'bg-slate-600/40'}`} 
                      style={{ width: `${percent}%` }}
                    />
                    <div className="relative z-10 flex justify-between w-full text-xs font-semibold">
                      <span className="text-white">{act.label} {voted === idx && '(You)'}</span>
                      <span className="text-white">{percent}%</span>
                    </div>
                  </div>
                );
              })}
              <span className="text-[10px] text-slate-400 text-right mt-1">{totalVotes.toLocaleString()} total votes</span>
            </div>
          ) : actions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {actions.map((act, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAction(act.route, idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all duration-200 ${
                    act.style === 'primary'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-md shadow-rose-600/30'
                      : act.style === 'secondary'
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      : 'bg-transparent hover:bg-slate-800/50 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span>{act.label}</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              ))}
            </div>
          ) : (
            <div className="flex">
              <button
                onClick={() => singleRoute && navigate(singleRoute)}
                className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-600/30 transition-all duration-200"
              >
                <span>{singleButtonText}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
