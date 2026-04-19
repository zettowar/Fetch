import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createDog, getDog, updateDog, deleteDog, DOG_TRAITS, MIX_TYPES, MAX_BREEDS_PER_DOG } from '../api/dogs';
import { deletePhoto, uploadPhoto } from '../api/photos';
import PhotoUploader from '../components/PhotoUploader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BreedMultiSelect from '../components/ui/BreedMultiSelect';
import type { Breed, MixType } from '../types';
import { photoUrl } from '../utils/time';
import { apiErrorMessage } from '../utils/apiError';

interface PendingPhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
}

export default function DogEditorPage() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [mixType, setMixType] = useState<MixType>('mystery_mutt');
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<number | null>(null);

  const { data: dog, refetch } = useQuery({
    queryKey: ['dog', id],
    queryFn: () => getDog(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (dog) {
      setName(dog.name);
      setMixType(dog.mix_type);
      setBreeds(dog.breeds || []);
      setBio(dog.bio || '');
      setBirthday(dog.birthday || '');
      setTraits(dog.traits || []);
    }
  }, [dog]);

  // Release object URLs when pending photos go away (on unmount or removal).
  useEffect(() => {
    return () => {
      pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allowedBreedCap =
    mixType === 'purebred' ? 1 : mixType === 'cross' ? 2 : mixType === 'mystery_mutt' ? 0 : MAX_BREEDS_PER_DOG;

  const handleMixChange = (next: MixType) => {
    setMixType(next);
    if (next === 'mystery_mutt') setBreeds([]);
    else if (next === 'purebred') setBreeds((prev) => prev.slice(0, 1));
    else if (next === 'cross') setBreeds((prev) => prev.slice(0, 2));
  };

  const addPendingPhoto = (blob: Blob) => {
    const id = Math.random().toString(36).slice(2);
    const previewUrl = URL.createObjectURL(blob);
    setPendingPhotos((prev) => [...prev, { id, blob, previewUrl }]);
  };

  const removePendingPhoto = (removeId: string) => {
    setPendingPhotos((prev) => {
      const target = prev.find((p) => p.id === removeId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== removeId);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mixType === 'purebred' && breeds.length === 0) {
      toast.error('Pick one breed, or switch to Mystery mutt');
      return;
    }
    if (mixType === 'cross' && breeds.length < 2) {
      toast.error('A cross needs two parent breeds');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        mix_type: mixType,
        breed_ids: breeds.map((b) => b.id),
        bio: bio || undefined,
        birthday: birthday || undefined,
        traits,
      };
      if (isEditing) {
        await updateDog(id!, payload);
        toast.success('Dog updated!');
        queryClient.invalidateQueries({ queryKey: ['dog', id] });
      } else {
        // Create the dog first, then upload any queued photos in sequence.
        const newDog = await createDog(payload);
        let uploadFailures = 0;
        for (let i = 0; i < pendingPhotos.length; i++) {
          setUploadingPhotoIndex(i);
          try {
            const file = new File([pendingPhotos[i].blob], 'photo.jpg', { type: 'image/jpeg' });
            await uploadPhoto(newDog.id, file);
          } catch {
            uploadFailures += 1;
          }
        }
        setUploadingPhotoIndex(null);
        // Release blob URLs now that they're no longer needed.
        pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));

        if (uploadFailures === 0) {
          toast.success(pendingPhotos.length > 0 ? 'Dog created with photos!' : 'Dog created!');
        } else {
          toast.error(
            `Dog created, but ${uploadFailures} photo${uploadFailures > 1 ? 's' : ''} failed to upload. You can add them on the profile page.`,
          );
        }
        queryClient.invalidateQueries({ queryKey: ['my-dogs'] });
        navigate(`/dogs/${newDog.id}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['my-dogs'] });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
      setUploadingPhotoIndex(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this dog?')) return;
    try {
      await deleteDog(id!);
      toast.success('Dog removed');
      queryClient.invalidateQueries({ queryKey: ['my-dogs'] });
      navigate('/dogs');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete'));
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId);
      toast.success('Photo deleted');
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to delete photo'));
    }
  };

  return (
    <div className="p-4">
      <BackButton fallback="/dogs" />
      <h1 className="text-2xl font-bold mb-4">{isEditing ? 'Edit Dog' : 'Add a Dog'}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Breed type</label>
          <div className="grid grid-cols-2 gap-2">
            {MIX_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleMixChange(opt.value)}
                className={`flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-colors ${
                  mixType === opt.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-brand-300'
                }`}
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-gray-400">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {mixType !== 'mystery_mutt' && (
          <BreedMultiSelect
            value={breeds}
            onChange={setBreeds}
            max={allowedBreedCap}
            label={
              mixType === 'purebred'
                ? 'Breed'
                : mixType === 'cross'
                ? 'Parent breeds (pick 2)'
                : 'Breeds in the mix'
            }
          />
        )}

        <Input
          label="Birthday"
          type="date"
          value={birthday}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthday(e.target.value)}
        />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Bio</label>
          <textarea
            className="rounded-xl border border-gray-300 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 resize-none"
            rows={3}
            maxLength={500}
            placeholder="Tell us about your dog..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="text-xs text-gray-400 text-right">{bio.length}/500</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700">Personality traits</label>
          <div className="flex flex-wrap gap-2">
            {DOG_TRAITS.map((trait) => {
              const selected = traits.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  onClick={() =>
                    setTraits((prev) =>
                      selected ? prev.filter((t) => t !== trait) : [...prev, trait]
                    )
                  }
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    selected
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'
                  }`}
                >
                  {trait}
                </button>
              );
            })}
          </div>
        </div>

        {/* Photos — on the initial add page we queue them client-side and
            upload after the dog is created. On the edit page the existing
            section below handles photos against an existing dog id. */}
        {!isEditing && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">
              Photos <span className="text-xs text-gray-400 font-normal ml-1">(optional)</span>
            </label>

            {pendingPhotos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {pendingPhotos.map((p, idx) => {
                  const isUploading = uploadingPhotoIndex === idx;
                  const isUploaded = uploadingPhotoIndex !== null && uploadingPhotoIndex > idx;
                  return (
                    <div key={p.id} className="relative aspect-square group">
                      <img
                        src={p.previewUrl}
                        alt={`Pending photo ${idx + 1}`}
                        className="h-full w-full object-cover rounded-lg"
                      />
                      {idx === 0 && (
                        <span className="absolute bottom-1 left-1 bg-brand-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                      {(isUploading || isUploaded) && (
                        <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center">
                          {isUploaded ? (
                            <span className="text-white text-lg">✓</span>
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          )}
                        </div>
                      )}
                      {!saving && (
                        <button
                          type="button"
                          onClick={() => removePendingPhoto(p.id)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          aria-label="Remove photo"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {!saving && (
              <PhotoUploader
                onSelect={addPendingPhoto}
                compact={pendingPhotos.length > 0}
              />
            )}
            {pendingPhotos.length === 0 && (
              <p className="text-[11px] text-gray-400">
                Your first photo becomes the primary. You can add more any time from the profile.
              </p>
            )}
          </div>
        )}

        <Button type="submit" loading={saving} className="w-full">
          {isEditing
            ? 'Save Changes'
            : pendingPhotos.length > 0
            ? `Create Dog & Upload ${pendingPhotos.length} Photo${pendingPhotos.length > 1 ? 's' : ''}`
            : 'Create Dog'}
        </Button>
      </form>

      {isEditing && dog && (
        <>
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">Photos</h2>
            <PhotoUploader dogId={id!} onUploaded={() => refetch()} />
            {dog.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {dog.photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img
                      src={photoUrl(photo)}
                      alt=""
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label="Delete photo"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 border-t pt-4">
            <Button variant="danger" onClick={handleDelete} className="w-full">
              Remove Dog
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
