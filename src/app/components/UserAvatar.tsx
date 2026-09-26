import React, { useState, useEffect } from 'react';
import { User, Building, GraduationCap, ShieldCheck } from 'lucide-react';
import { getPhotoUrl } from '../services/config';

export interface UserAvatarProps {
  photo?: string | null;
  name?: string;
  role?: 'admin' | 'instructor' | 'hte' | 'host' | 'employee' | 'trainee' | string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | number;
  className?: string;
  fallbackIcon?: React.ReactNode;
  alt?: string;
  onClick?: () => void;
}

const SIZE_MAP: Record<string, { container: string; text: string; iconSize: number }> = {
  xs: { container: 'w-6 h-6', text: 'text-[10px]', iconSize: 12 },
  sm: { container: 'w-8 h-8', text: 'text-xs', iconSize: 15 },
  md: { container: 'w-9 h-9', text: 'text-xs', iconSize: 17 },
  lg: { container: 'w-10 h-10', text: 'text-sm', iconSize: 20 },
  xl: { container: 'w-16 h-16', text: 'text-xl', iconSize: 28 },
  '2xl': { container: 'w-20 h-20', text: 'text-2xl', iconSize: 36 },
};

function getInitials(name?: string, role?: string): string {
  if (name && typeof name === 'string') {
    const clean = name.trim().replace(/^(mr\.|mrs\.|ms\.|dr\.|prof\.)\s+/i, '');
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const first = parts[0][0];
      const last = parts[parts.length - 1][0];
      return `${first}${last}`.toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase();
    }
  }

  // Role defaults
  const normRole = (role || '').toLowerCase();
  if (normRole === 'admin' || normRole === 'instructor') return 'AD';
  if (normRole === 'hte' || normRole === 'host') return 'HT';
  return 'ST';
}

export function UserAvatar({
  photo,
  name,
  role = 'employee',
  size = 'md',
  className = '',
  fallbackIcon,
  alt,
  onClick,
}: UserAvatarProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const photoUrl = getPhotoUrl(photo);

  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
  }, [photoUrl]);

  const sizeConfig = typeof size === 'number'
    ? { container: '', text: 'text-xs', iconSize: Math.max(12, Math.round(size * 0.45)) }
    : (SIZE_MAP[size] || SIZE_MAP.md);

  const customStyle = typeof size === 'number'
    ? { width: `${size}px`, height: `${size}px` }
    : undefined;

  const initials = getInitials(name, role);
  const normRole = (role || '').toLowerCase();
  const isInstructor = normRole === 'admin' || normRole === 'instructor';
  const isHte = normRole === 'hte' || normRole === 'host';

  const defaultFallbackBg = isInstructor
    ? 'bg-gradient-to-tr from-indigo-700 to-blue-600 text-white'
    : isHte
    ? 'bg-gradient-to-tr from-[#1E3A66] to-[#0E1D35] text-blue-100'
    : 'bg-gradient-to-tr from-blue-700 to-indigo-800 text-white';

  const renderDefaultIcon = () => {
    if (fallbackIcon) return fallbackIcon;
    if (isInstructor) return <GraduationCap size={sizeConfig.iconSize} className="text-white drop-shadow-sm" />;
    if (isHte) return <Building size={sizeConfig.iconSize} className="text-blue-200 drop-shadow-sm" />;
    return <User size={sizeConfig.iconSize} className="text-white drop-shadow-sm" />;
  };

  const showImage = Boolean(photoUrl && !hasError);

  return (
    <div
      onClick={onClick}
      style={customStyle}
      className={`relative select-none shrink-0 overflow-hidden rounded-full flex items-center justify-center font-bold tracking-tight shadow-inner ${
        sizeConfig.container
      } ${defaultFallbackBg} ${className}`}
    >
      {/* Fallback representation (initials or icon) */}
      <span className={`${sizeConfig.text} font-bold leading-none`}>
        {initials || renderDefaultIcon()}
      </span>

      {/* Profile Image with graceful fallback and no-referrer policy */}
      {showImage && (
        <img
          src={photoUrl}
          alt={alt || name || 'Profile Avatar'}
          referrerPolicy="no-referrer"
          crossOrigin="anonymous"
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-200 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
}

export default UserAvatar;
