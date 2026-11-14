import { exitImpersonation, impersonationToken } from '../api/client';

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

  return (
    // Sits directly above the app's tab bar (NavBar publishes its height as
    // --tab-bar-h; 0 where there is none). Pinned to the very bottom it lay
    // on top of the tab bar, so the admin could not navigate the account they
    // were there to look at.
    <div className="fixed bottom-[var(--tab-bar-h,0px)] inset-x-0 z-[60] bg-amber-500 text-black text-sm px-4 py-2 flex items-center justify-center gap-3 shadow-lg">
      <span>
        Viewing as <strong>{name}</strong> (admin support session)
      </span>
      <button
        onClick={exitImpersonation}
        className="rounded-md bg-black/80 text-white px-2.5 py-1 text-xs font-medium hover:bg-black"
      >
        Exit
      </button>
    </div>
  );
}
