import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, Users, X } from 'lucide-react';

export interface TraineeSearchOption {
  id: string;
  name: string;
  employeeId?: string;
  companyName?: string;
  company?: string;
  course?: string;
  email?: string;
  supervisorName?: string;
}

interface TraineeSearchDropdownProps<T extends TraineeSearchOption = TraineeSearchOption> {
  trainees: T[];
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedId: string;
  onSelect: (id: string, trainee?: T) => void;
  allowAllOption?: boolean;
  allLabel?: string;
  placeholder?: string;
  accentColor?: 'blue' | 'emerald';
  ariaLabel?: string;
}

const MAX_VISIBLE_OPTIONS = 50;

/**
 * Reusable searchable trainee selector dropdown supporting multi-token matching
 * across trainee name, student ID, course, email, HTE company, and supervisor.
 */
export function TraineeSearchDropdown<T extends TraineeSearchOption>({
  trainees,
  searchQuery,
  onSearchChange,
  selectedId,
  onSelect,
  allowAllOption = false,
  allLabel = 'All Trainees',
  placeholder = 'Search or select trainee by name, student ID, course, or HTE company...',
  accentColor = 'blue',
  ariaLabel = 'Search and select trainee',
}: TraineeSearchDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filteredMatches = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (!trimmed) return trainees;
    const tokens = trimmed.split(/\s+/).filter(Boolean);
    return trainees.filter((t) => {
      const haystack = [
        t.name,
        t.employeeId,
        t.email,
        t.course,
        t.companyName,
        t.company,
        t.supervisorName,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });
  }, [trainees, searchQuery]);

  const visibleMatches = useMemo(
    () => filteredMatches.slice(0, MAX_VISIBLE_OPTIONS),
    [filteredMatches]
  );

  const hasTrimmedQuery = searchQuery.trim().length > 0;
  const showAllRow = allowAllOption && (!hasTrimmedQuery || selectedId !== 'all');
  const totalNavigableCount = (showAllRow ? 1 : 0) + visibleMatches.length;

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchQuery, isOpen]);

  const isEmerald = accentColor === 'emerald';
  const ringClass = isEmerald ? 'focus:ring-emerald-500' : 'focus:ring-blue-500';
  const badgeClasses = isEmerald
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : 'bg-blue-50 text-blue-700 border-blue-200';
  const selectedRowClasses = isEmerald
    ? 'bg-emerald-50/80 text-emerald-900'
    : 'bg-blue-50/80 text-blue-900';
  const checkIconColor = isEmerald ? 'text-emerald-600' : 'text-blue-600';

  const showClearBtn = searchQuery.length > 0 || (allowAllOption && selectedId !== 'all');

  const handleSelectAll = () => {
    onSelect('all', undefined);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleSelectTrainee = (trainee: T) => {
    onSelect(trainee.id, trainee);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = () => {
    onSearchChange('');
    if (allowAllOption) {
      onSelect('all', undefined);
    }
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      setHighlightedIndex(-1);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        if (totalNavigableCount > 0) setHighlightedIndex(0);
        return;
      }
      if (totalNavigableCount > 0) {
        setHighlightedIndex((prev) => (prev + 1) % totalNavigableCount);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        if (totalNavigableCount > 0) setHighlightedIndex(totalNavigableCount - 1);
        return;
      }
      if (totalNavigableCount > 0) {
        setHighlightedIndex((prev) => (prev <= 0 ? totalNavigableCount - 1 : prev - 1));
      }
      return;
    }

    if (e.key === 'Enter' && isOpen && highlightedIndex >= 0) {
      e.preventDefault();
      if (showAllRow) {
        if (highlightedIndex === 0) {
          handleSelectAll();
          return;
        }
        const match = visibleMatches[highlightedIndex - 1];
        if (match) handleSelectTrainee(match);
      } else {
        const match = visibleMatches[highlightedIndex];
        if (match) handleSelectTrainee(match);
      }
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search
          size={16}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            onSearchChange(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          role="combobox"
          autoComplete="off"
          className={`w-full pl-10 ${hasTrimmedQuery ? 'pr-40' : showClearBtn ? 'pr-16' : 'pr-10'} py-2.5 rounded-xl border border-slate-200 bg-slate-50/70 text-xs sm:text-sm font-medium text-slate-700 placeholder:text-slate-400 hover:bg-slate-100/60 focus:bg-white focus:outline-none focus:ring-2 ${ringClass} transition-all`}
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {hasTrimmedQuery && (
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${badgeClasses}`}>
              {filteredMatches.length} {filteredMatches.length === 1 ? 'match' : 'matches'}
            </span>
          )}
          {showClearBtn && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              const next = !isOpen;
              setIsOpen(next);
              if (next) inputRef.current?.focus();
            }}
            aria-label={isOpen ? 'Close trainee list' : 'Open trainee list'}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors cursor-pointer"
          >
            <ChevronDown
              size={15}
              className={`transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
        >
          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            {showAllRow && (
              <button
                type="button"
                role="option"
                aria-selected={selectedId === 'all'}
                onClick={handleSelectAll}
                className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                  selectedId === 'all'
                    ? selectedRowClasses
                    : highlightedIndex === 0
                    ? 'bg-slate-100 text-slate-900'
                    : 'hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Users size={14} className="text-slate-400 shrink-0" />
                  <span className="text-xs font-bold truncate">{allLabel}</span>
                </div>
                {selectedId === 'all' && <Check size={14} className={`${checkIconColor} shrink-0`} />}
              </button>
            )}

            {visibleMatches.length === 0 ? (
              <div className="px-4 py-6 text-center space-y-2">
                <p className="text-xs text-slate-500 font-medium">
                  {hasTrimmedQuery
                    ? `No trainees matching "${searchQuery.trim()}".`
                    : 'No trainees available.'}
                </p>
                {hasTrimmedQuery && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold ${
                      isEmerald ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100' : 'text-blue-700 bg-blue-50 hover:bg-blue-100'
                    } transition-colors cursor-pointer`}
                  >
                    Clear search
                  </button>
                )}
              </div>
            ) : (
              visibleMatches.map((t, idx) => {
                const navIdx = showAllRow ? idx + 1 : idx;
                const isSelected = t.id === selectedId;
                const isHighlighted = highlightedIndex === navIdx;
                const company = t.companyName || t.company || '';
                const secondary = [company, t.course].filter(Boolean).join(' • ');

                return (
                  <button
                    key={t.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelectTrainee(t)}
                    className={`w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? selectedRowClasses
                        : isHighlighted
                        ? 'bg-slate-100 text-slate-900'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold truncate">{t.name}</span>
                        {t.employeeId && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            {t.employeeId}
                          </span>
                        )}
                      </div>
                      {secondary && (
                        <p className="text-[11px] text-slate-500 truncate mt-0.5">{secondary}</p>
                      )}
                    </div>
                    {isSelected && <Check size={15} className={`${checkIconColor} shrink-0`} />}
                  </button>
                );
              })
            )}
          </div>

          {filteredMatches.length > MAX_VISIBLE_OPTIONS && (
            <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500 font-medium text-center">
              Showing {MAX_VISIBLE_OPTIONS} of {filteredMatches.length} trainees — type to narrow results
            </div>
          )}
        </div>
      )}
    </div>
  );
}

