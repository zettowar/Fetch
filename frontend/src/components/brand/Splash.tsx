import Lockup from './Lockup';
import PawSpinner from '../flair/PawSpinner';

/**
 * The splash (Brand Book, Shapes → the toy box is "for the insides of things:
 * a splash screen"): one loud orange page, the toy-box pattern tone-on-tone,
 * the lockup in navy (navy on colour) wagging its tail once, and the paw-step
 * loader. Shown while the session wakes up.
 */
export default function Splash({ label = 'Loading Fetchpawz' }: { label?: string }) {
  return (
    <div className="toybox-orange animate-splash-in flex min-h-dvh flex-col items-center justify-center gap-7 bg-brand-500 text-navy">
      <div className="rounded-3xl bg-brand-500 px-6 py-4 text-[44px]">
        <Lockup wag markClassName="text-navy" />
      </div>
      <div className="rounded-full bg-brand-500 px-4 py-3">
        <PawSpinner label={label} className="[&>span]:!bg-navy" />
      </div>
    </div>
  );
}
