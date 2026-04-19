import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import {
  ASPECT_RATIOS,
  DEFAULT_STATE,
  editorReducer,
  isDirty,
} from './editorState';
import { toFilterString } from './presets';
import { buildPreviewUrl } from './thumbnail';
import { renderEditedBlob } from './export';
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
  const [previewSrc, setPreviewSrc] = useState(imageSrc);
  const [confirming, setConfirming] = useState(false);

  // Downscale the source once for the Cropper preview. Full-res stays
  // untouched until Done.
  useEffect(() => {
    let cancelled = false;
    buildPreviewUrl(imageSrc, 1280)
      .then((url) => {
        if (!cancelled) setPreviewSrc(url);
      })
      .catch(() => {
        // On failure fall back to the original — correctness over speed.
        if (!cancelled) setPreviewSrc(imageSrc);
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    dispatch({ type: 'SET_CROPPED_AREA', area: areaPixels });
  }, []);

  const cssFilter = useMemo(
    () => toFilterString(state.filter, state.adjustments),
    [state.filter, state.adjustments],
  );

  const handleConfirm = async () => {
    if (!state.croppedAreaPixels) return;
    setConfirming(true);
    try {
      // Export off the ORIGINAL full-res src, not the downscaled preview,
      // so we don't ship lossier pixels than necessary to the server.
      const blob = await renderEditedBlob(imageSrc, state);
      onConfirm(blob);
    } catch {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-12 flex-shrink-0 border-b border-white/10">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-white/80 hover:text-white transition-colors"
        >
          Cancel
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => dispatch({ type: 'RESET' })}
            disabled={!isDirty(state)}
            className="text-xs text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={confirming || !state.croppedAreaPixels}
            className="rounded-full bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white text-sm font-semibold px-4 py-1.5 transition-colors"
          >
            {confirming ? 'Saving…' : 'Done'}
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="relative flex-1 min-h-0">
        <Cropper
          image={previewSrc}
          crop={state.crop}
          zoom={state.zoom}
          rotation={state.rotation + state.straighten}
          aspect={ASPECT_RATIOS[state.aspect]}
          onCropChange={(crop) => dispatch({ type: 'SET_CROP', crop })}
          onZoomChange={(zoom) => dispatch({ type: 'SET_ZOOM', zoom })}
          onCropComplete={onCropComplete}
          showGrid={state.showGrid}
          objectFit="contain"
          style={{
            containerStyle: { background: '#000' },
            cropAreaStyle: { borderColor: '#fff', borderWidth: 2 },
            // Cropper already composes translate + rotate + scale(zoom) on the
            // media. Layer our preview-only extras on top: horizontal/vertical
            // flip + CSS filter for live look-preview. The exporter re-applies
            // these against the full-res source, so the crop rectangle that
            // Cropper reports stays in its non-flipped coordinate space (as
            // renderEditedBlob expects).
            mediaStyle: {
              filter: cssFilter,
              transform: `scale(${state.flipH ? -1 : 1}, ${
                state.flipV ? -1 : 1
              })`,
              transformOrigin: 'center',
              transition: 'none',
            },
          }}
        />
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
          <FilterPanel state={state} dispatch={dispatch} imageSrc={previewSrc} />
        )}
      </div>

      {/* Tab bar */}
      <div
        className="flex-shrink-0 grid grid-cols-3 border-t border-white/10 bg-black safe-bottom"
      >
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
      className={`h-14 flex items-center justify-center text-sm font-medium transition-colors ${
        active ? 'text-white' : 'text-white/50 hover:text-white/80'
      }`}
      aria-pressed={active}
    >
      <span className="relative">
        {label}
        {active && (
          <span
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-0.5 w-6 rounded-full bg-brand-500"
            aria-hidden
          />
        )}
      </span>
    </button>
  );
}
