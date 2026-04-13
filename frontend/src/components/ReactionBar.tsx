import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toggleReaction, getReactions } from '../api/social';

interface ReactionBarProps {
  targetType: string;
  targetId: string;
}

const REACTIONS = [
  { kind: 'like', emoji: '\u2764\ufe0f', label: 'Like' },
  { kind: 'cute', emoji: '\ud83d\ude0d', label: 'Cute' },
  { kind: 'woof', emoji: '\ud83d\udc36', label: 'Woof' },
] as const;

export default function ReactionBar({ targetType, targetId }: ReactionBarProps) {
  const queryClient = useQueryClient();

  const { data: counts } = useQuery({
    queryKey: ['reactions', targetType, targetId],
    queryFn: () => getReactions(targetType, targetId),
  });

  const mutation = useMutation({
    mutationFn: (kind: string) => toggleReaction(targetType, targetId, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reactions', targetType, targetId] });
    },
  });

  return (
    <div className="flex gap-2">
      {REACTIONS.map(({ kind, emoji, label }) => {
        const count = counts?.[kind as keyof typeof counts] as number ?? 0;
        const isActive = counts?.user_reaction === kind;

        return (
          <button
            key={kind}
            onClick={() => mutation.mutate(kind)}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-sm transition-colors ${
              isActive
                ? 'bg-brand-100 text-brand-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={label}
          >
            {emoji} {count > 0 && <span>{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
