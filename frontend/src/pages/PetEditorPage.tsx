import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import PageHeader from '../components/ui/PageHeader';
import Badge from '../components/ui/Badge';
import BrandIcon from '../components/brand/BrandIcon';
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
import { apiErrorMessage, isNotFound } from '../utils/apiError';
import ErrorState, { NOT_FOUND_HINT } from '../components/ui/ErrorState';
import { Spinner } from '../components/ui/Skeleton';
import { useDocumentTitle } from '../utils/useDocumentTitle';

interface PendingPhoto {
  id: string;
  blob: Blob;
  previewUrl: string;
}

export default function PetEditorPage() {
  const { id } = useParams();
  const isEditing = !!id;
  useDocumentTitle(`${isEditing ? 'Edit pet' : 'Add a pet'} · Fetchpawz`);
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

  const {
    data: pet,
    refetch,
    isLoading: petLoading,
    isError: petFailed,
    error: petError,
  } = useQuery({
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
        // null, not undefined: an omitted field means "leave it alone" to the
        // API, so clearing the bio or birthday saved "Pet updated!" and
        // changed nothing.
        bio: bio.trim() || null,
        birthday: birthday || null,
        traits,
        is_public: isPublic,
      };
      if (isEditing) {
        await updatePet(id!, payload);
        toast.success('Pet updated!');
        queryClient.invalidateQueries({ queryKey: ['pet', id] });
        queryClient.invalidateQueries({ queryKey: ['my-pets'] });
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
            { icon: <BrandIcon name="clock" size={18} /> },
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
      toast.error(apiErrorMessage(err, "Couldn't save. Try again."));
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
      toast.error(apiErrorMessage(err, "Couldn't delete. Try again."));
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    // Same confirmation the pet page asks for — one tap on a small corner
    // button should not be enough to lose a photo.
    if (!confirm('Delete this photo?')) return;
    try {
      await deletePhoto(photoId);
      toast.success('Photo deleted');
      refetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't delete that photo. Try again."));
    }
  };

  // Editing needs the pet first. Say what happened rather than opening an
  // empty form that looks like the pet's details were wiped.
  if (isEditing && (petLoading || petFailed)) {
    return (
      <div className="p-4">
        <PageHeader back backFallback="/app/pets" title="Edit pet" className="mb-5" />
        {petLoading ? (
          <div className="flex justify-center py-16">
            <Spinner label="Loading your pet" />
          </div>
        ) : isNotFound(petError) ? (
          <ErrorState message="Pet not found." hint={NOT_FOUND_HINT} />
        ) : (
          <ErrorState message="Couldn't load this pet." onRetry={() => refetch()} />
        )}
      </div>
    );
  }

  return (
    <div className="p-4">
      <PageHeader
        back
        backFallback="/app/pets"
        title={isEditing ? 'Edit pet' : 'Add a pet'}
        className="mb-5"
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          required
        />

        <div className="flex flex-col gap-1.5">
          <span id="pet-editor-species-label" className="field-label">Species</span>
          {/* One of two: the segmented control, picked in Ball Orange. */}
          <div
            className={`seg grid w-full grid-cols-2 ${isEditing ? 'opacity-60' : ''}`}
            role="group"
            aria-labelledby="pet-editor-species-label"
          >
            {(['dog', 'cat'] as const).map((sp) => (
              <button
                key={sp}
                type="button"
                disabled={isEditing}
                aria-pressed={species === sp}
                onClick={() => handleSpeciesChange(sp)}
                className={`py-2 ${
                  species === sp ? 'seg-on' : 'hover:bg-navy/5 dark:hover:bg-white/10'
                } ${isEditing ? 'cursor-not-allowed' : ''}`}
              >
                {sp === 'cat' ? 'Cat' : 'Dog'}
              </button>
            ))}
          </div>
          {isEditing && (
            <p className="text-xs text-gray-500 dark:text-gray-400">Species can't be changed after creation.</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <span id="pet-editor-breed-type-label" className="field-label">Breed type</span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-labelledby="pet-editor-breed-type-label">
            {MIX_TYPES.map((opt) => (
              <button
                key={opt.value}
                type="button"
                aria-pressed={mixType === opt.value}
                onClick={() => handleMixChange(opt.value)}
                className={`flex flex-col items-start px-3 py-2.5 rounded-lg border-2 text-left text-navy transition-colors ${
                  mixType === opt.value
                    ? 'border-navy bg-brand-500 dark:border-navy'
                    : 'border-navy/20 bg-white hover:border-navy/50 dark:border-white/15 dark:bg-night-surface dark:text-biscuit dark:hover:border-white/35'
                }`}
              >
                <span className="text-sm font-extrabold">{opt.label}</span>
                <span
                  className={`text-xs ${
                    mixType === opt.value ? 'text-navy' : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {opt.hint}
                </span>
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
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pet-editor-bio" className="field-label">Bio</label>
          <textarea
            id="pet-editor-bio"
            className="w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400 resize-none"
            rows={3}
            maxLength={500}
            placeholder="Tell us about your pet..."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 text-right tabular-nums">{bio.length}/500</p>
        </div>
        <div className="flex flex-col gap-1.5" role="group" aria-labelledby="pet-editor-traits-label">
          <div className="flex items-baseline justify-between gap-3">
            <span id="pet-editor-traits-label" className="field-label">Personality traits</span>
            <span className="text-xs font-bold text-gray-600 dark:text-gray-300 tabular-nums">
              {traits.length}/{MAX_TRAITS_PER_PET} picked
            </span>
          </div>
          {/* Traits are collar-tag chips: picked ones fill with Ball Orange.
              The owner's own (not yet a suggestion) keep a dashed line — the
              brand's "held for review" mark. */}
          <div className="flex flex-wrap gap-2">
            {suggested.map((trait) => {
              const selected = traits.includes(trait);
              return (
                <button
                  key={trait}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => toggleTrait(trait)}
                  className={`chip ${selected ? 'chip-on' : 'hover:bg-brand-50 dark:hover:bg-night-surface'}`}
                >
                  {trait}
                </button>
              );
            })}
            {customTraits.map((trait) => (
              <span key={trait} className="chip chip-on border-dashed gap-1 pr-1.5">
                {trait}
                <button
                  type="button"
                  onClick={() => toggleTrait(trait)}
                  aria-label={`Remove ${trait}`}
                  className="rounded-full p-0.5 text-navy hover:bg-navy/10 transition-colors"
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
              className="chip chip-add flex-1 min-w-0 min-h-[36px] text-navy placeholder:font-semibold placeholder:text-gray-500 outline-none focus:border-solid focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:text-biscuit dark:placeholder:text-gray-400"
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
            <p className="text-xs font-semibold text-danger-700 dark:text-danger-300">{traitError}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Can't find the right one? Type it in — we'll review it and it may
              become a suggestion for everyone.
            </p>
          )}
        </div>

        <div className="surface flex items-center justify-between gap-4 px-3.5 py-3">
          <div>
            <p className="text-sm font-bold text-navy dark:text-biscuit">Public share page</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Lets anyone with the link see {name.trim() || 'this pet'}'s page, no account needed.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={isPublic}
            aria-label="Public share page"
            onClick={() => setIsPublic((v) => !v)}
            // Toggle: Ball Orange when on, always on a navy line.
            className={`relative flex-shrink-0 w-12 h-7 rounded-full border-2 transition-colors ${
              isPublic
                ? 'border-navy bg-brand-500'
                : 'border-navy/40 bg-white dark:border-white/30 dark:bg-night-raised'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full border-2 border-navy bg-white transition-transform duration-150 ease-soft-out ${
                isPublic ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Photos — on the initial add page we queue them client-side and
            upload after the pet is created. On the edit page the existing
            section below handles photos against an existing pet id. */}
        {!isEditing && (
          <div className="flex flex-col gap-2" role="group" aria-labelledby="pet-editor-photos-label">
            <span id="pet-editor-photos-label" className="field-label">
              Photos <span className="font-semibold normal-case tracking-normal text-gray-500 dark:text-gray-400 ml-1">(optional)</span>
            </span>

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
                        className="h-full w-full object-cover rounded-lg border-[1.5px] border-navy/20 dark:border-white/10"
                      />
                      {idx === 0 && (
                        <Badge variant="brand" className="absolute bottom-1 left-1 dark:!bg-night/90">
                          Primary
                        </Badge>
                      )}
                      {(isUploading || isUploaded) && (
                        <div className="absolute inset-0 rounded-lg bg-navy/50 flex items-center justify-center">
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
                          className="absolute top-1 right-1 bg-danger-500 text-white rounded-full w-5 h-5 text-xs reveal-on-hover transition-opacity flex items-center justify-center"
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
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your first photo becomes the primary. You can add more any time from the profile.
              </p>
            )}
          </div>
        )}

        <span className="relative block">
          <Button type="submit" loading={saving} className="w-full">
            {isEditing
              ? 'Save changes'
              : pendingPhotos.length > 0
              ? `Create pet & upload ${pendingPhotos.length} photo${pendingPhotos.length > 1 ? 's' : ''}`
              : 'Create pet'}
          </Button>
          <PawBurstLayer />
        </span>
      </form>

      {isEditing && pet && (
        <>
          <div className="mt-6">
            <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mb-3">Photos</h2>
            <PhotoUploader petId={id!} onUploaded={() => refetch()} />
            {pet.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mt-3">
                {pet.photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <PetPhoto
                      photo={photo}
                      alt=""
                      className="w-full h-24 object-cover rounded-lg border-[1.5px] border-navy/20 dark:border-white/10"
                    />
                    {isInReview(photo) && (
                      <InReviewBadge className="absolute bottom-1 left-1" />
                    )}
                    <button
                      onClick={() => handleDeletePhoto(photo.id)}
                      className="absolute top-1 right-1 bg-danger-500 text-white rounded-full w-5 h-5 text-xs reveal-on-hover transition-opacity flex items-center justify-center"
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

          <div className="mt-8 border-t border-gray-200 dark:border-white/10 pt-4">
            <Button variant="danger" onClick={handleDelete} className="w-full">
              Remove pet
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
      <h2 className="text-lg font-extrabold tracking-tight text-navy dark:text-biscuit mb-1 flex items-center gap-2">
        <BrandIcon name="qr" size={22} /> QR tag
      </h2>
      <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
        Got a Fetchpawz tag? Enter its code to link it — scanning it will open this pet’s page.
      </p>

      {tags.length > 0 && (
        <div className="flex flex-col gap-2 mb-3">
          {tags.map((t) => (
            <div key={t.code} className="surface flex items-center gap-2 px-3 py-2">
              <BrandIcon name="tag" size={20} />
              <span className="font-mono text-sm text-navy dark:text-biscuit">{t.code}</span>
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
        {/* Secondary: the pet form's Save is this screen's primary. */}
        <Button
          size="sm"
          variant="secondary"
          className="mb-1.5"
          onClick={() => claim.mutate()}
          loading={claim.isPending}
          disabled={!code.trim()}
        >
          Link tag
        </Button>
      </div>
    </div>
  );
}
