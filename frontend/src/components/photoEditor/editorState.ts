import { clampOffset, minZoomToCover, squareFrame, type Size } from './coverage';

export type FilterKey =
  | 'none'
  | 'clean'
  | 'bright'
  | 'warm'
  | 'cool'
  | 'mono'
  | 'sepia'
  | 'vivid'
  | 'soft'
  | 'dusk';

export type AdjustmentKey =
  | 'brightness'
  | 'contrast'
  | 'saturation'
  | 'warmth'
  | 'highlights'
  | 'shadows'
  | 'vignette';

export interface Adjustments {
  brightness: number; // -100..100, 0 = neutral (CSS filter)
  contrast: number; // CSS filter
  saturation: number; // CSS filter
  warmth: number; // -100..100, cool → warm (pixel pass; preview = CSS approx)
  highlights: number; // -100..100, + pulls bright areas down (pixel pass)
  shadows: number; // -100..100, + lifts dark areas (pixel pass)
  vignette: number; // 0..100, darkens corners (pixel pass; negative is no-op)
}

/** Adjustments that require a per-pixel canvas pass at export time. The rest
 *  are pure CSS filters and stay on the GPU during live preview. */
export const PIXEL_PASS_CHANNELS: ReadonlyArray<AdjustmentKey> = [
  'warmth',
  'highlights',
  'shadows',
  'vignette',
];

/**
 * What the cropper measured: the photo's on-screen size at zoom 1 (before
 * rotation) and the container it sits in. Everything the frame and the
 * coverage rule need is derived from these two and the rotation.
 */
export interface Geometry {
  media: Size;
  container: Size;
}

/** Zoom ceiling above the cover minimum. */
export const MAX_ZOOM = 5;

export interface EditorState {
  // react-easy-crop inputs. `crop` is the photo centre's offset from the
  // frame centre, in display px. Photos are always square — the one shape
  // the app shows them in — so there's no aspect choice.
  crop: { x: number; y: number };
  zoom: number; // minZoom(state)..max(MAX_ZOOM, minZoom)
  geometry: Geometry | null;
  // transforms
  rotation: number; // 0/90/180/270, CW positive
  straighten: number; // -45..45, folded into Cropper rotation
  flipH: boolean;
  flipV: boolean;
  // look
  filter: FilterKey;
  adjustments: Adjustments;
  // ui
  tab: 'crop' | 'adjust' | 'filter';
  activeChannel: AdjustmentKey;
  showGrid: boolean;
}

export const DEFAULT_ADJUSTMENTS: Adjustments = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  highlights: 0,
  shadows: 0,
  vignette: 0,
};

export const DEFAULT_STATE: EditorState = {
  crop: { x: 0, y: 0 },
  zoom: 1,
  geometry: null,
  rotation: 0,
  straighten: 0,
  flipH: false,
  flipV: false,
  filter: 'none',
  adjustments: { ...DEFAULT_ADJUSTMENTS },
  tab: 'crop',
  activeChannel: 'brightness',
  showGrid: false,
};

export type Action =
  | { type: 'SET_CROP'; crop: { x: number; y: number } }
  | { type: 'SET_ZOOM'; zoom: number }
  | { type: 'SET_MEDIA'; media: Size }
  | { type: 'SET_CONTAINER'; container: Size }
  | { type: 'ROTATE_CW' }
  | { type: 'ROTATE_CCW' }
  | { type: 'SET_STRAIGHTEN'; degrees: number }
  | { type: 'FLIP_H' }
  | { type: 'FLIP_V' }
  | { type: 'SET_FILTER'; filter: FilterKey }
  | { type: 'SET_ADJ'; key: AdjustmentKey; value: number }
  | { type: 'RESET_ADJ'; key: AdjustmentKey }
  | { type: 'SET_TAB'; tab: EditorState['tab'] }
  | { type: 'SET_ACTIVE_CHANNEL'; channel: AdjustmentKey }
  | { type: 'TOGGLE_GRID' }
  | { type: 'RESET' };

