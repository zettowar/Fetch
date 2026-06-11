/**
 * Replicate the CSS `filter` color functions as a single composed color
 * matrix, applied per-pixel at export time.
 *
 * Why not `ctx.filter`? Safari's canvas 2D `filter` is unreliable — most
 * notably it is a silent no-op when the `drawImage` source is another canvas,
 * which is exactly how the editor composes its rotate/crop buffer. That
 * dropped every preset/brightness/contrast/saturation edit from saved photos
 * (the preview looked right because it filters a DOM <img>, which Safari does
 * support). A color matrix reproduces the same math deterministically in
 * every browser.
 *
 * Supports the functions actually emitted by presets.ts / adjFilterString:
 *   brightness() contrast() saturate() sepia() hue-rotate() grayscale()
 * Coefficients are the canonical SVG/CSS Filter Effects values, so the output
 * tracks what the browser draws in the live preview. Unknown functions are
 * skipped (they simply don't contribute).
 *
 * Matrix layout: 12 numbers = 3 rows (R,G,B) × 4 cols (R, G, B, offset).
 * Channels and the offset column are both in 0..255 units. Alpha is untouched.
 */

export type ColorMatrix = number[]; // length 12

const IDENTITY: ColorMatrix = [
  1, 0, 0, 0,
  0, 1, 0, 0,
  0, 0, 1, 0,
];

export function isIdentityMatrix(m: ColorMatrix, eps = 1e-3): boolean {
  for (let i = 0; i < 12; i++) {
    if (Math.abs(m[i] - IDENTITY[i]) > eps) return false;
  }
  return true;
}

/** Compose two matrices: apply `a` first, then `b` (result = b ∘ a). */
function compose(b: ColorMatrix, a: ColorMatrix): ColorMatrix {
  const out = new Array<number>(12).fill(0);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      let sum =
        b[row * 4 + 0] * a[0 * 4 + col] +
        b[row * 4 + 1] * a[1 * 4 + col] +
        b[row * 4 + 2] * a[2 * 4 + col];
      if (col === 3) sum += b[row * 4 + 3]; // b's own translation
      out[row * 4 + col] = sum;
    }
  }
  return out;
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

// --- Per-function matrices (canonical CSS / SVG feColorMatrix) -------------

function brightnessM(b: number): ColorMatrix {
  return [b, 0, 0, 0, 0, b, 0, 0, 0, 0, b, 0];
}

function contrastM(c: number): ColorMatrix {
  const o = 127.5 * (1 - c); // (0.5 − 0.5·c) mapped into 0..255
  return [c, 0, 0, o, 0, c, 0, o, 0, 0, c, o];
}

function saturateM(s: number): ColorMatrix {
  return [
    0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0,
    0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0,
    0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s, 0,
  ];
}

function sepiaM(amount: number): ColorMatrix {
  const inv = 1 - clamp01(amount);
  return [
    0.393 + 0.607 * inv, 0.769 - 0.769 * inv, 0.189 - 0.189 * inv, 0,
    0.349 - 0.349 * inv, 0.686 + 0.314 * inv, 0.168 - 0.168 * inv, 0,
    0.272 - 0.272 * inv, 0.534 - 0.534 * inv, 0.131 + 0.869 * inv, 0,
  ];
}

function grayscaleM(amount: number): ColorMatrix {
  const inv = 1 - clamp01(amount);
  return [
    0.2126 + 0.7874 * inv, 0.7152 - 0.7152 * inv, 0.0722 - 0.0722 * inv, 0,
    0.2126 - 0.2126 * inv, 0.7152 + 0.2848 * inv, 0.0722 - 0.0722 * inv, 0,
    0.2126 - 0.2126 * inv, 0.7152 - 0.7152 * inv, 0.0722 + 0.9278 * inv, 0,
  ];
}

function hueRotateM(deg: number): ColorMatrix {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return [
    0.213 + c * 0.787 - s * 0.213, 0.715 - c * 0.715 - s * 0.715, 0.072 - c * 0.072 + s * 0.928, 0,
    0.213 - c * 0.213 + s * 0.143, 0.715 + c * 0.285 + s * 0.140, 0.072 - c * 0.072 - s * 0.283, 0,
    0.213 - c * 0.213 - s * 0.787, 0.715 - c * 0.715 + s * 0.715, 0.072 + c * 0.928 + s * 0.072, 0,
  ];
}

/**
 * Parse a CSS `filter` string (e.g. "saturate(1.35) contrast(1.12)") into one
 * composed color matrix. Functions compose left-to-right, matching CSS.
 */
export function filterStringToColorMatrix(css: string): ColorMatrix {
  let m = IDENTITY.slice();
  if (!css || css === 'none') return m;

  const re = /([a-z-]+)\(([^)]*)\)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(css)) !== null) {
    const fn = match[1].toLowerCase();
    const value = parseFloat(match[2]); // "1.05" / "-8deg" → -8 / "0.6"
    if (Number.isNaN(value)) continue;

    let fm: ColorMatrix | null = null;
    switch (fn) {
      case 'brightness': fm = brightnessM(value); break;
      case 'contrast': fm = contrastM(value); break;
      case 'saturate': fm = saturateM(value); break;
      case 'sepia': fm = sepiaM(value); break;
      case 'grayscale': fm = grayscaleM(value); break;
      case 'hue-rotate': fm = hueRotateM(value); break;
      default: fm = null; // unsupported function — ignore
    }
    if (fm) m = compose(fm, m);
  }
  return m;
}

/**
 * Apply a composed color matrix to ImageData in place. Alpha is left as-is;
 * the backing Uint8ClampedArray rounds and clamps each channel to 0..255.
 */
export function applyColorMatrix(imageData: ImageData, m: ColorMatrix): void {
  const d = imageData.data;
  const m00 = m[0], m01 = m[1], m02 = m[2], m03 = m[3];
  const m10 = m[4], m11 = m[5], m12 = m[6], m13 = m[7];
  const m20 = m[8], m21 = m[9], m22 = m[10], m23 = m[11];
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = m00 * r + m01 * g + m02 * b + m03;
    d[i + 1] = m10 * r + m11 * g + m12 * b + m13;
    d[i + 2] = m20 * r + m21 * g + m22 * b + m23;
  }
}
