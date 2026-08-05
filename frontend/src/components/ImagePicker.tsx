import { useRef, type ReactNode } from 'react';

/**
 * Camera-or-gallery image picking, shared by every photo entry point.
 *
 * Two things matter here, and both were bugs before this component existed:
 *
 *  1. `accept` MUST be `image/*`. Listing concrete MIME types
 *     (`image/jpeg,image/png,image/webp`) makes Android Chrome open the
 *     *documents* picker, which has no camera source at all — that's why
 *     Android users could only pick from the gallery. Type checking belongs
 *     in JS after the file is chosen, not in the accept attribute.
 *  2. Only a *separate* input carrying `capture="environment"` opens the
 *     camera directly. Android's own chooser buries the camera behind the
 *     document UI even with `image/*`, and iOS shows a sheet the user still
 *     has to navigate. Offering two explicit buttons is one tap either way.
 *
 * On desktop, `capture` is meaningless and there's usually no camera, so the
 * picker collapses to a single file chooser.
 */

/** Touch-primary devices are the ones with a usable camera behind `capture`. */
export function hasCamera(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

interface ImagePickerProps {
  onPick: (file: File) => void;
  disabled?: boolean;
  /** Render the trigger(s). `openCamera` is absent on non-touch devices. */
  children: (actions: { openGallery: () => void; openCamera?: () => void }) => ReactNode;
}

export default function ImagePicker({ onPick, disabled, children }: ImagePickerProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const camera = hasCamera();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset first: picking the same file twice in a row otherwise fires no
    // change event and the second attempt looks like it did nothing.
    e.target.value = '';
    if (file) onPick(file);
  };

  return (
    <>
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        disabled={disabled}
        onChange={handleChange}
      />
      {camera && (
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          disabled={disabled}
          onChange={handleChange}
        />
      )}
      {children({
        openGallery: () => galleryRef.current?.click(),
        openCamera: camera ? () => cameraRef.current?.click() : undefined,
      })}
    </>
  );
}
