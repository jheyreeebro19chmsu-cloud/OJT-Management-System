import { Announcement } from '../types';

/**
 * Extracts a numeric timestamp (epoch milliseconds) from an announcement.
 * Handles ISO strings, localized dates, invalid dates, and fallbacks to timestamp IDs (e.g. 'ann-1730700000000').
 * Guaranteed to NEVER return NaN.
 */
export function getAnnouncementTime(ann: Announcement | null | undefined): number {
  if (!ann) return 0;

  if (ann.createdAt) {
    const t = new Date(ann.createdAt).getTime();
    if (!isNaN(t) && t > 0) {
      return t;
    }
  }

  // Fallback 1: Extract numeric timestamp from ID like 'ann-1730700000000'
  const idStr = String(ann.id || '');
  const match = idStr.match(/\d{10,}/);
  if (match) {
    const parsed = parseInt(match[0], 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return 0;
}

/**
 * Robust, deterministic sorting of announcements.
 * - Pinned announcements always appear first (unless explicitly comparing non-pinned).
 * - Within pinned and non-pinned groups, sorted strictly by creation time (default: newest first).
 * - Deterministic tie-breakers on ID and title guarantee the array NEVER shuffles or reorders randomly.
 */
export function sortAnnouncements(
  list: Announcement[] | null | undefined,
  sortOrder: 'newest' | 'oldest' = 'newest'
): Announcement[] {
  if (!list || !Array.isArray(list)) return [];

  return [...list].sort((a, b) => {
    // 1. Pinned status priority
    const aPinned = Boolean(a?.isPinned);
    const bPinned = Boolean(b?.isPinned);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;

    // 2. Creation time comparison
    const tA = getAnnouncementTime(a);
    const tB = getAnnouncementTime(b);
    const diff = tB - tA;

    if (diff !== 0) {
      return sortOrder === 'newest' ? diff : -diff;
    }

    // 3. Deterministic ID tie-breaker (newest ID first)
    const idA = String(a?.id || '');
    const idB = String(b?.id || '');
    if (idA !== idB) {
      const cmp = idB.localeCompare(idA, undefined, { numeric: true });
      if (cmp !== 0) {
        return sortOrder === 'newest' ? cmp : -cmp;
      }
    }

    // 4. Final stable tie-breaker by title
    return String(a?.title || '').localeCompare(String(b?.title || ''));
  });
}

