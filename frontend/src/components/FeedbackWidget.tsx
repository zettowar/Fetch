import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../store/AuthContext';
import client from '../api/client';
import Button from './ui/Button';

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
    <>
      {/* Floating button — above bottom tab bar */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-[4.5rem] right-3 w-11 h-11 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 shadow-md hover:bg-brand-500 hover:text-white transition-colors z-50 flex items-center justify-center text-base"
        title="Send feedback"
      >
        {'\ud83d\udcac'}
      </button>

      {/* Feedback panel */}
      {open && (
        <div className="fixed bottom-[7rem] right-3 w-72 bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-4 z-50">
          <h3 className="font-semibold text-sm mb-2">Send Feedback</h3>
          <textarea
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm resize-none outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
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
    </>
  );
}
