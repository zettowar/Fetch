import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type React from 'react';
import { motion } from 'framer-motion';
import BrandIcon from './brand/BrandIcon';
import { toggleReaction, getReactions, type ReactionCounts } from '../api/social';

interface ReactionBarProps {
  targetType: string;
  targetId: string;
}

type ReactionKind = 'like' | 'cute' | 'woof';

// Reactions are words, not emoji (Brand Book, The app → Pet profile): emoji
// render differently on every phone and can't take our colours. Like keeps
// the drawn heart.
const REACTIONS: { kind: ReactionKind; label: string }[] = [
  { kind: 'like', label: 'Like' },
  { kind: 'cute', label: 'Cute' },
  { kind: 'woof', label: 'Woof' },
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
      {REACTIONS.map(({ kind, label }) => {
        const count = counts?.[kind] ?? 0;
        const isActive = counts?.user_reaction === kind;

        return (
          <motion.button
            key={kind}
            onClick={() => mutation.mutate(kind)}
            whileTap={{ scale: 0.88 }}
            animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={`flex items-center gap-1.5 rounded-full border-[1.5px] px-3 py-1.5 text-sm font-extrabold transition-colors ${
              isActive
                ? 'border-navy bg-brand-500 text-navy'
                : 'border-navy/25 bg-white text-navy hover:border-navy dark:border-white/25 dark:bg-night-surface dark:text-biscuit dark:hover:border-biscuit'
            }`}
            aria-label={label}
            aria-pressed={isActive}
          >
            {kind === 'like' && (
              <BrandIcon
                name="like"
                size={16}
                style={{ '--bean': isActive ? '#FFFFFF' : undefined } as React.CSSProperties}
              />
            )}
            <span aria-hidden>{label}</span>
            {count > 0 && <span className="tabular-nums">{count}</span>}
          </motion.button>
        );
      })}
    </div>
  );
}
