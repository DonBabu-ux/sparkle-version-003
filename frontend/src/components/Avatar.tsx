import React from 'react';
import { getAvatarUrl } from '../utils/imageUtils';
import defaultAvatar from '../assets/avatar.png';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className = '' }) => {
  const [error, setError] = React.useState(false);

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

  // If we have a valid image and no error, render the image
  const avatarUrl = getAvatarUrl(src);
  const isDefault = avatarUrl === defaultAvatar || error;

  if (!isDefault && !error) {
    return (
      <img 
        src={avatarUrl} 
        alt={name || 'User'} 
        className={`${sizeClasses[size]} rounded-full object-cover shrink-0 ${className}`}
        onError={() => setError(true)}
      />
    );
  }

  // Fallback to Letter Avatar
  const displayName = name || 'User';
  const bgColor = getColor(displayName);
  const initial = getInitials(displayName);

  return (
    <div className={`${sizeClasses[size]} ${bgColor} rounded-full flex items-center justify-center text-white font-black shrink-0 shadow-sm border border-white/10 ${className}`}>
      {initial}
    </div>
  );
};

export default Avatar;
