import { impersonationToken } from '../api/client';

/**
 * Fixed banner shown whenever this tab is running an admin "log in as" session.
 * Exiting clears the per-tab override and returns to the admin console; the
 * admin's own session (in localStorage) was never touched.
 */
export default function ImpersonationBanner() {
  if (!impersonationToken()) return null;
  let name = 'a user';
  try {
    name = sessionStorage.getItem('imp_name') || name;
  } catch { /* ignore */ }

  const exit = () => {
    try {
      sessionStorage.removeItem('imp_token');
      sessionStorage.removeItem('imp_name');
    } catch { /* ignore */ }
    window.location.assign('/admin/users');
  };

  return (
    <div className="fixed bottom-0 inset-x-0 z-[60] bg-amber-500 text-black text-sm px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
      <span>
        Viewing as <strong>{name}</strong> (admin support session)
      </span>
      <button
        onClick={exit}
        className="rounded-md bg-black/80 text-white px-2.5 py-1 text-xs font-medium hover:bg-black"
      >
        Exit
      </button>
    </div>
  );
}
