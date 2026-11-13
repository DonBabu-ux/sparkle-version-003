import React from 'react';
import { useNavigate } from 'react-router-dom';
import { getAvatarUrl } from '../utils/imageUtils';
import { useLiveStore } from '../store/liveStore';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'nav' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'xxl';
  className?: string;
  userId?: string | null;
  isLive?: boolean;
  streamId?: string | null;
  showLiveBadge?: boolean;
}

const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  className = '',
  userId,
  isLive: explicitLive,
  streamId: explicitStreamId,
  showLiveBadge = true
}) => {
  const [error, setError] = React.useState(false);
  const navigate = useNavigate();

  const isUserLive = useLiveStore(state => state.isUserLive);
  const getStreamForUser = useLiveStore(state => state.getStreamForUser);

  const liveStream = userId ? getStreamForUser(userId) : null;
  const isBroadcasting = explicitLive !== undefined ? explicitLive : Boolean(liveStream || (userId && isUserLive(userId)));
  const resolvedStreamId = explicitStreamId || liveStream?.stream_id;

  // Reset the sticky error flag whenever src changes
  React.useEffect(() => {
    setError(false);
  }, [src]);

  const SIZE_PX: Record<NonNullable<AvatarProps['size']>, number> = {
    xs: 24, nav: 28, sm: 32, md: 40, lg: 48, xl: 64, '2xl': 96, xxl: 128,
  };

  const sizeClasses = {
    'xs': 'w-6 h-6 text-[10px]',
    'nav': 'w-7 h-7 text-[11px]',
    'sm': 'w-8 h-8 text-xs',
    'md': 'w-10 h-10 text-sm',
    'lg': 'w-12 h-12 text-base',
    'xl': 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-3xl',
    'xxl': 'w-32 h-32 md:w-44 md:h-44 text-5xl md:text-7xl',
  };

  const colors = [
    'bg-blue-500',
    'bg-red-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-indigo-500',
    'bg-rose-500',
    'bg-purple-500',
    'bg-cyan-500',
    'bg-orange-500',
  ];

  const getColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const getInitials = (str: string) => {
    return str.charAt(0).toUpperCase();
  };

  const handleLiveClick = (e: React.MouseEvent) => {
    if (isBroadcasting) {
      e.stopPropagation();
      e.preventDefault();
      if (resolvedStreamId) {
        navigate(`/streams?streamId=${resolvedStreamId}`);
      } else {
        navigate('/streams');
      }
    }
  };

  const liveRingClass = isBroadcasting
    ? 'ring-2 ring-[#ff1493] ring-offset-2 ring-offset-white dark:ring-offset-zinc-900 shadow-[0_0_10px_rgba(255,20,147,0.4)] cursor-pointer'
    : '';

  const avatarUrl = getAvatarUrl(src);

  const innerAvatar = !error ? (
    <img 
      src={avatarUrl} 
      alt={name || 'User'} 
      width={SIZE_PX[size]}
      height={SIZE_PX[size]}
      className={`${sizeClasses[size]} rounded-full object-cover shrink-0 ${liveRingClass} ${className}`}
      onError={() => setError(true)}
    />
  ) : (
    <div className={`${sizeClasses[size]} ${getColor(name || 'User')} rounded-full flex items-center justify-center text-white font-black shrink-0 shadow-sm border border-white/10 ${liveRingClass} ${className}`}>
      {getInitials(name || 'User')}
    </div>
  );

  if (isBroadcasting && showLiveBadge) {
    return (
      <div
        className="relative inline-flex shrink-0 items-center justify-center cursor-pointer group"
        onClick={handleLiveClick}
        title={`${name || 'User'} is LIVE now!`}
      >
        {innerAvatar}
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-[#ff1493] text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest shadow-md flex items-center gap-0.5 border border-white dark:border-zinc-900 pointer-events-none animate-pulse">
          LIVE
        </span>
      </div>
    );
  }

  return innerAvatar;
};

export default Avatar;
