import type { Action, AdjustmentKey, EditorState } from './editorState';

const CHANNELS: { key: AdjustmentKey; label: string }[] = [
  { key: 'brightness', label: 'Brightness' },
  { key: 'contrast', label: 'Contrast' },
  { key: 'saturation', label: 'Saturation' },
  { key: 'warmth', label: 'Warmth' },
];

interface Props {
  state: EditorState;
  dispatch: (a: Action) => void;
}

export default function AdjustPanel({ state, dispatch }: Props) {
  const active = state.activeChannel;
  const value = state.adjustments[active];

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Segmented control */}
      <div className="flex gap-1 rounded-full bg-white/10 p-1">
        {CHANNELS.map((c) => {
          const isActive = active === c.key;
          const v = state.adjustments[c.key];
          const dirty = v !== 0;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() =>
                dispatch({ type: 'SET_ACTIVE_CHANNEL', channel: c.key })
              }
              className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-white text-gray-900'
                  : 'text-white/80 hover:text-white'
              }`}
            >
              {c.label}
              {dirty && !isActive && (
                <span
                  className="h-1.5 w-1.5 rounded-full bg-white"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Active slider */}
      <div className="flex flex-col gap-1.5 rounded-xl bg-white/5 px-3 py-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-widest text-white/60">
            {CHANNELS.find((c) => c.key === active)?.label}
          </span>
          <span className="text-xs font-mono text-white/80">
            {value > 0 ? '+' : ''}
            {value.toFixed(0)}
          </span>
        </div>
        <input
          type="range"
          min={-100}
          max={100}
          step={1}
          value={value}
          onChange={(e) =>
            dispatch({
              type: 'SET_ADJ',
              key: active,
              value: Number(e.target.value),
            })
          }
          onDoubleClick={() => dispatch({ type: 'RESET_ADJ', key: active })}
          className="w-full accent-white"
        />
        <p className="text-[10px] text-white/40 text-center">
          Double-tap the slider to reset just this channel
        </p>
      </div>
    </div>
  );
}
