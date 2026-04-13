import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import BackButton from '../components/ui/BackButton';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { createDog, getDog, updateDog, deleteDog, DOG_TRAITS } from '../api/dogs';
import { deletePhoto } from '../api/photos';
import PhotoUploader from '../components/PhotoUploader';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { photoUrl } from '../utils/time';

export default function DogEditorPage() {
  const { id } = useParams();
  const isEditing = !!id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [breed, setBreed] = useState('');
  const [bio, setBio] = useState('');
  const [birthday, setBirthday] = useState('');
  const [traits, setTraits] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: dog, refetch } = useQuery({
    queryKey: ['dog', id],
    queryFn: () => getDog(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (dog) {
      setName(dog.name);
      setBreed(dog.breed || '');
      setBio(dog.bio || '');
      setBirthday(dog.birthday || '');
      setTraits(dog.traits || []);
    }
  }, [dog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEditing) {
        await updateDog(id!, { name, breed: breed || undefined, bio: bio || undefined, birthday: birthday || undefined, traits });
        toast.success('Dog updated!');
        queryClient.invalidateQueries({ queryKey: ['dog', id] });
      } else {
        const newDog = await createDog({ name, breed: breed || undefined, bio: bio || undefined, birthday: birthday || undefined, traits });
        toast.success('Dog created! Now add some photos.');
        queryClient.invalidateQueries({ queryKey: ['my-dogs'] });
        // Go to detail page where photo upload is front and center
        navigate(`/dogs/${newDog.id}`);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['my-dogs'] });
    } catch {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to remove this dog?')) return;
    try {
      await deleteDog(id!);
      toast.success('Dog removed');
      queryClient.invalidateQueries({ queryKey: ['my-dogs'] });
      navigate('/dogs');
    } catch {
      toast.error('Failed to delete');
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await deletePhoto(photoId);
      toast.success('Photo deleted');
      refetch();
    } catch {
      toast.error('Failed to delete photo');
    }
  };

  return (
    <div className="p-4">
      <BackButton fallback="/dogs" />
      <h1 className="text-2xl font-bold mb-4">{isEditing ? 'Edit Dog' : 'Add a Dog'}</h1>

      {/* Profile form */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Breed" value={breed} onChange={(e) => setBreed(e.target.value)} placeholder="e.g. Golden Retriever" />
        <Input
          label="Birthday"
          type="date"
          value={birthday}
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
        <Button type="submit" loading={saving} className="w-full">
          {isEditing ? 'Save Changes' : 'Create Dog & Add Photos'}
        </Button>
      </form>

      {/* Photo management (edit mode only) */}
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
