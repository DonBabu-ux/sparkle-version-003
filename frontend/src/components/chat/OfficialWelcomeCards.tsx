import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Users, 
  Camera, 
  Music, 
  Flame, 
  ShieldCheck, 
  HelpCircle, 
  ArrowRight 
} from 'lucide-react';

interface CardItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  route: string;
  buttonLabel: string;
  accentColor: string;
  iconBg: string;
}

const CARDS: CardItem[] = [
  {
    id: 'connect',
    title: 'Connect with People',
    description: 'Find friends and grow your network across campus.',
    icon: Users,
    route: '/connect',
    buttonLabel: 'Open',
    accentColor: 'border-sky-500/30 hover:border-sky-500/60',
    iconBg: 'bg-sky-500/20 text-sky-400'
  },
  {
    id: 'story',
    title: 'Create your First Story',
    description: 'Share your moments and photos with your friends.',
    icon: Camera,
    route: '/stories',
    buttonLabel: 'Create',
    accentColor: 'border-rose-500/30 hover:border-rose-500/60',
    iconBg: 'bg-rose-500/20 text-rose-400'
  },
  {
    id: 'music',
    title: 'Explore Music',
    description: 'Discover trending campus tracks and audio clips.',
    icon: Music,
    route: '/explore',
    buttonLabel: 'Explore',
    accentColor: 'border-purple-500/30 hover:border-purple-500/60',
    iconBg: 'bg-purple-500/20 text-purple-400'
  },
  {
    id: 'moments',
    title: 'Trending Moments',
    description: 'See what is happening now in your campus hubs.',
    icon: Flame,
    route: '/moments',
    buttonLabel: 'Open',
    accentColor: 'border-amber-500/30 hover:border-amber-500/60',
    iconBg: 'bg-amber-500/20 text-amber-400'
  },
  {
    id: 'privacy',
    title: 'Privacy & Safety',
    description: 'Review your account visibility and security settings.',
    icon: ShieldCheck,
    route: '/settings?tab=privacy',
    buttonLabel: 'Open',
    accentColor: 'border-emerald-500/30 hover:border-emerald-500/60',
    iconBg: 'bg-emerald-500/20 text-emerald-400'
  },
  {
    id: 'help',
    title: 'Help Centre',
    description: 'Get answers to questions and platform guides.',
    icon: HelpCircle,
    route: '/help',
    buttonLabel: 'Visit',
    accentColor: 'border-indigo-500/30 hover:border-indigo-500/60',
    iconBg: 'bg-indigo-500/20 text-indigo-400'
  }
];

export const OfficialWelcomeCards: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="mx-4 my-4 space-y-3">
      {/* Welcome Hero Message */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-rose-950/40 via-slate-900 to-slate-950 border border-rose-500/30 backdrop-blur-xl shadow-xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">💖</span>
          <h3 className="font-extrabold text-base text-white tracking-tight">Welcome to Sparkle</h3>
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-normal">
          We're excited to have you here! Sparkle helps you connect with friends, discover communities, share stories, and express yourself in new ways.
        </p>
        <p className="text-xs text-rose-300 font-semibold mt-2">
          Explore everything Sparkle has to offer below:
        </p>
      </div>

      {/* Interactive Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {CARDS.map((card) => {
          const CardIcon = card.icon;
          return (
            <div
              key={card.id}
              onClick={() => navigate(card.route)}
              className={`p-3.5 rounded-2xl bg-slate-900/70 border backdrop-blur-md flex items-center justify-between gap-3 cursor-pointer transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] ${card.accentColor}`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`p-2.5 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                  <CardIcon className="w-4.5 h-4.5" />
                </div>
                <div className="min-w-0">
                  <h4 className="font-bold text-xs text-white truncate">{card.title}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{card.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-semibold text-rose-400 shrink-0">
                <span>{card.buttonLabel}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
