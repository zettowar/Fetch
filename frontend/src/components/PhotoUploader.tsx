import { useState, useRef } from 'react';
import { uploadPhoto } from '../api/photos';
import PhotoEditor from './photoEditor';
import toast from 'react-hot-toast';

interface PhotoUploaderProps {
  /** Upload-mode: POST each cropped photo to /dogs/:dogId/photos. */
  dogId?: string;
  onUploaded?: () => void;
  /** Queue-mode: hand the cropped blob to the parent (no server call).
   * Used on the "add a dog" page where the dog doesn't exist yet. */
  onSelect?: (blob: Blob) => void;
  compact?: boolean;
}

export default function PhotoUploader({ dogId, onUploaded, onSelect, compact }: PhotoUploaderProps) {
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isQueueMode = !!onSelect;

  const validateFile = (file: File): boolean => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File too large (max 10MB)');
      return false;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Only JPEG, PNG, and WebP allowed');
      return false;
    }
    return true;
  };

  const handleFile = (file: File) => {
    if (!validateFile(file)) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
  };

  const handleCropConfirm = async (blob: Blob) => {
    setCropSrc(null);

    if (isQueueMode) {
      // Parent will hold onto the blob until the dog exists; we just hand it over.
      onSelect!(blob);
      return;
    }

    if (!dogId) return;
    setUploading(true);
    setProgress(0);
    try {
      const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' });
      await uploadPhoto(dogId, file, setProgress);
      toast.success('Photo uploaded!');
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
    if (inputRef.current) inputRef.current.value = '';
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
      <div className="rounded-xl bg-gray-50 p-4">
        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
          <div
            className="bg-brand-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 text-center">Uploading... {progress}%</p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-xl cursor-pointer transition-all ${
        dragOver
          ? 'border-2 border-brand-500 bg-brand-50'
          : compact
          ? 'border border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50'
          : 'border-2 border-dashed border-gray-300 hover:border-brand-400 hover:bg-brand-50'
      } ${compact ? 'p-3' : 'p-5'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = '';
        }}
      />
      <div className={`flex items-center gap-3 ${compact ? '' : 'flex-col'}`}>
        <span className={compact ? 'text-lg' : 'text-2xl'}>{'\ud83d\udcf7'}</span>
        <div className={compact ? '' : 'text-center'}>
          <p className={`font-medium ${compact ? 'text-sm text-brand-600' : 'text-brand-600'}`}>
            {compact ? 'Add another photo' : 'Add a photo'}
          </p>
          {!compact && (
            <p className="text-xs text-gray-400 mt-0.5">
              Tap to choose or drag & drop. JPEG, PNG, WebP up to 10MB.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
