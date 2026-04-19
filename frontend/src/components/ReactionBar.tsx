import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toggleReaction, getReactions, type ReactionCounts } from '../api/social';

interface ReactionBarProps {
  targetType: string;
  targetId: string;
}

type ReactionKind = 'like' | 'cute' | 'woof';

const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: 'like', emoji: '\u2764\ufe0f', label: 'Like' },
  { kind: 'cute', emoji: '\ud83d\ude0d', label: 'Cute' },
  { kind: 'woof', emoji: '\ud83d\udc36', label: 'Woof' },
];

export default function ReactionBar({ targetType, targetId }: ReactionBarProps) {
  const queryClient = useQueryClient();
  const key = ['reactions', targetType, targetId];

  const { data: counts } = useQuery<ReactionCounts>({
    queryKey: key,
    queryFn: () => getReactions(targetType, targetId),
  });

  const mutation = useMutation({
    mutationFn: (kind: ReactionKind) => toggleReaction(targetType, targetId, kind),
    onMutate: async (kind) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ReactionCounts>(key);
      queryClient.setQueryData<ReactionCounts>(key, (prev) => {
        const base: ReactionCounts = prev ?? { like: 0, cute: 0, woof: 0, user_reaction: null };
        const next: ReactionCounts = { ...base };
        const priorKind = base.user_reaction as ReactionKind | null;
        if (priorKind === kind) {
          next[kind] = Math.max(0, base[kind] - 1);
          next.user_reaction = null;
        } else {
          if (priorKind) {
            next[priorKind] = Math.max(0, base[priorKind] - 1);
          }
          next[kind] = base[kind] + 1;
          next.user_reaction = kind;
        }
        return next;
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <div className="flex gap-2">
      {REACTIONS.map(({ kind, emoji, label }) => {
        const count = counts?.[kind] ?? 0;
        const isActive = counts?.user_reaction === kind;

        return (
          <motion.button
            key={kind}
            onClick={() => mutation.mutate(kind)}
            whileTap={{ scale: 0.88 }}
            animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium transition-colors ${
              isActive
                ? 'bg-brand-100 text-brand-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            aria-label={label}
            aria-pressed={isActive}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
