import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../store/AuthContext';
import client from '../api/client';
import Button from './ui/Button';
import BrandIcon from './brand/BrandIcon';

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Only show for logged-in users
  if (!isAuthenticated) return null;

  const handleSubmit = async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      await client.post('/feedback', {
        body,
        screen_name: location.pathname,
      });
      toast.success('Thanks for your feedback!');
      setBody('');
      setOpen(false);
    } catch {
      toast.error('Failed to send feedback');
    } finally {
      setSending(false);
    }
  };

  return (
    // Anchor the floating UI to the centered app column (max-w-app) rather than
    // the viewport edge, so on wide screens it hugs the column, not the far right.
    // The wrapper ignores pointer events; only the button/panel capture them.
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50">
      <div className="relative mx-auto w-full max-w-app">
        {/* Floating button — pinned to the column's right edge, above the tab bar */}
        <button
          onClick={() => setOpen(!open)}
          // A thing you touch: white on a navy line with the small toy shadow.
          // The orange bean in the icon is the only colour until hovered.
          className="pointer-events-auto absolute bottom-[4.5rem] right-3 w-11 h-11 rounded-full border-2 border-navy bg-white text-navy shadow-toy-sm transition-[transform,box-shadow,background-color] duration-150 ease-soft-out hover:bg-brand-100 active:translate-x-[2px] active:translate-y-[3px] active:shadow-none dark:border-white/30 dark:bg-night-raised dark:text-biscuit dark:hover:bg-night-surface flex items-center justify-center"
          title="Send feedback"
          aria-label="Send feedback"
        >
          <BrandIcon name="chat" size={22} />
        </button>

        {/* Feedback panel — a flat panel, no soft shadow */}
        {open && (
          <div className="surface pointer-events-auto absolute bottom-[7rem] right-3 w-72 p-4">
            <h3 className="text-base font-extrabold tracking-tight text-navy dark:text-biscuit mb-2">Send feedback</h3>
            <textarea
              className="w-full rounded-lg border-[1.5px] border-gray-300 bg-white px-3 py-2 text-sm text-navy placeholder:text-gray-500 resize-none outline-none focus:border-navy focus:ring-2 focus:ring-brand-500/40 dark:border-white/20 dark:bg-night-raised dark:text-biscuit dark:placeholder:text-gray-400 dark:focus:border-biscuit"
              rows={3}
              placeholder="Bug report, feature idea, or just say hi..."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex gap-2 mt-2">
              <Button size="sm" onClick={handleSubmit} loading={sending} disabled={!body.trim()}>
                Send
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
