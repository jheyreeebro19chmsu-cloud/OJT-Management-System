import React, { useState } from 'react';
import { Clock, RefreshCw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useApp } from '../store/AppContext';

interface TokenExpiryBadgeProps {
  theme?: 'dark' | 'light';
  className?: string;
  showRefreshButton?: boolean;
}

export function TokenExpiryBadge({
  theme = 'dark',
  className = '',
  showRefreshButton = true,
}: TokenExpiryBadgeProps) {
  const { tokenSecondsRemaining, refreshToken, currentUser } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  if (!currentUser) return null;

  const minutes = Math.floor(tokenSecondsRemaining / 60);
  const seconds = tokenSecondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const isUrgent = tokenSecondsRemaining <= 60; // 1 minute remaining
  const isWarning = tokenSecondsRemaining <= 120 && !isUrgent; // 2 minutes remaining

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRefreshing(true);
    refreshToken();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  if (theme === 'light') {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
          isUrgent
            ? 'bg-rose-50 text-rose-700 border-rose-300 ring-2 ring-rose-400/40 animate-pulse'
            : isWarning
            ? 'bg-amber-50 text-amber-700 border-amber-300 ring-1 ring-amber-400/30 animate-pulse'
            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200/70'
        } ${className}`}
        title={`Session Security Token: Automatically logs out when 10 minutes have passed. (${formattedTime} remaining)`}
      >
        {isUrgent ? (
          <AlertTriangle size={13} className="text-rose-600 shrink-0" />
        ) : (
          <Clock size={13} className={isWarning ? 'text-amber-600 shrink-0' : 'text-slate-500 shrink-0'} />
        )}
        <span className="font-mono font-bold tracking-tight text-[11px] sm:text-xs">
          Token: {formattedTime}
        </span>
        {showRefreshButton && (
          <button
            type="button"
            onClick={handleRefresh}
            className="p-0.5 rounded-full hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors ml-0.5 cursor-pointer"
            title="Extend session by 10 minutes"
          >
            <RefreshCw size={11} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
          </button>
        )}
      </div>
    );
  }

  // Dark header theme (for EmployeeLayout and HTELayout)
  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-all ${
        isUrgent
          ? 'bg-rose-500/20 text-rose-200 border-rose-400/50 ring-2 ring-rose-400/40 animate-pulse'
          : isWarning
          ? 'bg-amber-500/20 text-amber-200 border-amber-400/50 ring-1 ring-amber-400/30 animate-pulse'
          : 'bg-[#0E1D35]/70 text-blue-100 border-[#1E3A66] hover:bg-[#0E1D35]'
      } ${className}`}
      title={`Session Security Token: Automatically logs out when 10 minutes have passed. (${formattedTime} remaining)`}
    >
      {isUrgent ? (
        <AlertTriangle size={13} className="text-rose-400 shrink-0" />
      ) : (
        <Clock size={13} className={isWarning ? 'text-amber-400 shrink-0' : 'text-blue-300 shrink-0'} />
      )}
      <span className="font-mono font-bold tracking-tight text-[11px] sm:text-xs">
        Token: {formattedTime}
      </span>
      {showRefreshButton && (
        <button
          type="button"
          onClick={handleRefresh}
          className="p-0.5 rounded-full hover:bg-white/10 text-blue-300 hover:text-white transition-colors ml-0.5 cursor-pointer"
          title="Extend session by 10 minutes"
        >
          <RefreshCw size={11} className={isRefreshing ? 'animate-spin text-emerald-400' : ''} />
        </button>
      )}
    </div>
  );
}
