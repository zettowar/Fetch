import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, PawPrint as DogIcon, Pencil, QrCode, X } from 'lucide-react';
import BackButton from '../components/ui/BackButton';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { claimTag, getTagsForPet, unlinkTag } from '../api/tags';
import { usePawBurst } from '../components/flair/PawBurst';
import { createPet, getPet, updatePet, deletePet, MIX_TYPES, MAX_BREEDS_PER_PET } from '../api/pets';
import {
  getTraitOptions,
  normalizeTrait,
  validateTrait,
  MAX_TRAITS_PER_PET,
  MAX_TRAIT_LENGTH,
} from '../api/traits';
import { deletePhoto, uploadPhoto } from '../api/photos';
import PhotoUploader from '../components/PhotoUploader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import BreedMultiSelect from '../components/ui/BreedMultiSelect';
import type { Breed, MixType, Species } from '../types';
import PetPhoto, { InReviewBadge, isInReview } from '../components/PetPhoto';
import { apiErrorMessage } from '../utils/apiError';

interface PendingPhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
}

export default function PetEditorPage() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [species, setSpecies] = useState<Species>('dog');
  const [mixType, setMixType] = useState<MixType>('mystery_mutt');
  const [breeds, setBreeds] = useState<Breed[]>([]);
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [traitDraft, setTraitDraft] = useState('');
  const [traitError, setTraitError] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(true);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingPhotoIndex, setUploadingPhotoIndex] = useState<number | null>(null);
  const { fire, PawBurstLayer } = usePawBurst();

  const { data: pet, refetch } = useQuery({
    queryKey: ['pet', id],
    queryFn: () => getPet(id!),
    enabled: isEditing,
  });

  // The suggested chips. Owners aren't limited to them — anything they type in
  // the box below is accepted and queued for admin review.
  const { data: traitOptions = [] } = useQuery({
    queryKey: ['trait-options', species],
    queryFn: () => getTraitOptions(species),
    staleTime: 5 * 60_000,
  });

  const suggested = traitOptions.map((t) => t.label);
  // Traits the owner made up (or that are still pending) have no chip of their
  // own, so render them alongside the suggestions as already-selected.
  const customTraits = traits.filter((t) => !suggested.includes(t));
  const atTraitCap = traits.length >= MAX_TRAITS_PER_PET;

  const addTrait = () => {
    const problem = validateTrait(traitDraft);
    if (problem) {
      setTraitError(problem);
      return;
    }
    const label = normalizeTrait(traitDraft);
    if (traits.some((t) => t.toLowerCase() === label.toLowerCase())) {
      setTraitError(`${label} is already on the list`);
      return;
    }
    if (atTraitCap) {
      setTraitError(`Up to ${MAX_TRAITS_PER_PET} traits`);
      return;
    }
    setTraits((prev) => [...prev, label]);
    setTraitDraft('');
    setTraitError(null);
  };

  const toggleTrait = (trait: string) => {
    setTraitError(null);
    setTraits((prev) => {
      if (prev.includes(trait)) return prev.filter((t) => t !== trait);
      if (prev.length >= MAX_TRAITS_PER_PET) {
        setTraitError(`Up to ${MAX_TRAITS_PER_PET} traits`);
        return prev;
      }
      return [...prev, trait];
    });
  };

  // Seed the form from the loaded pet exactly once. Keying this on the whole
  // `pet` object re-ran it on every refetch — and uploading or deleting a photo
  // refetches — so any unsaved text the user had typed was silently reverted.
  const seededPetId = useRef<string | null>(null);
  useEffect(() => {
    if (!pet || seededPetId.current === pet.id) return;
    seededPetId.current = pet.id;
    setName(pet.name);
    setSpecies(pet.species);
    setMixType(pet.mix_type);
    setBreeds(pet.breeds || []);
    setBio(pet.bio || '');
    setBirthday(pet.birthday || '');
    setTraits(pet.traits || []);
    setIsPublic(pet.is_public);
  }, [pet]);

  // Release object URLs on unmount. The cleanup has to read through a ref:
  // with an empty dep array it closed over the *initial* (empty) pendingPhotos,
  // so every preview URL leaked for the lifetime of the page.
  const pendingPhotosRef = useRef(pendingPhotos);
  pendingPhotosRef.current = pendingPhotos;
  useEffect(() => {
    return () => {
      pendingPhotosRef.current.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    };
  }, []);

  const allowedBreedCap =
    mixType === 'purebred' ? 1 : mixType === 'cross' ? 2 : mixType === 'mystery_mutt' ? 0 : MAX_BREEDS_PER_PET;

  const handleSpeciesChange = (next: Species) => {
    if (next === species) return;
    // Breeds are species-specific, so clear them. For traits, drop only the
    // ones scoped to the species we're leaving ("Loves fetch" on a cat) —
    // shared suggestions and the owner's own entries carry over.
    const speciesOnly = new Set(
      traitOptions.filter((t) => t.species === species).map((t) => t.label),
    );
    setSpecies(next);
    setBreeds([]);
    setTraits((prev) => prev.filter((t) => !speciesOnly.has(t)));
  };

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
        species,
        mix_type: mixType,
        breed_ids: breeds.map((b) => b.id),
        bio: bio || undefined,
        birthday: birthday || undefined,
        traits,
        is_public: isPublic,
      };
      if (isEditing) {
        await updatePet(id!, payload);
        toast.success('Pet updated!');
        queryClient.invalidateQueries({ queryKey: ['pet', id] });
      } else {
        // Create the pet first, then upload any queued photos in sequence.
        const newDog = await createPet(payload);
        fire();
        let uploadFailures = 0;
        let inReview = 0;
        for (let i = 0; i < pendingPhotos.length; i++) {
          setUploadingPhotoIndex(i);
          try {
            const file = new File([pendingPhotos[i].blob], 'photo.jpg', { type: 'image/jpeg' });
            const photo = await uploadPhoto(newDog.id, file);
            if (photo.moderation_status && photo.moderation_status !== 'approved') {
              inReview += 1;
            }
          } catch {
            uploadFailures += 1;
          }
        }
        setUploadingPhotoIndex(null);
        // Release blob URLs now that they're no longer needed.
        pendingPhotos.forEach((p) => URL.revokeObjectURL(p.previewUrl));

        if (uploadFailures === 0 && inReview > 0) {
          // Uploaded fine, just held by moderation — say so, or the photos look
          // like they never made it.
          toast(
            `Pet created. ${inReview === 1 ? 'Your photo is' : `${inReview} photos are`} being reviewed before going live.`,
            { icon: '⏳' },
          );
        } else if (uploadFailures === 0) {
          toast.success(pendingPhotos.length > 0 ? 'Pet created with photos!' : 'Pet created!');
        } else {
          toast.error(
            `Pet created, but ${uploadFailures} photo${uploadFailures > 1 ? 's' : ''} failed to upload. You can add them on the profile page.`,
          );
        }
        queryClient.invalidateQueries({ queryKey: ['my-pets'] });
        navigate(`/app/pets/${newDog.id}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['my-pets'] });
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Failed to save'));
    } finally {
      setSaving(false);
      setUploadingPhotoIndex(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this pet?')) return;
    try {
      await deletePet(id!);
      toast.success('Pet removed');
      queryClient.invalidateQueries({ queryKey: ['my-pets'] });
      navigate('/app/pets');
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
      <BackButton fallback="/app/pets" />
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        {isEditing ? (
          <Pencil size={20} aria-hidden className="text-brand-500" />
        ) : (
          <DogIcon size={20} aria-hidden className="text-brand-500" />
        )}
        {isEditing ? 'Edit Pet' : 'Add a Pet'}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Species</label>
          <div className="grid grid-cols-2 gap-2">
            {(['dog', 'cat'] as const).map((sp) => (
              <button
                key={sp}
                type="button"
                disabled={isEditing}
                onClick={() => handleSpeciesChange(sp)}
                className={`flex items-center justify-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                  species === sp
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                } ${isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <span aria-hidden>{sp === 'cat' ? '🐈' : '🐕'}</span>
                {sp === 'cat' ? 'Cat' : 'Dog'}
              </button>
            ))}
          </div>
          {isEditing && (
            <p className="text-xs text-gray-400 dark:text-gray-500">Species can't be changed after creation.</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Breed type</label>
          <div className="grid grid-cols-2 gap-2">
            {MIX_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => handleMixChange(opt.value)}
                className={`flex flex-col items-start px-3 py-2 rounded-xl border text-left transition-colors ${
                  mixType === opt.value
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:border-brand-300'
                }`}
              >
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">{opt.hint}</span>
              </button>
            ))}
          </div>
        </div>

        {mixType !== 'mystery_mutt' && (
          <BreedMultiSelect
            value={breeds}
            onChange={setBreeds}
            max={allowedBreedCap}
            species={species}
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
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Bio</label>
          <textarea
            className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30 resize-none"
            rows={3}
            maxLength={500}
            placeholder="Tell us about your pet..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">{bio.length}/500</p>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Personality traits</label>
          <div className="flex flex-wrap gap-2">
            {suggested.map((trait) => {
              const selected = traits.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTrait(trait)}
                  className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                    selected
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-brand-300'
                  }`}
                >
                  {trait}
                </button>
              );
            })}
            {customTraits.map((trait) => (
              <span
                key={trait}
                className="inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1 rounded-full text-sm font-medium border border-dashed border-brand-400 bg-brand-50 dark:bg-brand-500/15 text-brand-700 dark:text-brand-300"
              >
                {trait}
                <button
                  type="button"
                  onClick={() => toggleTrait(trait)}
                  aria-label={`Remove ${trait}`}
                  className="rounded-full p-0.5 hover:bg-brand-500/20 transition-colors"
                >
                  <X size={12} aria-hidden />
                </button>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-1.5">
            <input
              value={traitDraft}
              maxLength={MAX_TRAIT_LENGTH}
              placeholder="Add your own…"
              aria-label="Add your own trait"
              onChange={(e) => {
                setTraitDraft(e.target.value);
                if (traitError) setTraitError(null);
              }}
              onKeyDown={(e) => {
                // The editor is one big form — Enter here means "add the
                // trait", not "create the pet".
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTrait();
                }
              }}
              className="flex-1 min-w-0 rounded-full border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-1.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-500/30"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={addTrait}
              disabled={!traitDraft.trim() || atTraitCap}
            >
              Add
            </Button>
          </div>
          {traitError ? (
            <p className="text-xs text-danger-500 dark:text-danger-400">{traitError}</p>
          ) : (
            <p className="text-2xs text-gray-400 dark:text-gray-500">
              {traits.length}/{MAX_TRAITS_PER_PET} picked. Can't find the right
              one? Type it in — we'll review it and it may become a suggestion
              for everyone.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Public share page</p>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Lets anyone with the link see {name.trim() || 'this pet'}'s page, no account needed.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label="Public share page"
            onClick={() => setIsPublic((v) => !v)}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
              isPublic ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 bg-white dark:bg-gray-900 rounded-full shadow transition-transform ${
                isPublic ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Photos — on the initial add page we queue them client-side and
            upload after the pet is created. On the edit page the existing
            section below handles photos against an existing pet id. */}
        {!isEditing && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Photos <span className="text-xs text-gray-400 dark:text-gray-500 font-normal ml-1">(optional)</span>
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
                        <span className="absolute bottom-1 left-1 bg-brand-500 text-white text-2xs font-semibold px-1.5 py-0.5 rounded">
                          Primary
                        </span>
                      )}
                      {(isUploading || isUploaded) && (
                        <div className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center">
                          {isUploaded ? (
                            <Check size={18} aria-hidden className="text-white" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          )}
                        </div>
                      )}
                      {!saving && (
                        <button
                          type="button"
                          onClick={() => removePendingPhoto(p.id)}
                          className="absolute top-1 right-1 bg-danger-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          aria-label="Remove photo"
                        >
                          <X size={12} aria-hidden />
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
              <p className="text-2xs text-gray-400 dark:text-gray-500">
                Your first photo becomes the primary. You can add more any time from the profile.
              </p>
            )}
          </div>
        )}

        <span className="relative block">
          <Button type="submit" loading={saving} className="w-full">
            {isEditing
              ? 'Save Changes'
              : pendingPhotos.length > 0
              ? `Create Pet & Upload ${pendingPhotos.length} Photo${pendingPhotos.length > 1 ? 's' : ''}`
              : 'Create Pet'}
          </Button>
          <PawBurstLayer />
        </span>
      </form>

      {isEditing && pet && (
        <>
          <div className="mt-6">
            <h2 className="text-lg font-semibold mb-3">Photos</h2>
            <PhotoUploader petId={id!} onUploaded={() => refetch()} />
            {pet.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {pet.photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <PetPhoto
                      photo={photo}
                      alt=""
                      className="w-full h-24 object-cover rounded-lg"
                    />
                    {isInReview(photo) && (
                      <InReviewBadge className="absolute bottom-1 left-1" />
                    )}
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-1 right-1 bg-danger-500 text-white rounded-full w-5 h-5 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      aria-label="Delete photo"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <PetTagSection petId={id!} />

          <div className="mt-8 border-t pt-4">
            <Button variant="danger" onClick={handleDelete} className="w-full">
              Remove Pet
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function PetTagSection({ petId }: { petId: string }) {
  const [code, setCode] = useState('');
  const queryClient = useQueryClient();
  const { data: tags = [] } = useQuery({
    queryKey: ['pet-tags', petId],
    queryFn: () => getTagsForPet(petId),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['pet-tags', petId] });

  const claim = useMutation({
    mutationFn: () => claimTag(code.trim(), petId),
    onSuccess: () => { toast.success('Tag linked'); setCode(''); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not link that tag')),
  });
  const unlink = useMutation({
    mutationFn: (c: string) => unlinkTag(c),
    onSuccess: () => { toast.success('Tag unlinked'); invalidate(); },
    onError: (err) => toast.error(apiErrorMessage(err, 'Could not unlink')),
  });

  return (
    <div className="mt-8">
      <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
        <QrCode size={18} aria-hidden className="text-brand-500" /> QR tag
      </h2>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
        Got a Fetchpawz tag? Enter its code to link it — scanning it will open this pet’s page.
      </p>

      {tags.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {tags.map((t) => (
            <div key={t.code} className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-3 py-2">
              <span className="font-mono text-sm text-gray-700 dark:text-gray-300">{t.code}</span>
              <span className="flex-1" />
              <Button
                size="sm"
                variant="ghost"
                loading={unlink.isPending && unlink.variables === t.code}
                onClick={() => { if (confirm(`Unlink tag ${t.code}?`)) unlink.mutate(t.code); }}
              >
                Unlink
              </Button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Input
            label="Tag code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="e.g. ABCD2345"
            maxLength={16}
          />
        </div>
        <Button size="sm" onClick={() => claim.mutate()} loading={claim.isPending} disabled={!code.trim()}>
          Link tag
        </Button>
      </div>
    </div>
  );
}
