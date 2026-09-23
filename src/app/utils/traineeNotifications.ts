export interface TraineeOjtNotification {
  id: string;
  type: 'shift_near_end' | 'shift_start_soon' | 'shift_overtime' | 'shift_in_progress' | 'hours_milestone' | 'hours_completed';
  title: string;
  message: string;
  urgency: 'high' | 'medium' | 'low' | 'success';
  timeLabel: string;
  timestamp: string;
  actionText?: string;
  actionRoute?: string;
  isDismissable?: boolean;
}

/**
 * Computes dynamic, real-time OJT hours notifications for trainees:
 * - Proximity to end of daily shift (e.g. 4:00 PM – 5:00 PM, like 4:20 PM)
 * - Morning shift start reminder (7:00 AM – 8:30 AM)
 * - Overtime / unrecorded clock-out alert (past 5:00 PM)
 * - Nearing total required OJT hours completion milestones (>= 85% or <= 40h left)
 */
export function computeTraineeOjtNotifications(
  employee: any,
  todayRecord: any,
  totalHoursRendered: number,
  now: Date = new Date()
): TraineeOjtNotification[] {
  const notifications: TraineeOjtNotification[] = [];
  if (!employee) return notifications;

  const currentH = now.getHours();
  const currentM = now.getMinutes();
  const currentTimeMinutes = currentH * 60 + currentM;

  const shiftStartMinutes = 8 * 60;       // 8:00 AM
  const shiftEndMinutes = 17 * 60;        // 5:00 PM (17:00)
  const shiftEarlyWindow = 7 * 60;        // 7:00 AM
  const shiftNearEndMinutes = 16 * 60;    // 4:00 PM (16:00)

  const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const dateStr = now.toISOString().split('T')[0];
  const requiredHours = Number(employee.requiredHours) || 486;
  const remainingHours = Math.max(0, requiredHours - totalHoursRendered);
  const progressPct = requiredHours > 0 ? Math.min(100, Math.round((totalHoursRendered / requiredHours) * 100)) : 0;

  // 1. DAILY SHIFT PROXIMITY NOTIFICATIONS
  // A. Nearing End of Daily OJT Hours (4:00 PM – 5:00 PM, e.g. 4:20 PM)
  if (currentTimeMinutes >= shiftNearEndMinutes && currentTimeMinutes < shiftEndMinutes) {
    const minsLeft = shiftEndMinutes - currentTimeMinutes;
    if (todayRecord?.timeIn && !todayRecord?.timeOut) {
      notifications.push({
        id: `shift-near-end-${dateStr}`,
        type: 'shift_near_end',
        title: '⏰ Nearing End of Daily OJT Hours',
        message: `It is currently ${timeStr} — you are nearing the end of today's OJT shift (5:00 PM, ~${minsLeft} mins left). Please review your daily accomplishments and remember to Clock Out on your DTR with facial & GPS verification before leaving.`,
        urgency: 'high',
        timeLabel: timeStr,
        timestamp: now.toISOString(),
        actionText: 'Clock Out Now',
        actionRoute: '/app/time-record',
        isDismissable: false,
      });
    } else if (!todayRecord?.timeIn) {
      notifications.push({
        id: `shift-ending-no-in-${dateStr}`,
        type: 'shift_near_end',
        title: '⚠️ OJT Shift Closing Soon (No Clock-In)',
        message: `It is currently ${timeStr}. Today's standard OJT shift ends at 5:00 PM (~${minsLeft} mins remaining). If you were on duty, please record your attendance before the shift window closes.`,
        urgency: 'high',
        timeLabel: timeStr,
        timestamp: now.toISOString(),
        actionText: 'Open DTR',
        actionRoute: '/app/time-record',
        isDismissable: true,
      });
    }
  }

  // B. Overtime / Shift Concluded Alert (Past 5:00 PM and still clocked in)
  if (currentTimeMinutes >= shiftEndMinutes && todayRecord?.timeIn && !todayRecord?.timeOut) {
    notifications.push({
      id: `shift-overtime-${dateStr}`,
      type: 'shift_overtime',
      title: '🚨 Standard Shift Concluded (Pending Clock-Out)',
      message: `Today's regular OJT hours ended at 5:00 PM. You are currently still clocked in. Please complete your Time Out to finalize and record today's rendered hours.`,
      urgency: 'high',
      timeLabel: timeStr,
      timestamp: now.toISOString(),
      actionText: 'Submit Time Out',
      actionRoute: '/app/time-record',
      isDismissable: false,
    });
  }

  // C. Morning Shift Starting Soon (7:00 AM – 8:30 AM and not clocked in)
  if (currentTimeMinutes >= shiftEarlyWindow && currentTimeMinutes <= shiftStartMinutes + 30 && !todayRecord?.timeIn) {
    notifications.push({
      id: `shift-start-soon-${dateStr}`,
      type: 'shift_start_soon',
      title: '🌅 Morning OJT Shift Starting Soon',
      message: `Good morning! Your standard OJT hours begin at 8:00 AM. Arrive at ${employee.companyName || 'your assigned HTE workplace'} on time and record your biometric Time In.`,
      urgency: 'medium',
      timeLabel: timeStr,
      timestamp: now.toISOString(),
      actionText: 'Record Time In',
      actionRoute: '/app/time-record',
      isDismissable: true,
    });
  }

  // 2. TOTAL REQUIRED OJT HOURS PROGRESS NOTIFICATIONS
  // A. Nearing 100% Completion Milestone (>= 85% or remaining <= 40 hours)
  if (progressPct >= 85 && remainingHours > 0) {
    notifications.push({
      id: `milestone-nearing-completion`,
      type: 'hours_milestone',
      title: '🎯 Almost There! Nearing OJT Hours Completion',
      message: `Outstanding progress! You have rendered ${totalHoursRendered.toFixed(1)} of ${requiredHours} required hours (${progressPct}%). Only ${remainingHours.toFixed(1)} hours remaining to complete your OJT!`,
      urgency: 'success',
      timeLabel: `${remainingHours.toFixed(1)}h left`,
      timestamp: now.toISOString(),
      actionText: 'View Records',
      actionRoute: '/app/records',
      isDismissable: true,
    });
  } else if (remainingHours === 0 && totalHoursRendered > 0) {
    notifications.push({
      id: `milestone-completed`,
      type: 'hours_completed',
      title: '🎓 Congratulations! Required OJT Hours Completed',
      message: `You have successfully completed 100% of your required OJT hours (${totalHoursRendered.toFixed(1)} / ${requiredHours} hrs). Ensure your required evaluation and documentation are submitted for final clearance.`,
      urgency: 'success',
      timeLabel: '100% Done',
      timestamp: now.toISOString(),
      actionText: 'View Documents',
      actionRoute: '/app/documents',
      isDismissable: true,
    });
  }

  return notifications;
}
