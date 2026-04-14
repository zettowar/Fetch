import toast from 'react-hot-toast';

/**
 * Share a link via the Web Share API when available (native share sheet on
 * mobile) and fall back to clipboard copy with a toast. Swallows user-cancel
 * (AbortError) silently.
 */
export async function shareLink(url: string, title?: string): Promise<void> {
  const nav = navigator as Navigator & {
    share?: (data: { title?: string; url: string }) => Promise<void>;
  };
  if (typeof nav.share === 'function') {
    try {
      await nav.share({ title, url });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      // Fall through to clipboard fallback.
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  } catch {
    toast('Could not copy link');
  }
}
