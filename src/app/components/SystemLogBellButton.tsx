import React, { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { SystemLogBellTray, type ExtraAlertItem } from './SystemLogBellTray';
import { getActivityLogs, onActivityLog } from '../services/activityLogService';

export interface SystemLogBellButtonProps {
  currentUserRole?: string;
  currentUserId?: string;
  theme?: 'dark' | 'light';
  extraNotifications?: ExtraAlertItem[];
  readExtraNotifIds?: string[];
  onMarkExtraNotifRead?: (id: string) => void;
  shiftSummary?: {
    schedule: string;
    statusText: string;
    statusVariant: 'completed' | 'clocked_in' | 'not_clocked_in';
  };
  className?: string;
}

export function SystemLogBellButton({
  currentUserRole = 'employee',
  currentUserId,
  theme = 'dark',
  extraNotifications = [],
  readExtraNotifIds = [],
  onMarkExtraNotifRead,
  shiftSummary,
  className = '',
}: SystemLogBellButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [lastViewedCount, setLastViewedCount] = useState<number>(() => {
    try {
      const v = localStorage.getItem('ojt_bell_last_viewed_count');
      return v ? parseInt(v, 10) : 0;
    } catch {
      return 0;
    }
  });
  const [totalLogsCount, setTotalLogsCount] = useState<number>(0);

  const updateCounts = () => {
    const logs = getActivityLogs();
    setTotalLogsCount(logs.length);
  };

  useEffect(() => {
    updateCounts();
    const unsub = onActivityLog(() => {
      updateCounts();
    });
    return unsub;
  }, []);

  const unreadAlertsCount = extraNotifications.filter(
    (n) => !readExtraNotifIds.includes(n.id)
  ).length;

  const unreadLogsCount = Math.max(0, totalLogsCount - lastViewedCount);
  const totalBadgeCount = unreadAlertsCount + (unreadLogsCount > 0 ? Math.min(unreadLogsCount, 9) : 0);

  const handleOpen = () => {
    setIsOpen(true);
    setLastViewedCount(totalLogsCount);
    try {
      localStorage.setItem('ojt_bell_last_viewed_count', String(totalLogsCount));
    } catch {}
  };

  const buttonStyle =
    theme === 'dark'
      ? 'text-blue-100 hover:text-white hover:bg-[#1E3A66]'
      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className={`relative p-2 rounded-xl transition-colors cursor-pointer ${buttonStyle} ${className}`}
        title="View Log History & Notifications"
        aria-label="View Log History"
      >
        <Bell size={20} />
        {totalBadgeCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-5 h-5 px-1 bg-amber-500 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center shadow-md animate-pulse border-2 border-white dark:border-[#152B4D]">
            {totalBadgeCount > 9 ? '9+' : totalBadgeCount}
          </span>
        )}
      </button>

      <SystemLogBellTray
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        currentUserRole={currentUserRole}
        currentUserId={currentUserId}
        extraNotifications={extraNotifications}
        readExtraNotifIds={readExtraNotifIds}
        onMarkExtraNotifRead={onMarkExtraNotifRead}
        shiftSummary={shiftSummary}
      />
    </>
  );
}
