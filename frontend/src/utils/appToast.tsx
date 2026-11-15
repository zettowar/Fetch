import toast from 'react-hot-toast';
import PawMark from '../components/ui/PawMark';

/**
 * App-standard toasts. The navy toast lives in main.tsx; these wrappers add
 * the brand touches so pages stop configuring toasts inline.
 * - success: the Crown Paw in Ball Orange
 * - celebrate: the big happy moments (weekly win, pet created) — a sparkle,
 *   never an emoji
 */
export const appToast = {
  success: (message: string) =>
    toast.success(message, {
      icon: <PawMark decorative className="h-5 w-5 shrink-0 text-brand-500" />,
    }),
  error: (message: string) => toast.error(message),
  celebrate: (message: string) =>
    toast(message, {
      icon: (
        <svg viewBox="0 0 48 48" className="h-5 w-5 shrink-0 text-gold-500" aria-hidden>
          <path
            d="M24 4c2.4 12 8 17.6 20 20-12 2.4-17.6 8-20 20-2.4-12-8-17.6-20-20 12-2.4 17.6-8 20-20Z"
            fill="currentColor"
          />
        </svg>
      ),
      duration: 4000,
    }),
};
