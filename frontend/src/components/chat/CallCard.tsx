import React from 'react';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, PhoneOff } from 'lucide-react';
import clsx from 'clsx';

export type CallOutcome = 'completed' | 'missed' | 'declined' | 'cancelled' | 'failed';

export interface CallCardProps {
  id?: string;
  mode: 'voice' | 'video';
  outcome: CallOutcome;
  durationSeconds?: number;
  direction: 'incoming' | 'outgoing';
  timestamp?: string | number | Date;
  partnerId: string;
  partnerName?: string;
  partnerAvatar?: string | null;
  isMine: boolean;
  onCallback: (mode: 'voice' | 'video', partnerId: string, partnerName?: string, partnerAvatar?: string | null) => void;
  className?: string;
}

export const CallCard: React.FC<CallCardProps> = ({
  id,
  mode,
  outcome,
  durationSeconds = 0,
  direction,
  timestamp,
  partnerId,
  partnerName,
  partnerAvatar,
  isMine,
  onCallback,
  className,
}) => {
  const isVideo = mode === 'video';
  const isMissed = outcome === 'missed';
  const isDeclined = outcome === 'declined';
  const isCancelled = outcome === 'cancelled';
  const isFailed = outcome === 'failed';

  const formatDuration = (sec: number) => {
    if (!sec || sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const formatTime = (ts?: string | number | Date) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getTitle = () => {
    if (isMissed) return isVideo ? 'Missed video call' : 'Missed voice call';
    if (isDeclined) return isVideo ? 'Declined video call' : 'Declined voice call';
    if (isCancelled) return isVideo ? 'Cancelled video call' : 'Cancelled voice call';
    if (isFailed) return isVideo ? 'Failed video call' : 'Failed voice call';
    return isVideo ? 'Video call' : 'Voice call';
  };

  const getSubtext = () => {
    if (isMissed) return 'Tap to call back';
    if (isDeclined) return 'Call declined';
    if (isCancelled) return isMine ? 'Cancelled by you' : 'Cancelled';
    if (isFailed) return 'Call could not connect';

    const dirText = direction === 'outgoing' ? 'Outgoing' : 'Incoming';
    const durText = formatDuration(durationSeconds);
    return `${dirText} · ${durText}`;
  };

  const renderIcon = () => {
    if (isVideo) {
      if (isMissed || isFailed) return <Video size={16} className="text-red-400" />;
      if (isDeclined) return <Video size={16} className="text-orange-400" />;
      if (isCancelled) return <Video size={16} className="text-zinc-400" />;
      return <Video size={16} className="text-emerald-400" />;
    }

    if (isMissed) return <PhoneMissed size={16} className="text-red-400" />;
    if (isDeclined) return <PhoneOff size={16} className="text-orange-400" />;
    if (isCancelled) return <PhoneOff size={16} className="text-zinc-400" />;
    if (isFailed) return <PhoneMissed size={16} className="text-red-400" />;

    return direction === 'outgoing' ? (
      <PhoneOutgoing size={16} className="text-emerald-400" />
    ) : (
      <PhoneIncoming size={16} className="text-emerald-400" />
    );
  };

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    onCallback(mode, partnerId, partnerName, partnerAvatar);
  };

  return (
    <div
      key={id}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          handleClick(event);
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`${getTitle()}. Call back ${partnerName || 'contact'}`}
      title={`Tap to call back ${partnerName || ''}`}
      className={clsx(
        'group relative flex items-center justify-between gap-3 p-3 rounded-2xl max-w-[280px] w-fit shadow-md transition-all select-none cursor-pointer border active:scale-98',
        isMine ? 'ml-auto' : 'mr-auto',
        isMissed
          ? 'bg-red-500/10 border-red-500/25 hover:border-red-500/50 hover:bg-red-500/15'
          : isDeclined
          ? 'bg-orange-500/10 border-orange-500/20 hover:border-orange-500/40'
          : isMine
          ? 'bg-[#ff1493]/10 border-[#ff1493]/20 hover:border-[#ff1493]/40'
          : 'bg-white/[0.06] border-white/10 hover:border-white/20',
        className
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={clsx(
            'w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-inner',
            isMissed
              ? 'bg-red-500/20'
              : isDeclined
              ? 'bg-orange-500/20'
              : isCancelled
              ? 'bg-zinc-500/20'
              : 'bg-emerald-500/20'
          )}
        >
          {renderIcon()}
        </div>

        <div className="flex flex-col min-w-0 text-left">
          <span
            className={clsx(
              'text-xs font-bold truncate leading-tight',
              isMissed ? 'text-red-400' : isDeclined ? 'text-orange-400' : isCancelled ? 'text-zinc-300' : 'text-white'
            )}
          >
            {getTitle()}
          </span>

          <span
            className={clsx(
              'text-[11px] leading-tight mt-0.5',
              isMissed
                ? 'text-red-400/90 font-semibold underline decoration-red-400/50 group-hover:decoration-red-400'
                : 'text-white/60 font-medium'
            )}
          >
            {getSubtext()}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-end shrink-0 self-end pl-1">
        {timestamp && (
          <span className="text-[10px] text-white/40 font-mono tracking-tight">
            {formatTime(timestamp)}
          </span>
        )}
      </div>
    </div>
  );
};
