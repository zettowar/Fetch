import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './ui/Button';

const AD_DURATION_MS = 15_000;

interface Props {
  open: boolean;
  onReward: () => void;
  onClose: () => void;
  rewardAmount?: number;
}

// Stub for a real rewarded-video integration (AdMob / AppLovin / etc.).
// Simulates a 15s ad and grants the reward when the timer completes.
// The user can dismiss early but only gets the reward by watching through.
export default function RewardedAdModal({ open, onReward, onClose, rewardAmount = 25 }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (!open) {
      setElapsed(0);
      setCompleted(false);
      return;
    }
    const start = Date.now();
    const tick = setInterval(() => {
      const ms = Date.now() - start;
      if (ms >= AD_DURATION_MS) {
        setElapsed(AD_DURATION_MS);
        setCompleted(true);
        clearInterval(tick);
      } else {
        setElapsed(ms);
      }
    }, 250);
    return () => clearInterval(tick);
  }, [open]);

  const progress = Math.min(1, elapsed / AD_DURATION_MS);
  const secondsLeft = Math.max(0, Math.ceil((AD_DURATION_MS - elapsed) / 1000));

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-night/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Rewarded ad"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="w-full max-w-sm rounded-3xl border-[2.5px] border-navy bg-navy text-biscuit p-6 shadow-toy dark:border-white/15"
          >
            <p className="eyebrow !text-gray-300">Bonus swipes</p>
            <h2 className="text-xl font-extrabold tracking-tight mt-1">
              {completed ? 'All set!' : 'Fetching more swipes…'}
            </h2>
            <p className="text-sm text-gray-300 mt-2">
              {completed
                ? `You've earned ${rewardAmount} more swipes.`
                : 'No video to sit through during the beta — just a short wait.'}
            </p>

            <div className="mt-5 h-2.5 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-brand-500"
                animate={{ width: `${progress * 100}%` }}
                transition={{ ease: 'linear', duration: 0.25 }}
              />
            </div>
            <p className="text-2xs text-gray-300 mt-2 text-center tabular-nums">
              {completed ? 'Complete' : `${secondsLeft}s remaining`}
            </p>

            <div className="mt-5 flex gap-2">
              {completed ? (
                <Button
                  onClick={() => {
                    onReward();
                    onClose();
                  }}
                  className="flex-1"
                >
                  Claim +{rewardAmount}
                </Button>
              ) : (
                <Button variant="ghost" onClick={onClose} className="flex-1 !text-biscuit hover:!bg-white/10">
                  Skip (no reward)
                </Button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
