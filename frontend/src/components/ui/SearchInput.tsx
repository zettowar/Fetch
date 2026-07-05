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
        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500"
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 pl-10 pr-9 py-2.5 text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 shadow-soft-sm outline-none transition-all duration-200 ease-soft-out hover:border-gray-300 dark:hover:border-gray-600 focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:border-brand-400 dark:focus:ring-brand-500/30 [&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </div>
  );
}
