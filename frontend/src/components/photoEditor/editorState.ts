import type { Area } from 'react-easy-crop';

export type AspectKey = '1:1' | '4:5' | '16:9' | '3:4' | '9:16' | 'free';
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

export interface EditorState {
  // react-easy-crop inputs
  crop: { x: number; y: number };
  zoom: number; // 1..5
  aspect: AspectKey;
  croppedAreaPixels: Area | null;
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

export const ASPECT_RATIOS: Record<AspectKey, number | undefined> = {
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
  '3:4': 3 / 4,
  '9:16': 9 / 16,
  free: undefined,
};

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
  aspect: '1:1',
  croppedAreaPixels: null,
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
  | { type: 'SET_ASPECT'; aspect: AspectKey }
  | { type: 'SET_CROPPED_AREA'; area: Area }
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

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function editorReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'SET_CROP':
      return { ...state, crop: action.crop };
    case 'SET_ZOOM':
      return { ...state, zoom: clamp(action.zoom, 1, 5) };
    case 'SET_ASPECT':
      // Changing aspect invalidates the crop rect; re-center + reset zoom so
      // the user never lands on an out-of-bounds crop.
      return { ...state, aspect: action.aspect, crop: { x: 0, y: 0 }, zoom: 1 };
    case 'SET_CROPPED_AREA':
      return { ...state, croppedAreaPixels: action.area };
    case 'ROTATE_CW':
      return { ...state, rotation: (state.rotation + 90) % 360 };
    case 'ROTATE_CCW':
      return { ...state, rotation: (state.rotation + 270) % 360 };
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
      return { ...DEFAULT_STATE, tab: state.tab }; // keep the user on their current tab
    default:
      return state;
  }
}

/** True if the user has changed anything from the defaults (i.e. Reset should be active). */
export function isDirty(state: EditorState): boolean {
  if (
    state.zoom !== 1 ||
    state.aspect !== DEFAULT_STATE.aspect ||
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
