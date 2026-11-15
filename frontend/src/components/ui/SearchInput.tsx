import type { InputHTMLAttributes } from 'react';
import { Search, X } from 'lucide-react';

interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Pill-shaped search field with a leading magnifier and a clear button.
 * Replaces the hand-rolled search inputs on list/map pages so every
 * search box shares one look and focus treatment.
 */
export default function SearchInput({
  value,
  onChange,
  className = '',
  placeholder = 'Search…',
  ...rest
}: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        size={16}
        aria-hidden
        className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full min-h-[44px] rounded-full border-2 border-navy/25 dark:border-white/20 bg-white dark:bg-night-surface pl-10 pr-9 py-2 text-[15px] font-semibold text-navy dark:text-biscuit placeholder:font-medium placeholder:text-gray-400 dark:placeholder:text-gray-500 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 dark:hover:border-white/35 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:focus:border-brand-400 [&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-500 hover:bg-navy/5 hover:text-navy dark:hover:bg-white/10 dark:hover:text-biscuit transition-colors"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
