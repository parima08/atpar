'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ComboboxOption {
  value: string;  // The ID (stored)
  label: string;  // The name (displayed)
}

interface ComboboxProps {
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select an option…',
  disabled = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Get the label for the currently selected value
  const selectedLabel = React.useMemo(() => {
    const selected = options.find(opt => opt.value === value);
    return selected?.label || '';
  }, [options, value]);

  // Display value - show label if found, otherwise show truncated ID as fallback
  const displayValue = React.useMemo(() => {
    if (selectedLabel) return selectedLabel;
    if (value) {
      return value.length > 20 ? `${value.substring(0, 8)}…${value.substring(value.length - 4)}` : value;
    }
    return '';
  }, [selectedLabel, value]);

  // Filter options based on search
  const filteredOptions = React.useMemo(() => {
    if (!search) return options;
    const searchLower = search.toLowerCase();
    return options.filter(opt =>
      opt.label.toLowerCase().includes(searchLower)
    );
  }, [options, search]);

  // Reset highlighted index when filtered options change
  React.useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredOptions]);

  // Handle click outside to close
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll highlighted item into view
  React.useEffect(() => {
    if (open && listRef.current) {
      const highlightedEl = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlightedEl) {
        highlightedEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, open]);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setOpen(false);
    setSearch('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!open) {
          setOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : prev
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex(prev => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (open && filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        } else {
          setOpen(true);
        }
        break;
      case 'Escape':
        setOpen(false);
        setSearch('');
        break;
      case 'Tab':
        setOpen(false);
        setSearch('');
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    if (!open) setOpen(true);
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setOpen(true);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Trigger */}
      <div
        className={cn(
          'flex items-center w-full rounded-lg border border-[#E7E5E4] bg-white',
          'transition-all duration-150',
          open
            ? 'ring-2 ring-[#0D7377]/30 border-[#0D7377]'
            : 'hover:border-[#0D7377]/40',
          disabled && 'opacity-50 cursor-not-allowed bg-[#FAFAF7]',
        )}
      >
        {/* Search icon when open, otherwise just padding */}
        <div className="pl-3 flex items-center shrink-0">
          {open ? (
            <Search className="h-3.5 w-3.5 text-[#0D7377]" />
          ) : (
            <ChevronsUpDown className="h-3.5 w-3.5 text-[#78716C]" />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          className={cn(
            'flex-1 px-2.5 py-2 text-sm bg-transparent outline-none min-w-0',
            'placeholder:text-[#78716C]',
            disabled && 'cursor-not-allowed',
          )}
          placeholder={displayValue || placeholder}
          value={open ? search : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />

        {/* Clear button */}
        {value && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 mr-1 hover:bg-[#F5F5F0] rounded-md transition-colors shrink-0"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5 text-[#78716C] hover:text-[#1C1917]" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div
          className={cn(
            'absolute z-50 mt-1.5 w-full',
            'rounded-xl border border-[#E7E5E4] bg-white',
            'shadow-lg shadow-black/5',
            'overflow-hidden',
          )}
        >
          {/* Search hint row */}
          {filteredOptions.length > 0 && search === '' && (
            <div className="flex items-center gap-2 px-3 py-2 border-b border-[#F5F5F0] bg-[#FAFAF7]">
              <Search className="h-3 w-3 text-[#78716C]" />
              <span className="text-xs text-[#78716C]">Type to filter…</span>
            </div>
          )}

          <ul
            ref={listRef}
            className="max-h-52 overflow-auto py-1"
            role="listbox"
          >
            {filteredOptions.length === 0 ? (
              <li className="flex items-center gap-2 px-3 py-3 text-sm text-[#78716C]">
                <Search className="h-3.5 w-3.5" />
                No results for &ldquo;{search}&rdquo;
              </li>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = option.value === value;
                const isHighlighted = index === highlightedIndex;
                return (
                  <li
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 text-sm cursor-pointer select-none',
                      'transition-colors duration-75',
                      isHighlighted && !isSelected && 'bg-[#F5F5F0] text-[#1C1917]',
                      isSelected
                        ? 'bg-[#E6F4F4] text-[#0D7377] font-medium'
                        : 'text-[#1C1917] hover:bg-[#F5F5F0]',
                    )}
                    onClick={() => handleSelect(option.value)}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <span className="truncate">{option.label}</span>
                    {isSelected && (
                      <Check className="h-3.5 w-3.5 text-[#0D7377] shrink-0 ml-2" />
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
