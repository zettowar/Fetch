import { useState } from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';
import { uploadPhoto } from '../api/photos';
import PhotoEditor from './photoEditor';
import ImagePicker from './ImagePicker';
import { canDecodeImage } from '../utils/image';
import toast from 'react-hot-toast';

interface PhotoUploaderProps {
  /** Upload-mode: POST each cropped photo to /pets/:petId/photos. */
  petId?: string;
  onUploaded?: () => void;
  /** Queue-mode: hand the cropped blob to the parent (no server call).
   * Used on the "add a pet" page where the pet doesn't exist yet. */
  onSelect?: (blob: Blob) => void;
  compact?: boolean;
}

export default function PhotoUploader({ petId, onUploaded, onSelect, compact }: PhotoUploaderProps) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);

  const isQueueMode = !!onSelect;

  const validateFile = (file: File): boolean => {
    // Deliberately generous: the editor re-encodes to a bounded JPEG before
    // anything is uploaded, so the server's 10MB/format limits apply to our
    // output, not to the 12MP original the camera just handed us. The cap
    // that's left only exists to keep the browser from choking on a decode.
    if (file.size > 30 * 1024 * 1024) {
      toast.error('That photo is too large (max 30MB)');
      return false;
    }
    // Android content providers routinely hand back an empty `type` for
    // gallery picks (Google Photos and several OEM galleries do it), and the
    // old allow-list turned those into "Only JPEG, PNG, and WebP allowed" on a
    // perfectly good photo. An absent type tells us nothing — let the decode
    // probe in handleFile be the judge, and only reject a type we're sure of.
    if (file.type && !file.type.startsWith('image/')) {
      toast.error('That file isn’t an image');
      return false;
    }
    return true;
  };

  const handleFile = async (file: File) => {
    if (!validateFile(file)) return;
    const url = URL.createObjectURL(file);
    // Formats the picker offers but the browser can't open (HEIC on most
    // Androids) would otherwise reach the editor as a blank frame.
    if (!(await canDecodeImage(url))) {
      URL.revokeObjectURL(url);
      toast.error('Couldn’t read that photo — try a JPEG, PNG, or WebP.');
      return;
    }
    setCropSrc(url);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);

    if (isQueueMode) {
      // Parent will hold onto the blob until the pet exists; we just hand it over.
      onSelect!(blob);
      return;
    }

    if (!petId) return;
    setUploading(true);
    setProgress(0);
    try {
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      const photo = await uploadPhoto(petId, file, setProgress);
      // A photo held by moderation still uploads fine — saying "uploaded!" and
      // then showing nothing publicly is what read as a failed upload.
      if (photo.moderation_status && photo.moderation_status !== 'approved') {
        toast('Photo uploaded — it’s being reviewed before it goes live.', { icon: '⏳' });
      } else {
        toast.success('Photo uploaded!');
      }
      onUploaded?.();
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (cropSrc) {
    return (
      <PhotoEditor
        imageSrc={cropSrc}
        onConfirm={handleCropConfirm}
        onCancel={handleCropCancel}
      />
    );
  }

  if (uploading) {
    return (
      <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
          <div
            className="bg-brand-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Uploading... {progress}%</p>
      </div>
    );
  }

  return (
    <ImagePicker onPick={handleFile}>
      {({ openGallery, openCamera }) => (
        <div
          className={`rounded-xl transition-all ${
            dragOver
              ? 'border-2 border-brand-500 bg-brand-50 dark:bg-brand-500/10'
              : compact
              ? 'border border-dashed border-gray-300 dark:border-gray-700'
              : 'border-2 border-dashed border-gray-300 dark:border-gray-700'
          } ${compact ? 'p-2.5' : 'p-4'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {!compact && (
            <p className="text-center font-medium text-brand-600 mb-2.5">Add a photo</p>
          )}
          <div className="flex items-center gap-2">
            {/* On a phone these are two distinct one-tap paths. On desktop
                there's no camera, so only the picker renders. */}
            {openCamera && (
              <button
                type="button"
                onClick={openCamera}
                className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                <Camera size={16} aria-hidden />
                Take photo
              </button>
            )}
            <button
              type="button"
              onClick={openGallery}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 hover:border-brand-400 hover:text-brand-600 transition-colors"
            >
              <ImageIcon size={16} aria-hidden />
              {openCamera ? 'Choose photo' : compact ? 'Add another photo' : 'Choose a photo'}
            </button>
          </div>
          {!compact && !openCamera && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2 text-center">
              Or drag &amp; drop one here.
            </p>
          )}
        </div>
      )}
    </ImagePicker>
  );
}