function sameSize(a: Size | undefined, b: Size): boolean {
  return !!a && Math.abs(a.width - b.width) < 0.01 && Math.abs(a.height - b.height) < 0.01;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

/** The photo's total turn: quarter turns plus straighten. */
export function totalRotation(state: EditorState): number {
  return state.rotation + state.straighten;
}

/** The square crop frame, in display px; null until the cropper has measured. */
export function frameOf(state: EditorState): Size | null {
  const g = state.geometry;
  if (!g || g.media.width <= 0 || g.container.width <= 0) return null;
  return squareFrame(g.media, g.container, state.rotation);
}

/** The least zoom that keeps the frame on the photo at the current angle. */
export function minZoomOf(state: EditorState): number {
  const frame = frameOf(state);
  return frame && state.geometry ? minZoomToCover(frame, state.geometry.media, totalRotation(state)) : 1;
}

/**
 * The invariant every action ends on: the frame lies entirely on the photo.
 * Zoom rises to the cover minimum (straightening zooms in, like a phone's
 * own editor) and the offset moves to the nearest legal one. Without
 * measurements yet, the defaults (centred, zoom 1) are already covered.
 */
function normalize(state: EditorState): EditorState {
  const frame = frameOf(state);
  if (!frame || !state.geometry) {
    const zoom = clamp(state.zoom, 1, MAX_ZOOM);
    return zoom === state.zoom ? state : { ...state, zoom };
  }
  const deg = totalRotation(state);
  const lo = minZoomToCover(frame, state.geometry.media, deg);
  const zoom = clamp(state.zoom, lo, Math.max(MAX_ZOOM, lo));
  const crop = clampOffset(state.crop, frame, state.geometry.media, zoom, deg);
  if (zoom === state.zoom && crop === state.crop) return state;
  return { ...state, zoom, crop };
}

export function editorReducer(state: EditorState, action: Action): EditorState {
  return normalize(reduce(state, action));
}

function reduce(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_CROP':
      return { ...state, crop: action.crop };
    case 'SET_ZOOM':
      return { ...state, zoom: action.zoom };
    // Measurements arrive on every layout pass; only a real change counts.
    case 'SET_MEDIA':
      if (sameSize(state.geometry?.media, action.media)) return state;
      return { ...state, geometry: { container: state.geometry?.container ?? { width: 0, height: 0 }, media: action.media } };
    case 'SET_CONTAINER':
      if (sameSize(state.geometry?.container, action.container)) return state;
      return { ...state, geometry: { media: state.geometry?.media ?? { width: 0, height: 0 }, container: action.container } };
    // A quarter turn changes which way is "across", so the offset is
    // re-centred rather than carried into a frame it was never measured for.
    case 'ROTATE_CW':
      return { ...state, rotation: (state.rotation + 90) % 360, crop: { x: 0, y: 0 } };
    case 'ROTATE_CCW':
      return { ...state, rotation: (state.rotation + 270) % 360, crop: { x: 0, y: 0 } };
    case 'SET_STRAIGHTEN':
      return { ...state, straighten: clamp(action.degrees, -45, 45) };
    case 'FLIP_H':
      return { ...state, flipH: !state.flipH };
    case 'FLIP_V':
      return { ...state, flipV: !state.flipV };
    case 'SET_FILTER':
      return { ...state, filter: action.filter };
    case 'SET_ADJ': {
      // Most channels are bipolar; vignette is 0..100 (negative is meaningless).
      const min = action.key === 'vignette' ? 0 : -100;
      return {
        ...state,
        adjustments: {
          ...state.adjustments,
          [action.key]: clamp(action.value, min, 100),
        },
      };
    }
    case 'RESET_ADJ':
      return {
        ...state,
        adjustments: { ...state.adjustments, [action.key]: 0 },
      };
    case 'SET_TAB':
      return { ...state, tab: action.tab };
    case 'SET_ACTIVE_CHANNEL':
      return { ...state, activeChannel: action.channel };
    case 'TOGGLE_GRID':
      return { ...state, showGrid: !state.showGrid };
    case 'RESET':
      // Keep the user on their current tab, and keep what the cropper measured.
      return { ...DEFAULT_STATE, tab: state.tab, geometry: state.geometry };
    default:
      return state;
  }
}

/** True if the user has changed anything from the defaults (i.e. Reset should be active). */
export function isDirty(state: EditorState): boolean {
  if (
    state.zoom !== 1 ||
    state.crop.x !== 0 ||
    state.crop.y !== 0 ||
    state.rotation !== 0 ||
    state.straighten !== 0 ||
    state.flipH ||
    state.flipV ||
    state.filter !== 'none'
  ) {
    return true;
  }
  for (const k of Object.keys(state.adjustments) as AdjustmentKey[]) {
    if (state.adjustments[k] !== 0) return true;
  }
  return false;
}
