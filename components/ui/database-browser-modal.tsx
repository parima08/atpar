'use client';

import * as React from 'react';
import { Search, X, Check, Database, ExternalLink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface NotionDatabaseOption {
  id: string;
  title: string;
  url: string;
  icon: string | null;
  iconType: string | null;
  lastEditedTime: string | null;
}

interface DatabaseBrowserModalProps {
  open: boolean;
  onClose: () => void;
  databases: NotionDatabaseOption[];
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  maxSelections?: number;
  loading?: boolean;
}

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? '' : 's'} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? '' : 's'} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? '' : 's'} ago`;
}

function DatabaseIcon({ icon, iconType, title }: { icon: string | null; iconType: string | null; title: string }) {
  if (icon && iconType === 'emoji') {
    return <span className="text-lg leading-none select-none">{icon}</span>;
  }
  if (icon && iconType === 'external') {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={icon} alt="" className="w-5 h-5 rounded object-cover" />
    );
  }
  // Fallback: first letter of title in a coloured circle
  return (
    <div className="w-5 h-5 rounded bg-[#0D7377]/15 flex items-center justify-center">
      <span className="text-[10px] font-semibold text-[#0D7377] uppercase leading-none">
        {title.charAt(0) || 'D'}
      </span>
    </div>
  );
}

export function DatabaseBrowserModal({
  open,
  onClose,
  databases,
  selectedIds,
  onConfirm,
  maxSelections = 5,
  loading = false,
}: DatabaseBrowserModalProps) {
  const [search, setSearch] = React.useState('');
  const [pendingIds, setPendingIds] = React.useState<string[]>(selectedIds);
  const searchRef = React.useRef<HTMLInputElement>(null);

  // Sync incoming selectedIds when modal opens
  React.useEffect(() => {
    if (open) {
      setPendingIds(selectedIds);
      setSearch('');
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [open, selectedIds]);

  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  const filteredDatabases = React.useMemo(() => {
    if (!search.trim()) return databases;
    const q = search.toLowerCase();
    return databases.filter(db => db.title.toLowerCase().includes(q));
  }, [databases, search]);

  const toggleDatabase = (id: string) => {
    setPendingIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= maxSelections) return prev; // at limit
      return [...prev, id];
    });
  };

  const handleConfirm = () => {
    onConfirm(pendingIds);
    onClose();
  };

  const atLimit = pendingIds.length >= maxSelections;

  if (!open) return null;

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      {/* Modal panel */}
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl shadow-black/20 flex flex-col max-h-[80vh] overflow-hidden border border-[#E7E5E4]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#F5F5F0]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0D7377]/10">
              <Database className="h-4 w-4 text-[#0D7377]" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[#1C1917]">Select databases</h2>
              <p className="text-xs text-[#78716C]">
                {pendingIds.length} of {maxSelections} selected
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#F5F5F0] text-[#78716C] hover:text-[#1C1917] transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Search bar */}
        <div className="px-4 py-3 border-b border-[#F5F5F0]">
          <div className="flex items-center gap-2.5 rounded-lg border border-[#E7E5E4] bg-[#FAFAF7] px-3 py-2 focus-within:border-[#0D7377] focus-within:ring-2 focus-within:ring-[#0D7377]/20 transition-all">
            <Search className="h-3.5 w-3.5 text-[#78716C] shrink-0" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Search databases…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none text-[#1C1917] placeholder:text-[#A8A29E]"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="text-[#A8A29E] hover:text-[#1C1917] transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selection limit warning */}
        {atLimit && (
          <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700">
            <span className="font-medium">Max {maxSelections} databases selected.</span>
            <span>Remove one to add another.</span>
          </div>
        )}

        {/* Database list */}
        <div className="flex-1 overflow-y-auto py-2 min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[#78716C]">
              <Loader2 className="h-5 w-5 animate-spin text-[#0D7377]" />
              <span className="text-sm">Loading databases…</span>
            </div>
          ) : filteredDatabases.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2 text-[#78716C]">
              <Search className="h-5 w-5" />
              <span className="text-sm">
                {search ? `No databases match "${search}"` : 'No databases found'}
              </span>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-xs text-[#0D7377] hover:underline mt-1"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <ul role="listbox" aria-multiselectable="true">
              {filteredDatabases.map(db => {
                const isSelected = pendingIds.includes(db.id);
                const isDisabled = !isSelected && atLimit;
                return (
                  <li key={db.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={isDisabled}
                      onClick={() => toggleDatabase(db.id)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75',
                        isSelected
                          ? 'bg-[#E6F4F4]'
                          : isDisabled
                            ? 'opacity-40 cursor-not-allowed'
                            : 'hover:bg-[#F5F5F0] cursor-pointer',
                      )}
                    >
                      {/* Checkbox */}
                      <div
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
                          isSelected
                            ? 'bg-[#0D7377] border-[#0D7377]'
                            : 'border-[#D4D0CB] bg-white',
                        )}
                      >
                        {isSelected && <Check className="h-2.5 w-2.5 text-white stroke-[3]" />}
                      </div>

                      {/* Icon */}
                      <div className="shrink-0 flex items-center justify-center w-5">
                        <DatabaseIcon icon={db.icon} iconType={db.iconType} title={db.title} />
                      </div>

                      {/* Name + last edited */}
                      <div className="flex-1 min-w-0">
                        <p className={cn(
                          'text-sm truncate',
                          isSelected ? 'font-medium text-[#0D7377]' : 'text-[#1C1917]',
                        )}>
                          {db.title}
                        </p>
                        {db.lastEditedTime && (
                          <p className="text-xs text-[#A8A29E] mt-0.5">
                            edited {formatRelativeTime(db.lastEditedTime)}
                          </p>
                        )}
                      </div>

                      {/* Open in Notion link */}
                      {db.url && (
                        <a
                          href={db.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="shrink-0 p-1 rounded text-[#A8A29E] hover:text-[#0D7377] hover:bg-[#0D7377]/10 transition-colors"
                          aria-label="Open in Notion"
                          tabIndex={-1}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Manual ID fallback */}
        <div className="px-4 py-2 border-t border-[#F5F5F0] bg-[#FAFAF7]">
          <p className="text-xs text-[#A8A29E]">
            Don&apos;t see your database?{' '}
            <span className="text-[#78716C]">
              Make sure it&apos;s shared with your integration in Notion, then re-enter your token above.
            </span>
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[#E7E5E4]">
          <button
            type="button"
            onClick={() => setPendingIds([])}
            disabled={pendingIds.length === 0}
            className="text-xs text-[#78716C] hover:text-[#1C1917] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Clear all
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-[#57534E] hover:bg-[#F5F5F0] transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-[#0D7377] text-white hover:bg-[#0A5A5C] transition-colors disabled:opacity-50"
              disabled={pendingIds.length === 0}
            >
              Confirm{pendingIds.length > 0 ? ` (${pendingIds.length})` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
