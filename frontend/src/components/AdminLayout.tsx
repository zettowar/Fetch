import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import Lockup from './brand/Lockup';
import { useAuth } from '../store/AuthContext';
import { useDocumentTitle } from '../utils/useDocumentTitle';

// `adminOnly` items are hidden from moderators (whose backend gate would 403).
const NAV_ITEMS: { path: string; label: string; end?: boolean; adminOnly?: boolean }[] = [
  { path: '/admin', label: 'Dashboard', end: true },
  { path: '/admin/reports', label: 'Reports' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/content', label: 'Content' },
  { path: '/admin/lost', label: 'Lost & Found' },
  { path: '/admin/tickets', label: 'Tickets' },
  { path: '/admin/rescues', label: 'Rescues' },
  { path: '/admin/inquiries', label: 'Inquiries' },
  { path: '/admin/donations', label: 'Donations', adminOnly: true },
  { path: '/admin/announcements', label: 'Announce', adminOnly: true },
  { path: '/admin/news', label: 'News', adminOnly: true },
  { path: '/admin/feedback', label: 'Feedback' },
  { path: '/admin/invites', label: 'Invites', adminOnly: true },
  { path: '/admin/faq', label: 'FAQ', adminOnly: true },
  { path: '/admin/breeds', label: 'Breeds', adminOnly: true },
  { path: '/admin/traits', label: 'Traits', adminOnly: true },
  { path: '/admin/tags', label: 'QR Tags', adminOnly: true },
  { path: '/admin/parks', label: 'Parks', adminOnly: true },
  { path: '/admin/vets', label: 'Vets', adminOnly: true },
  { path: '/admin/settings', label: 'Settings', adminOnly: true },
  { path: '/admin/system', label: 'System', adminOnly: true },
  { path: '/admin/audit', label: 'Audit Log' },
];

export default function AdminLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const navItems = NAV_ITEMS.filter((item) => isAdmin || !item.adminOnly);
  // One owner for every admin tab title, derived from the nav — a staff member
  // with six admin tabs open could not tell them apart when they all read as
  // the marketing tagline. Longest matching path wins so /admin/users/:id is
  // "Users", not "Dashboard".
  const { pathname } = useLocation();
  const section = [...NAV_ITEMS]
    .sort((a, b) => b.path.length - a.path.length)
    .find((item) => pathname === item.path || pathname.startsWith(`${item.path}/`));
  useDocumentTitle(`${section?.label ?? 'Admin'} · Fetchpawz Admin`);
  return (
    <div className="min-h-screen bg-biscuit text-navy dark:bg-night dark:text-biscuit">
      {/* Admin top bar: Leash Navy, the lockup in biscuit with an orange mark. */}
      <div className="bg-navy text-biscuit dark:border-b dark:border-white/10">
        <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
          <span className="flex items-center gap-2.5">
            <Lockup markClassName="text-brand-500" className="text-xl" />
            <span className="rounded-full border-[1.5px] border-biscuit/30 px-2 py-0.5 text-2xs font-extrabold uppercase tracking-[0.1em] text-biscuit/80">
              Admin
            </span>
          </span>
          <Link
            to="/app/home"
            className="rounded-full px-2 py-1 text-xs font-bold text-biscuit/70 transition-colors hover:bg-white/10 hover:text-biscuit"
          >
            Back to app
          </Link>
        </div>

        {/* Section tabs as pills (scrollable on mobile). Navy on colour. The
            inner padding leaves room for the focus ring inside the scroller. */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex min-w-max gap-1 px-3 pt-1.5 pb-3">
            {navItems.map(({ path, label, ...rest }) => (
              <NavLink
                key={path}
                to={path}
                end={'end' in rest}
                className={({ isActive }) =>
                  `rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap transition-colors ${
                    isActive
                      ? 'bg-brand-500 text-navy'
                      : 'text-biscuit/70 hover:bg-white/10 hover:text-biscuit'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-4xl mx-auto px-4 py-6">
        <Outlet />
      </div>
    </div>
  );
}
