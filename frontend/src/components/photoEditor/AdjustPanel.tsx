import type { Action, AdjustmentKey, EditorState } from './editorState';
import { PIXEL_PASS_CHANNELS } from './editorState';

interface ChannelMeta {
  key: AdjustmentKey;
  label: string;
  min: number;
  max: number;
}

const CHANNELS: ChannelMeta[] = [
  { key: 'brightness', label: 'Brightness', min: -100, max: 100 },
  { key: 'contrast', label: 'Contrast', min: -100, max: 100 },
  { key: 'saturation', label: 'Saturation', min: -100, max: 100 },
  { key: 'warmth', label: 'Warmth', min: -100, max: 100 },
  { key: 'highlights', label: 'Highlights', min: -100, max: 100 },
  { key: 'shadows', label: 'Shadows', min: -100, max: 100 },
  { key: 'vignette', label: 'Vignette', min: 0, max: 100 },
];

const PIXEL_PASS_SET = new Set<AdjustmentKey>(PIXEL_PASS_CHANNELS);

interface Props {
  state: EditorState;
  dispatch: (a: Action) => void;
}

export default function AdjustPanel({ state, dispatch }: Props) {
  const active = state.activeChannel;
  const activeMeta = CHANNELS.find((c) => c.key === active) ?? CHANNELS[0];
  const value = state.adjustments[active];
  const isPixelPass = PIXEL_PASS_SET.has(active);

  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Horizontally-scrollable channel picker — seven channels would be
          cramped in a fixed segmented control at 420px. */}
      <div className="flex gap-1 overflow-x-auto -mx-1 px-1 pb-0.5">
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
              className={`flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors ${
                isActive
                  ? 'bg-white text-gray-900'
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
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
            {activeMeta.label}
          </span>
          <span className="text-xs font-mono text-white/80">
            {value > 0 ? '+' : ''}
            {value.toFixed(0)}
          </span>
        </div>
        <input
          type="range"
          min={activeMeta.min}
          max={activeMeta.max}
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
          {isPixelPass
            ? 'Preview is approximate — final result applied on Done.'
            : 'Double-tap the slider to reset just this channel'}
        </p>
      </div>
    </div>
  );
}
