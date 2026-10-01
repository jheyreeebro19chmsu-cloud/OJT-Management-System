/**
 * Calculates a window of visible page numbers up to maxVisible (default 10).
 * Prevents pagination button overflow when total pages is large.
 */
export function getPaginationWindow(currentPage: number, totalPages: number, maxVisible = 10): number[] {
  if (totalPages <= 1) return [1];
  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const half = Math.floor(maxVisible / 2);
  let start = Math.max(1, currentPage - half);
  let end = start + maxVisible - 1;
  if (end > totalPages) {
    end = totalPages;
    start = Math.max(1, end - maxVisible + 1);
  }
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}
