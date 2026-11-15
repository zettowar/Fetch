import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Breed, Species } from '../../types';
import { listBreeds } from '../../api/breeds';

interface Props {
  value: Breed[];
  onChange: (next: Breed[]) => void;
  max?: number;
  disabled?: boolean;
  placeholder?: string;
  label?: string;
  species?: Species;
}

export default function BreedMultiSelect({
  value,
  onChange,
  max = 3,
  disabled,
  placeholder = 'Search breeds...',
  label = 'Breeds',
  species,
}: Props) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const { data: all = [] } = useQuery({
    queryKey: ['breeds', species ?? 'all'],
    queryFn: () => listBreeds(undefined, species),
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
      <label htmlFor={inputId} className="field-label">{label}</label>
      {/* Matches <Input>: 10px corners, a 2px soft navy line, orange on focus. */}
      <div
        className={`flex flex-wrap items-center gap-1.5 rounded-lg border-2 px-2 py-2 min-h-[48px] transition-[border-color,box-shadow] duration-150 ease-soft-out ${
          disabled
            ? 'border-dashed border-navy/25 bg-gray-50 dark:border-white/20 dark:bg-night'
            : 'border-navy/25 bg-white hover:border-navy/40 dark:border-white/20 dark:bg-night-surface dark:hover:border-white/35'
        } focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/25 dark:focus-within:border-brand-400`}
      >
        {/* A picked breed is a picked chip: Ball Orange, navy line. */}
        {value.map((b) => (
          <span key={b.id} className="chip chip-on gap-1 pr-1.5">
            {b.name}
            <button
              type="button"
              onClick={() => remove(b.id)}
              disabled={disabled}
              className="-my-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-sm font-extrabold leading-none text-navy hover:bg-navy/10"
              aria-label={`Remove ${b.name}`}
            >
              ×
            </button>
          </span>
        ))}
        {!atCap && (
          <input
            id={inputId}
            type="text"
            className="flex-1 min-w-[120px] bg-transparent outline-none text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 dark:text-biscuit dark:placeholder:text-gray-500"
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
          <ul className="absolute z-10 left-0 right-0 mt-1 max-h-60 overflow-y-auto rounded-lg border-2 border-navy bg-white shadow-toy-sm dark:border-white/20 dark:bg-night-raised">
            {suggestions.map((b) => (
              <li key={b.id}>
                <button
                  type="button"
                  onClick={() => add(b)}
                  className="w-full text-left px-3 py-2.5 hover:bg-brand-100 dark:hover:bg-brand-500/15 text-sm font-semibold text-navy dark:text-biscuit flex items-center justify-between"
                >
                  <span>{b.name}</span>
                  {b.group && <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{b.group}</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
        {atCap
          ? `${max}/${max} picked — that's the most`
          : `${value.length}/${max} picked`}
      </p>
    </div>
  );
}
