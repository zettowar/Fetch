import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  listUpcomingPlayDates,
  createPlayDate,
  cancelPlayDate,
  rsvpPlayDate,
  removeRsvp,
  type PlayDate,
} from '../api/playdates';
import { getMyDogs } from '../api/dogs';
import Button from './ui/Button';
import Avatar from './ui/Avatar';
import { useAuth } from '../store/AuthContext';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function minLocalIsoForInput(): string {
  // datetime-local input wants "YYYY-MM-DDTHH:mm" in local time
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

interface PlayDateCardProps {
  playdate: PlayDate;
  currentUserId: string | undefined;
  myDogIds: Set<string>;
  onRsvp: (id: string, dogId: string) => void;
  onRemoveRsvp: (id: string, dogId: string) => void;
  onCancel: (id: string) => void;
  dogPickerOpen: boolean;
  onToggleDogPicker: () => void;
  myDogsForPicker: Array<{ id: string; name: string; primary_photo_url?: string | null }>;
}

function PlayDateCard({
  playdate,
  currentUserId,
  myDogIds,
  onRsvp,
  onRemoveRsvp,
  onCancel,
  dogPickerOpen,
  onToggleDogPicker,
  myDogsForPicker,
}: PlayDateCardProps) {
  const isHost = currentUserId === playdate.host_id;
  const goingRsvps = playdate.rsvps.filter((r) => r.status === 'going');
  const myRsvp = playdate.rsvps.find((r) => myDogIds.has(r.dog_id));

  return (
    <div className="p-3 bg-white border border-gray-100 rounded-xl">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm">
            {playdate.title || `${playdate.host_name || 'Someone'}'s meetup`}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">{formatWhen(playdate.scheduled_for)}</p>
          {playdate.notes && (
            <p className="text-xs text-gray-600 mt-1.5 whitespace-pre-wrap">{playdate.notes}</p>
          )}
        </div>
        {isHost && (
          <button
            onClick={() => onCancel(playdate.id)}
            className="text-[11px] text-gray-400 hover:text-red-500 flex-shrink-0"
            title="Cancel meetup"
          >
            Cancel
          </button>
        )}
      </div>

      {goingRsvps.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {goingRsvps.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-gray-50 rounded-full text-xs"
            >
              {r.dog_photo_url ? (
                <img src={r.dog_photo_url} alt={r.dog_name ?? 'Attending dog'} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <Avatar name={r.dog_name || '?'} size="sm" />
              )}
              <span>{r.dog_name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <span className="text-[11px] text-gray-400">
          {playdate.going_count} going
        </span>
        {myRsvp ? (
          <button
            onClick={() => onRemoveRsvp(playdate.id, myRsvp.dog_id)}
            className="ml-auto text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
          >
            Leave
          </button>
        ) : (
          <button
            onClick={onToggleDogPicker}
            className="ml-auto text-xs px-2.5 py-1 bg-brand-500 text-white rounded-full hover:bg-brand-600"
          >
            {dogPickerOpen ? 'Cancel' : "I'm in"}
          </button>
        )}
      </div>

      {dogPickerOpen && !myRsvp && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          {myDogsForPicker.length === 0 ? (
            <p className="text-xs text-gray-400">Add a dog first to RSVP.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {myDogsForPicker.map((dog) => (
                <button
                  key={dog.id}
                  onClick={() => onRsvp(playdate.id, dog.id)}
                  className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs hover:border-brand-400"
                >
                  {dog.primary_photo_url && (
                    <img
                      src={dog.primary_photo_url}
                      alt={dog.name}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  )}
                  {dog.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PlayDatesSection({ parkId }: { parkId: string }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [showCreate, setShowCreate] = useState(false);
  const [dogPickerOpenFor, setDogPickerOpenFor] = useState<string | null>(null);

  // Create form state
  const [when, setWhen] = useState(minLocalIsoForInput());
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [hostDogId, setHostDogId] = useState<string>('');

  const { data: playdates = [], isLoading } = useQuery({
    queryKey: ['playdates', 'upcoming', parkId],
    queryFn: () => listUpcomingPlayDates({ parkId }),
  });

  const { data: myDogs = [] } = useQuery({
    queryKey: ['my-dogs'],
    queryFn: getMyDogs,
  });

  const myDogIds = new Set(myDogs.map((d) => d.id));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['playdates', 'upcoming', parkId] });

  const createMutation = useMutation({
    mutationFn: () =>
      createPlayDate({
        park_id: parkId,
        scheduled_for: new Date(when).toISOString(),
        host_dog_id: hostDogId,
        title: title || undefined,
        notes: notes || undefined,
      }),
    onSuccess: () => {
      toast.success('Meetup created');
      setShowCreate(false);
      setTitle('');
      setNotes('');
      invalidate();
    },
    onError: () => toast.error('Failed to create meetup'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPlayDate(id),
    onSuccess: () => {
      toast.success('Meetup cancelled');
      invalidate();
    },
    onError: () => toast.error('Failed to cancel'),
  });

  const rsvpMutation = useMutation({
    mutationFn: ({ id, dogId }: { id: string; dogId: string }) => rsvpPlayDate(id, dogId, 'going'),
    onSuccess: () => {
      toast.success('RSVP saved');
      setDogPickerOpenFor(null);
      invalidate();
    },
    onError: () => toast.error('Failed to RSVP'),
  });

  const removeRsvpMutation = useMutation({
    mutationFn: ({ id, dogId }: { id: string; dogId: string }) => removeRsvp(id, dogId),
    onSuccess: invalidate,
    onError: () => toast.error('Failed to leave'),
  });

  const canCreate = myDogs.length > 0;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-sm text-gray-700">
          Upcoming meetups
          {playdates.length > 0 && (
            <span className="text-brand-500 ml-1">({playdates.length})</span>
          )}
        </h2>
        <Button
          size="sm"
          variant={showCreate ? 'ghost' : 'secondary'}
          onClick={() => {
            if (!canCreate) {
              toast.error('Add a dog first to host a meetup');
              return;
            }
            setShowCreate((v) => !v);
            if (!hostDogId && myDogs[0]) setHostDogId(myDogs[0].id);
          }}
        >
          {showCreate ? 'Close' : 'Host meetup'}
        </Button>
      </div>

      {showCreate && canCreate && (
        <div className="p-3 bg-gray-50 rounded-xl flex flex-col gap-2 mb-3">
          <input
            type="datetime-local"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            value={when}
            min={minLocalIsoForInput()}
            onChange={(e) => setWhen(e.target.value)}
          />
          <input
            type="text"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
            placeholder="Title (optional, e.g. Puppy social)"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm resize-none outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            rows={2}
            placeholder="Notes (optional)"
            value={notes}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div>
            <p className="text-xs text-gray-500 mb-1">Hosting dog:</p>
            <div className="flex flex-wrap gap-1.5">
              {myDogs.map((dog) => (
                <button
                  key={dog.id}
                  onClick={() => setHostDogId(dog.id)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    hostDogId === dog.id
                      ? 'bg-brand-500 text-white border-brand-500'
                      : 'bg-white border-gray-200 hover:border-brand-400'
                  }`}
                >
                  {dog.primary_photo_url && (
                    <img
                      src={dog.primary_photo_url}
                      alt={dog.name}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  )}
                  {dog.name}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!hostDogId || !when}
          >
            Create meetup
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : playdates.length === 0 ? (
        <p className="text-sm text-gray-400">
          No upcoming meetups yet. {canCreate ? 'Be the first to host!' : 'Add a dog to host one.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {playdates.map((pd) => (
            <PlayDateCard
              key={pd.id}
              playdate={pd}
              currentUserId={user?.id}
              myDogIds={myDogIds}
              onRsvp={(id, dogId) => rsvpMutation.mutate({ id, dogId })}
              onRemoveRsvp={(id, dogId) => removeRsvpMutation.mutate({ id, dogId })}
              onCancel={(id) => cancelMutation.mutate(id)}
              dogPickerOpen={dogPickerOpenFor === pd.id}
              onToggleDogPicker={() =>
                setDogPickerOpenFor((curr) => (curr === pd.id ? null : pd.id))
              }
              myDogsForPicker={myDogs}
            />
          ))}
        </div>
      )}
    </div>
  );
}
