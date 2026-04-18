import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Breed } from '../../types';
import { listBreeds } from '../../api/breeds';

interface Props {
  value: Breed[];
  onChange: (next: Breed[]) => void;
  max?: number;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
}

export default function BreedMultiSelect({
  value,
  onChange,
  max = 3,
  disabled,
  placeholder = 'Search breeds...',
  label = 'Breeds',
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { data: all = [] } = useQuery({
    queryKey: ['breeds'],
    queryFn: () => listBreeds(),
    staleTime: 5 * 60 * 1000,
  });

  const selectedIds = useMemo(() => new Set(value.map((b) => b.id)), [value]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((b) => !selectedIds.has(b.id) && (q === '' || b.name.toLowerCase().includes(q)))
      .slice(0, 20);
  }, [all, query, selectedIds]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const atCap = value.length >= max;

  const add = (b: Breed) => {
    if (atCap) return;
    onChange([...value, b]);
    setQuery('');
  };

  const remove = (id: string) => {
    onChange(value.filter((b) => b.id !== id));
  };

  return (
    <div className="flex flex-col gap-1" ref={wrapRef}>
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-xl border border-gray-300 px-2 py-2 min-h-[44px] ${
          disabled ? 'bg-gray-50' : 'bg-white'
        } focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-200`}
      >
        {value.map((b) => (
          <span
            key={b.id}
            className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-700 text-sm px-2.5 py-0.5"
          >
            {b.name}
            <button
              type="button"
              onClick={() => remove(b.id)}
              disabled={disabled}
              className="text-brand-500 hover:text-brand-700 text-xs leading-none"
              aria-label={`Remove ${b.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {!atCap && (
          <input
            type="text"
            className="flex-1 min-w-[120px] outline-none text-base"
            placeholder={value.length === 0 ? placeholder : ''}
            value={query}
            disabled={disabled}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        )}
      </div>
      {open && !disabled && !atCap && suggestions.length > 0 && (
        <div className="relative">
          <ul className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg">
            {suggestions.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => add(b)}
                  className="w-full text-left px-3 py-2 hover:bg-brand-50 text-sm flex items-center justify-between"
                >
                  <span>{b.name}</span>
                  {b.group && <span className="text-xs text-gray-400">{b.group}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-gray-400">
        {atCap
          ? `Maximum ${max} breeds selected`
          : `${value.length}/${max} breeds selected`}
      </p>
    </div>
  );
}
