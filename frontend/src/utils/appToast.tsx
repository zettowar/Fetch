import toast from 'react-hot-toast';
import PawMark from '../components/ui/PawMark';

/**
 * App-standard toasts. Global glass styling lives in main.tsx; these
 * wrappers add the brand touches so pages stop configuring toasts inline.
 * - success: paw icon
 * - celebrate: for the big happy moments (weekly win, dog created)
 */
export const appToast = {
  success: (message: string) =>
    toast.success(message, {
      icon: <PawMark decorative className="h-4 w-4 text-brand-400" />,
    }),
  error: (message: string) => toast.error(message),
  celebrate: (message: string) => toast(message, { icon: '🎉', duration: 3000 }),
};
