import { useState, useCallback } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import Button from './ui/Button';

interface CropModalProps {
  imageSrc: string;
  onConfirm: (croppedBlob: Blob) => void;
  onCancel: () => void;
}

async function getCroppedBlob(imageSrc: string, cropArea: Area): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', reject);
    image.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = cropArea.width;
  canvas.height = cropArea.height;
  const ctx = canvas.getContext('2d')!;

  ctx.drawImage(
    img,
    cropArea.x, cropArea.y,
    cropArea.width, cropArea.height,
    0, 0,
    cropArea.width, cropArea.height,
  );

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas toBlob failed'));
    }, 'image/jpeg', 0.92);
  });
}

export default function CropModal({ imageSrc, onConfirm, onCancel }: CropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [confirming, setConfirming] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedArea(croppedAreaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setConfirming(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedArea);
      onConfirm(blob);
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Cropper area */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          showGrid={false}
          cropShape="rect"
          style={{
            containerStyle: { background: '#000' },
            cropAreaStyle: { borderColor: '#fff', borderWidth: 2 },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div className="px-6 pt-4 pb-2 bg-black">
        <label className="block text-xs text-gray-400 mb-2 text-center tracking-widest uppercase">
          Zoom
        </label>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full accent-white"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 px-6 pb-8 pt-2 bg-black">
        <Button variant="ghost" className="flex-1 text-white border-white/30" onClick={onCancel}>
          Cancel
        </Button>
        <Button className="flex-1" loading={confirming} onClick={handleConfirm}>
          Use Photo
        </Button>
      </div>
    </div>
  );
}
