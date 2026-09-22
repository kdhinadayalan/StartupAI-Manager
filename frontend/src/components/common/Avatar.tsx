import React, { useState } from 'react';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showStatus?: boolean;
  status?: 'online' | 'busy' | 'offline';
}

const GRADIENTS = [
  'from-indigo-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-600',
  'from-rose-500 to-pink-600',
  'from-amber-500 to-orange-600',
  'from-violet-600 to-indigo-700',
];

function getGradient(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

function getInitials(name: string): string {
  if (!name || !name.trim()) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_MAP = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm font-semibold',
  lg: 'w-12 h-12 text-base font-semibold',
  xl: 'w-16 h-16 text-xl font-bold',
};

const STATUS_SIZE_MAP = {
  xs: 'w-1.5 h-1.5 bottom-0 right-0',
  sm: 'w-2 h-2 bottom-0 right-0',
  md: 'w-2.5 h-2.5 bottom-0.5 right-0.5',
  lg: 'w-3 h-3 bottom-0.5 right-0.5',
  xl: 'w-4 h-4 bottom-1 right-1',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '',
  size = 'md',
  className = '',
  showStatus = false,
  status = 'online',
}) => {
  const [imageError, setImageError] = useState(false);
  const sizeClass = SIZE_MAP[size];
  const gradient = getGradient(name || 'User');
  const initials = getInitials(name || 'User');

  const statusColors = {
    online: 'bg-emerald-500 ring-white dark:ring-slate-900',
    busy: 'bg-amber-500 ring-white dark:ring-slate-900',
    offline: 'bg-slate-400 ring-white dark:ring-slate-900',
  };

  return (
    <div className={`relative inline-flex flex-shrink-0 items-center justify-center rounded-full select-none ${className}`}>
      {src && !imageError ? (
        <img
          src={src}
          alt={name}
          onError={() => setImageError(true)}
          className={`${sizeClass} rounded-full object-cover ring-2 ring-white/80 dark:ring-slate-800 shadow-sm`}
        />
      ) : (
        <div
          className={`${sizeClass} rounded-full bg-gradient-to-tr ${gradient} text-white flex items-center justify-center shadow-sm ring-2 ring-white/80 dark:ring-slate-800 font-medium`}
          title={name}
        >
          {initials}
        </div>
      )}
      {showStatus && (
        <span
          className={`absolute rounded-full ring-2 ${STATUS_SIZE_MAP[size]} ${statusColors[status]}`}
        />
      )}
    </div>
  );
};
