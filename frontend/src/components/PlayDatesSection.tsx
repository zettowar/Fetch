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
import { getMyPets } from '../api/pets';
import Button from './ui/Button';
import Avatar from './ui/Avatar';
import { useAuth } from '../store/AuthContext';

// Form controls drawn like <Input>: 2px navy line, orange focus.
const FIELD =
  'w-full rounded-lg border-2 border-navy/25 bg-white px-3.5 py-2.5 text-base font-semibold text-navy placeholder:font-medium placeholder:text-gray-400 outline-none transition-[border-color,box-shadow] duration-150 ease-soft-out hover:border-navy/40 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/25 dark:border-white/20 dark:bg-night-surface dark:text-biscuit dark:placeholder:text-gray-500 dark:hover:border-white/35 dark:focus:border-brand-400';

// A pet you can pick: a pill with a navy line; picked fills orange.
const PET_PILL =
  'inline-flex items-center gap-1.5 rounded-full border-[1.5px] px-2.5 py-1 text-xs font-bold transition-colors';
const PET_PILL_OFF =
  'border-navy/30 bg-white text-navy hover:border-navy dark:border-white/25 dark:bg-night-raised dark:text-biscuit dark:hover:border-biscuit';
const PET_PILL_ON = 'border-navy bg-brand-500 text-navy';

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
  onRsvp: (id: string, petId: string) => void;
  onRemoveRsvp: (id: string, petId: string) => void;
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
  const myRsvp = playdate.rsvps.find((r) => myDogIds.has(r.pet_id));

  return (
    <div className="surface p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-base font-extrabold leading-tight text-navy dark:text-biscuit">
            {playdate.title || `${playdate.host_name || 'Someone'}'s meetup`}
          </p>
          <p className="text-xs font-semibold text-gray-600 dark:text-gray-300 mt-0.5">{formatWhen(playdate.scheduled_for)}</p>
          {playdate.notes && (
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 whitespace-pre-wrap">{playdate.notes}</p>
          )}
        </div>
        {isHost && (
          <button
            onClick={() => onCancel(playdate.id)}
            className="text-2xs font-bold text-gray-500 dark:text-gray-400 hover:text-danger-600 dark:hover:text-danger-400 flex-shrink-0"
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
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 bg-biscuit border border-gray-200 dark:bg-night-raised dark:border-white/10 rounded-full text-xs font-bold text-navy dark:text-biscuit"
            >
              {r.pet_photo_url ? (
                <img src={r.pet_photo_url} alt={r.pet_name ?? 'Attending pet'} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <Avatar name={r.pet_name || '?'} size="sm" />
              )}
              <span>{r.pet_name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-3">
        <span className="text-2xs font-bold text-gray-500 dark:text-gray-400">
          {playdate.going_count} going
        </span>
        {myRsvp ? (
          <button
            onClick={() => onRemoveRsvp(playdate.id, myRsvp.pet_id)}
            className="btn btn-ghost btn-sm ml-auto"
          >
            Leave
          </button>
        ) : (
          // Joining a meetup is a park action: green.
          <button
            onClick={onToggleDogPicker}
            className={`btn btn-sm ml-auto ${dogPickerOpen ? 'btn-ghost' : 'btn-park'}`}
          >
            {dogPickerOpen ? 'Cancel' : "I'm in"}
          </button>
        )}
      </div>

      {dogPickerOpen && !myRsvp && (
        <div className="mt-2 pt-2 border-t border-gray-200 dark:border-white/10">
          {myDogsForPicker.length === 0 ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">Add a pet first to RSVP.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {myDogsForPicker.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => onRsvp(playdate.id, pet.id)}
                  className={`${PET_PILL} ${PET_PILL_OFF}`}
                >
                  {pet.primary_photo_url && (
                    <img
                      src={pet.primary_photo_url}
                      alt={pet.name}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  )}
                  {pet.name}
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

  const { data: playdates = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['playdates', 'upcoming', parkId],
    queryFn: () => listUpcomingPlayDates({ parkId }),
  });

  const { data: myDogs = [] } = useQuery({
    queryKey: ['my-pets'],
    queryFn: getMyPets,
  });

  const myDogIds = new Set(myDogs.map((d) => d.id));

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['playdates', 'upcoming', parkId] });

  const createMutation = useMutation({
    mutationFn: () =>
      createPlayDate({
        park_id: parkId,
        scheduled_for: new Date(when).toISOString(),
        host_pet_id: hostDogId,
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
    onError: () => toast.error("Couldn't create the meetup. Try again."),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelPlayDate(id),
    onSuccess: () => {
      toast.success('Meetup cancelled');
      invalidate();
    },
    onError: () => toast.error("Couldn't cancel. Try again."),
  });

  const rsvpMutation = useMutation({
    mutationFn: ({ id, petId }: { id: string; petId: string }) => rsvpPlayDate(id, petId, 'going'),
    onSuccess: () => {
      toast.success('RSVP saved');
      setDogPickerOpenFor(null);
      invalidate();
    },
    onError: () => toast.error("Couldn't save your RSVP. Try again."),
  });

  const removeRsvpMutation = useMutation({
    mutationFn: ({ id, petId }: { id: string; petId: string }) => removeRsvp(id, petId),
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't leave. Try again."),
  });

  const canCreate = myDogs.length > 0;

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-extrabold text-navy dark:text-biscuit">
          Upcoming meetups
          {playdates.length > 0 && (
            <span className="font-bold text-gray-500 dark:text-gray-400 ml-1">({playdates.length})</span>
          )}
        </h2>
        <Button
          size="sm"
          variant={showCreate ? 'ghost' : 'secondary'}
          onClick={() => {
            if (!canCreate) {
              toast.error('Add a pet first to host a meetup');
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
        <div className="surface p-3 flex flex-col gap-2.5 mb-3">
          <input
            type="datetime-local"
            className={`min-h-[48px] ${FIELD}`}
            value={when}
            min={minLocalIsoForInput()}
            onChange={(e) => setWhen(e.target.value)}
          />
          <input
            type="text"
            className={`min-h-[48px] ${FIELD}`}
            placeholder="Title (optional, e.g. Puppy social)"
            value={title}
            maxLength={200}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            className={`resize-none ${FIELD}`}
            rows={2}
            placeholder="Notes (optional)"
            value={notes}
            maxLength={1000}
            onChange={(e) => setNotes(e.target.value)}
          />
          <div>
            <p className="field-label mb-1.5">Hosting pet:</p>
            <div className="flex flex-wrap gap-1.5">
              {myDogs.map((pet) => (
                <button
                  key={pet.id}
                  onClick={() => setHostDogId(pet.id)}
                  aria-pressed={hostDogId === pet.id}
                  className={`${PET_PILL} ${hostDogId === pet.id ? PET_PILL_ON : PET_PILL_OFF}`}
                >
                  {pet.primary_photo_url && (
                    <img
                      src={pet.primary_photo_url}
                      alt={pet.name}
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  )}
                  {pet.name}
                </button>
              ))}
            </div>
          </div>
          <Button
            variant="park"
            onClick={() => createMutation.mutate()}
            loading={createMutation.isPending}
            disabled={!hostDogId || !when}
          >
            Create meetup
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading meetups…</p>
      ) : isError ? (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Couldn't load meetups.{' '}
          <button type="button" onClick={() => refetch()} className="link">
            Try again
          </button>
        </p>
      ) : playdates.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No upcoming meetups yet. {canCreate ? 'Be the first to host!' : 'Add a pet to host one.'}
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {playdates.map((pd) => (
            <PlayDateCard
              key={pd.id}
              playdate={pd}
              currentUserId={user?.id}
              myDogIds={myDogIds}
              onRsvp={(id, petId) => rsvpMutation.mutate({ id, petId })}
              onRemoveRsvp={(id, petId) => removeRsvpMutation.mutate({ id, petId })}
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
