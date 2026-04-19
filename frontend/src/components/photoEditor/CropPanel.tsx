import type { Action, AspectKey, EditorState } from './editorState';
import { ASPECT_RATIOS } from './editorState';

const ASPECTS: { key: AspectKey; label: string }[] = [
  { key: '1:1', label: '1:1' },
  { key: '4:5', label: '4:5' },
  { key: '3:4', label: '3:4' },
  { key: '16:9', label: '16:9' },
  { key: '9:16', label: '9:16' },
  { key: 'free', label: 'Free' },
];

interface Props {
  state: EditorState;
  dispatch: (a: Action) => void;
}

export default function CropPanel({ state, dispatch }: Props) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      {/* Aspect ratio chips */}
      <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1">
        {ASPECTS.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => dispatch({ type: 'SET_ASPECT', aspect: a.key })}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              state.aspect === a.key
                ? 'bg-white text-gray-900'
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
            aria-pressed={state.aspect === a.key}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Transform icon row */}
      <div className="flex items-center justify-around rounded-xl bg-white/5 py-2">
        <IconButton
          onClick={() => dispatch({ type: 'ROTATE_CCW' })}
          label="Rotate left"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 12a9 9 0 1 0 3-6.7" strokeLinecap="round" />
            <path d="M3 5v5h5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
        <IconButton
          onClick={() => dispatch({ type: 'ROTATE_CW' })}
          label="Rotate right"
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 12a9 9 0 1 1-3-6.7" strokeLinecap="round" />
            <path d="M21 5v5h-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </IconButton>
        <IconButton
          onClick={() => dispatch({ type: 'FLIP_H' })}
          label="Flip horizontal"
          active={state.flipH}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M12 3v18" strokeLinecap="round" strokeDasharray="2 3" />
            <path d="M4 7l5 5-5 5V7z" />
            <path d="M20 7l-5 5 5 5V7z" />
          </svg>
        </IconButton>
        <IconButton
          onClick={() => dispatch({ type: 'FLIP_V' })}
          label="Flip vertical"
          active={state.flipV}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M3 12h18" strokeLinecap="round" strokeDasharray="2 3" />
            <path d="M7 4l5 5 5-5H7z" />
            <path d="M7 20l5-5 5 5H7z" />
          </svg>
        </IconButton>
        <IconButton
          onClick={() => dispatch({ type: 'TOGGLE_GRID' })}
          label="Toggle grid"
          active={state.showGrid}
        >
          <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="18" height="18" rx="1" />
            <path d="M9 3v18M15 3v18M3 9h18M3 15h18" />
          </svg>
        </IconButton>
      </div>

      {/* Straighten slider */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-widest text-white/60">
            Straighten
          </label>
          <span className="text-xs font-mono text-white/80">
            {state.straighten > 0 ? '+' : ''}
            {state.straighten.toFixed(0)}°
          </span>
        </div>
        <input
          type="range"
          min={-45}
          max={45}
          step={0.5}
          value={state.straighten}
          onChange={(e) =>
            dispatch({ type: 'SET_STRAIGHTEN', degrees: Number(e.target.value) })
          }
          onDoubleClick={() => dispatch({ type: 'SET_STRAIGHTEN', degrees: 0 })}
          className="w-full accent-white"
        />
      </div>

      {/* Zoom slider (kept from the old modal — useful for framing) */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <label className="text-[11px] uppercase tracking-widest text-white/60">
            Zoom
          </label>
          <span className="text-xs font-mono text-white/80">
            {state.zoom.toFixed(2)}×
          </span>
        </div>
        <input
          type="range"
          min={1}
          max={5}
          step={0.01}
          value={state.zoom}
          onChange={(e) =>
            dispatch({ type: 'SET_ZOOM', zoom: Number(e.target.value) })
          }
          className="w-full accent-white"
        />
      </div>

      <p className="text-[10px] text-white/40 text-center">
        Aspect: {state.aspect === 'free' ? 'Free' : state.aspect}
        {ASPECT_RATIOS[state.aspect] !== undefined && state.aspect !== 'free'
          ? ` · ${(ASPECT_RATIOS[state.aspect] as number).toFixed(2)}`
          : ''}
      </p>
    </div>
  );
}

function IconButton({
  children,
  onClick,
  label,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors ${
        active
          ? 'bg-white text-gray-900'
          : 'text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}
