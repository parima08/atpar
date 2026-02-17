'use client';

import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
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
  placeholder = 'Select an option...',
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
      // Show truncated ID as fallback when label isn't found (e.g., options still loading)
      return value.length > 20 ? `${value.substring(0, 8)}...${value.substring(value.length - 4)}` : value;
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
      <div
        className={cn(
          'flex items-center w-full rounded-md border border-input bg-background',
          'ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input
          ref={inputRef}
          type="text"
          className={cn(
            'flex-1 px-3 py-2 text-sm bg-transparent outline-none',
            'placeholder:text-muted-foreground',
            disabled && 'cursor-not-allowed'
          )}
          placeholder={displayValue || placeholder}
          value={open ? search : displayValue}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          autoComplete="off"
        />
        <div className="flex items-center pr-2 gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-accent rounded-sm"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {open && !disabled && (
        <ul
          ref={listRef}
          className={cn(
            'absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-md border bg-popover',
            'text-popover-foreground shadow-md'
          )}
          role="listbox"
        >
          {filteredOptions.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">
              No results found
            </li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  'flex items-center justify-between px-3 py-2 text-sm cursor-pointer',
                  'hover:bg-accent hover:text-accent-foreground',
                  index === highlightedIndex && 'bg-accent text-accent-foreground',
                  option.value === value && 'font-medium'
                )}
                onClick={() => handleSelect(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                <span>{option.label}</span>
                {option.value === value && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
