import React from 'react';
import { OnboardingProgressCard } from './OnboardingProgressCard';
import { ShieldAlert, AlertTriangle, Info, ShieldCheck, HelpCircle } from 'lucide-react';
import { format } from 'date-fns';

interface OfficialMessage {
  message_id: string;
  sender_id: string;
  content: string;
  type?: string;
  sent_at?: string;
}

interface OfficialConversationRendererProps {
  messages: OfficialMessage[];
}

export const OfficialConversationRenderer: React.FC<OfficialConversationRendererProps> = ({ messages }) => {
  
  const renderCard = (msg: OfficialMessage) => {
    const text = msg.content;
    const isWelcome = text.includes('Welcome to Sparkle') || text.includes('guides') || text.includes('guide to everything');
    const isLoginAlert = text.includes('login detected') || text.includes('accessed from');
    const isPasswordChanged = text.includes('Password changed');
    const isVerification = text.includes('verified') || text.includes('verified ✓');
    const isMaintenance = text.includes('maintenance') || text.includes('🔧');

    const formattedTime = () => {
      if (!msg.sent_at) return '';
      try {
        return format(new Date(msg.sent_at), 'h:mm a');
      } catch (e) {
        return '';
      }
    };

    // 1. Welcome / Onboarding Card
    if (isWelcome) {
      return (
        <div key={msg.message_id} className="flex flex-col gap-3 items-center w-full py-4 select-none">
          <div className="w-full flex justify-center max-w-sm sm:max-w-md">
            <OnboardingProgressCard />
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
            {formattedTime()}
          </span>
        </div>
      );
    }

    // 2. Security Alerts / Login Alert Card
    if (isLoginAlert || isPasswordChanged) {
      return (
        <div key={msg.message_id} className="flex flex-col items-center w-full py-4 select-none">
          <div className="p-5 rounded-2xl bg-red-50/60 dark:bg-red-950/10 border border-red-200/80 dark:border-red-900/30 shadow-sm max-w-sm sm:max-w-md w-full flex gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center flex-shrink-0 animate-pulse-subtle">
              <ShieldAlert size={20} />
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <h4 role="heading" aria-level={4} className="font-bold text-red-800 dark:text-red-400 text-sm">
                Security Alert
              </h4>
              <p className="text-xs text-red-700/95 dark:text-red-300/90 leading-relaxed break-words">
                {text}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5">
            {formattedTime()}
          </span>
        </div>
      );
    }

    // 3. Verification Card
    if (isVerification) {
      return (
        <div key={msg.message_id} className="flex flex-col items-center w-full py-4 select-none">
          <div className="p-5 rounded-2xl bg-green-50/60 dark:bg-green-950/10 border border-green-200/80 dark:border-green-900/30 shadow-sm max-w-sm sm:max-w-md w-full flex gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <h4 role="heading" aria-level={4} className="font-bold text-green-800 dark:text-green-400 text-sm">
                System Verification
              </h4>
              <p className="text-xs text-green-750 dark:text-green-300 leading-relaxed break-words">
                {text}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5">
            {formattedTime()}
          </span>
        </div>
      );
    }

    // 4. Maintenance notice / general warnings
    if (isMaintenance) {
      return (
        <div key={msg.message_id} className="flex flex-col items-center w-full py-4 select-none">
          <div className="p-5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/10 border border-amber-200/80 dark:border-amber-900/30 shadow-sm max-w-sm sm:max-w-md w-full flex gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="flex-1 flex flex-col gap-1 min-w-0">
              <h4 role="heading" aria-level={4} className="font-bold text-amber-800 dark:text-amber-400 text-sm">
                Maintenance Notice
              </h4>
              <p className="text-xs text-amber-750 dark:text-amber-300 leading-relaxed break-words">
                {text}
              </p>
            </div>
          </div>
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5">
            {formattedTime()}
          </span>
        </div>
      );
    }

    // 5. Default Informational Fallback Card
    return (
      <div key={msg.message_id} className="flex flex-col items-center w-full py-4 select-none">
        <div className="p-5 rounded-2xl bg-zinc-50/60 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 shadow-sm max-w-sm sm:max-w-md w-full flex gap-3">
          <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center flex-shrink-0">
            <Info size={20} />
          </div>
          <div className="flex-1 flex flex-col gap-1 min-w-0">
            <h4 role="heading" aria-level={4} className="font-bold text-zinc-800 dark:text-zinc-300 text-sm">
              Official Update
            </h4>
            <p className="text-xs text-zinc-650 dark:text-zinc-400 leading-relaxed break-words">
              {text}
            </p>
          </div>
        </div>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1.5">
          {formattedTime()}
        </span>
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col gap-2 p-4 w-full max-w-3xl mx-auto h-full overflow-y-auto scrollbar-none"
      role="region" 
      aria-label="Official platform announcement feed"
    >
      <div className="text-center my-6 flex flex-col items-center select-none">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-pink-500 to-purple-600 text-white flex items-center justify-center shadow-lg shadow-pink-500/20 mb-3 animate-pulse-subtle">
          <span className="font-black text-lg">S</span>
        </div>
        <h2 role="heading" aria-level={2} className="text-base font-black text-zinc-800 dark:text-white mb-1">
          Sparkle Official
        </h2>
        <p className="text-[11px] text-zinc-400 dark:text-zinc-500 max-w-xs">
          Verify security alerts, track account achievements, and explore official features.
        </p>
      </div>

      {messages.map(renderCard)}
    </div>
  );
};
