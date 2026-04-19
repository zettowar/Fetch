import { useEffect, useMemo, useState } from 'react';
import type { Action, EditorState, FilterKey } from './editorState';
import { FILTERS, FILTER_ORDER } from './presets';
import { applyCssFilterToCanvas, buildThumbnailBase } from './thumbnail';

interface Props {
  state: EditorState;
  dispatch: (a: Action) => void;
  /** The source URL — used to generate the base thumbnail once. */
  imageSrc: string;
}

export default function FilterPanel({ state, dispatch, imageSrc }: Props) {
  const [thumbs, setThumbs] = useState<Record<FilterKey, string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    buildThumbnailBase(imageSrc, 96)
      .then((base) => {
        if (cancelled) return;
        // Pre-render one data URL per preset, then freeze the result.
        const entries: Partial<Record<FilterKey, string>> = {};
        for (const key of FILTER_ORDER) {
          entries[key] = applyCssFilterToCanvas(base, FILTERS[key].css);
        }
        setThumbs(entries as Record<FilterKey, string>);
      })
      .catch(() => {
        // Non-fatal — fall back to text-only chips.
        setThumbs(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const items = useMemo(
    () =>
      FILTER_ORDER.map((key) => ({
        key,
        label: FILTERS[key].label,
        thumb: thumbs?.[key],
      })),
    [thumbs],
  );

  return (
    <div className="px-3 py-3 overflow-x-auto">
      <div className="flex gap-2 w-max">
        {items.map((it) => {
          const selected = state.filter === it.key;
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => dispatch({ type: 'SET_FILTER', filter: it.key })}
              className={`flex flex-col items-center gap-1.5 focus:outline-none ${
                selected ? '' : 'opacity-90'
              }`}
              aria-pressed={selected}
            >
              <div
                className={`relative h-20 w-20 rounded-lg overflow-hidden ring-2 transition-all ${
                  selected ? 'ring-white' : 'ring-transparent'
                }`}
              >
                {it.thumb ? (
                  <img
                    src={it.thumb}
                    alt={it.label}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full bg-white/10 flex items-center justify-center text-[10px] text-white/60">
                    {it.label}
                  </div>
                )}
              </div>
              <span
                className={`text-[11px] font-medium ${
                  selected ? 'text-white' : 'text-white/60'
                }`}
              >
                {it.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
