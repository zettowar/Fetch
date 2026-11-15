import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Cropper, { type MediaSize } from 'react-easy-crop';
import toast from 'react-hot-toast';
import {
  DEFAULT_STATE,
  MAX_ZOOM,
  editorReducer,
  frameOf,
  isDirty,
  minZoomOf,
  totalRotation,
} from './editorState';
import { toFilterString } from './presets';
import { prepareWorkingImage, type WorkingImage } from './thumbnail';
import { renderEditedBlob } from './export';
import PawSpinner from '../flair/PawSpinner';
import CropPanel from './CropPanel';
import AdjustPanel from './AdjustPanel';
import FilterPanel from './FilterPanel';

interface PhotoEditorProps {
  imageSrc: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export default function PhotoEditor({
  imageSrc,
  onConfirm,
  onCancel,
}: PhotoEditorProps) {
  const [state, dispatch] = useReducer(editorReducer, DEFAULT_STATE);
  const [work, setWork] = useState<WorkingImage | null>(null);
  const [confirming, setConfirming] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  // One working image for the whole session — upright, capped, and the same
  // pixels the export draws from. The cropper waits for it rather than
  // starting on the original and swapping mid-edit.
  useEffect(() => {
    let cancelled = false;
    let made: WorkingImage | null = null;
    prepareWorkingImage(imageSrc)
      .then((w) => {
        made = w;
        if (cancelled) URL.revokeObjectURL(w.url);
        else setWork(w);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error("Couldn't open that photo. Try another one.");
        onCancel();
      });
    return () => {
      cancelled = true;
      if (made) URL.revokeObjectURL(made.url);
    };
    // onCancel is a parent callback; re-running on its identity would
    // rebuild the working image mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageSrc]);

  // The stage the cropper fills. Its size decides the frame, so it's watched.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      dispatch({ type: 'SET_CONTAINER', container: { width: r.width, height: r.height } });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [work]);

  // Esc closes (matches native dialog behavior). Doesn't fire during confirm
  // so we don't drop a half-finished export.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !confirming) {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [confirming, onCancel]);

  const frame = frameOf(state);
  const minZoom = minZoomOf(state);

  // CSS filter for the live preview: warmth + tone use approximations so
  // the sliders visibly move, but the export pipeline turns these off to
  // avoid doubling up with the real pixel pass.
  const cssFilter = useMemo(
    () =>
      toFilterString(state.filter, state.adjustments, {
        warmthInCss: true,
        approxToneInCss: true,
      }),
    [state.filter, state.adjustments],
  );

  // Cropper overwrites `mediaStyle.transform` with its own
  // `translate() rotate() scale()` string, so the flips have to ride along in
  // the `transform` prop instead — otherwise they never render in the preview
  // while still applying at export, and the saved photo comes out mirrored
  // relative to what the user framed. Mirror innermost (right of scale(zoom))
  // to match the export order: translate → rotate → flip → draw centred.
  const mediaTransform = useMemo(
    () =>
      `translate(${state.crop.x}px, ${state.crop.y}px) rotate(${
        state.rotation + state.straighten
      }deg) scale(${state.zoom}) scaleX(${state.flipH ? -1 : 1}) scaleY(${
        state.flipV ? -1 : 1
      })`,
    [
      state.crop.x,
      state.crop.y,
      state.rotation,
      state.straighten,
      state.zoom,
      state.flipH,
      state.flipV,
    ],
  );

  // Vignette preview: a radial inset shadow over the cropped area. Strength
  // matches the exporter's falloff envelope closely enough for a visual
  // sanity check while editing.
  const vignetteBoxShadow = useMemo(() => {
    const v = state.adjustments.vignette;
    if (v <= 0) return undefined;
    // Up to ~rgba(0,0,0,0.8) at 100, nothing at 0.
    const alpha = (v / 100) * 0.8;
    const spread = Math.round(30 + (v / 100) * 90); // px
    return `inset 0 0 ${spread}px rgba(0, 0, 0, ${alpha.toFixed(2)})`;
  }, [state.adjustments.vignette]);

  const handleConfirm = async () => {
    if (!work || !frame) return;
    setConfirming(true);
    try {
      // Drawn from the working canvas — the same pixels the cropper showed —
      // with the preview's own transform (see export.ts).
      const blob = await renderEditedBlob(work.canvas, state);
      onConfirm(blob);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Could not export the photo';
      toast.error(message);
      setConfirming(false);
    }
  };

  return (
    // The editor is always after-dark: Night Walk chrome around a black
    // preview (photos are judged against neutral black, not navy).
    //
    // Full-screen on a phone. From `sm` it is a panel over a dimmed page: a
    // 1400px-wide tool tray stretches every slider into a long line, and a
    // desktop expects an editor to be a dialog. The stage is measured by a
    // ResizeObserver, so the frame follows the panel's size on its own.
    <div className="fixed inset-0 z-50 bg-night sm:flex sm:items-center sm:justify-center sm:bg-night/80 sm:p-6">
    <div className="flex h-full w-full flex-col bg-night text-biscuit sm:h-[min(880px,100%)] sm:max-w-2xl sm:overflow-hidden sm:rounded-3xl sm:border sm:border-white/15">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-14 flex-shrink-0 border-b border-white/10">
        <button
          type="button"
          onClick={onCancel}
          disabled={confirming}
          className="text-sm font-bold text-biscuit/80 hover:text-biscuit disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET' })}
            disabled={!isDirty(state) || confirming}
            className="text-xs font-bold text-biscuit/60 hover:text-biscuit disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || !work || !frame}
            className="btn btn-primary btn-sm"
          >
            {confirming && (
              <span
                className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin"
                aria-hidden
              />
            )}
            {confirming ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div ref={stageRef} className="relative flex-1 min-h-0">
        {!work ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <PawSpinner label="Opening your photo" />
          </div>
        ) : (
        <Cropper
          image={work.url}
          crop={state.crop}
          zoom={state.zoom}
          rotation={totalRotation(state)}
          transform={mediaTransform}
          // Square, always: the shape every photo is shown in. The frame is
          // ours (fixed while straightening), and zoom can't drop below the
          // point where the photo covers it — see coverage.ts.
          aspect={1}
          cropSize={frame ?? undefined}
          minZoom={minZoom}
          maxZoom={Math.max(MAX_ZOOM, minZoom)}
          onCropChange={(crop) => dispatch({ type: 'SET_CROP', crop })}
          onZoomChange={(zoom) => dispatch({ type: 'SET_ZOOM', zoom })}
          setMediaSize={(m: MediaSize) =>
            dispatch({ type: 'SET_MEDIA', media: { width: m.width, height: m.height } })
          }
          showGrid={state.showGrid}
          objectFit="contain"
          style={{
            containerStyle: { background: '#000' },
            cropAreaStyle: {
              borderColor: '#fff',
              borderWidth: 2,
              // Vignette approximation overlays the crop area so the darkening
              // follows whatever region the user is actually capturing.
              boxShadow: vignetteBoxShadow,
            },
            mediaStyle: {
              filter: cssFilter,
              transformOrigin: 'center',
              transition: 'none',
            },
          }}
        />
        )}
      </div>

      {/* Tool tray */}
      <div className="flex-shrink-0 border-t border-white/10 min-h-[140px]">
        {state.tab === 'crop' && (
          <CropPanel state={state} dispatch={dispatch} />
        )}
        {state.tab === 'adjust' && (
          <AdjustPanel state={state} dispatch={dispatch} />
        )}
        {state.tab === 'filter' && (
          <FilterPanel
            state={state}
            dispatch={dispatch}
            imageSrc={work?.url ?? imageSrc}
          />
        )}
      </div>

      {/* Tab bar */}
      <div className="flex-shrink-0 grid grid-cols-3 border-t border-white/10 bg-night safe-bottom">
        <TabButton
          label="Crop"
          active={state.tab === 'crop'}
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'crop' })}
        />
        <TabButton
          label="Adjust"
          active={state.tab === 'adjust'}
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'adjust' })}
        />
        <TabButton
          label="Filter"
          active={state.tab === 'filter'}
          onClick={() => dispatch({ type: 'SET_TAB', tab: 'filter' })}
        />
      </div>
    </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-14 flex items-center justify-center text-sm font-extrabold transition-colors ${
        active ? 'text-biscuit' : 'text-biscuit/50 hover:text-biscuit/80'
      }`}
      aria-pressed={active}
    >
      <span className="relative">
        {label}
        {active && (
          <span
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-1 w-6 rounded-full bg-brand-500"
            aria-hidden
          />
        )}
      </span>
    </button>
  );
}
