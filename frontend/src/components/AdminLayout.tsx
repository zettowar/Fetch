import { NavLink, Outlet, Link } from 'react-router-dom';
import PawMark from './ui/PawMark';
import { useAuth } from '../store/AuthContext';

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
  { path: '/admin/feedback', label: 'Feedback' },
  { path: '/admin/invites', label: 'Invites', adminOnly: true },
  { path: '/admin/faq', label: 'FAQ', adminOnly: true },
  { path: '/admin/breeds', label: 'Breeds', adminOnly: true },
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
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800/50">
      {/* Admin top bar */}
      <div className="bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between">
        <span className="flex items-center gap-2 font-bold text-sm">
          <PawMark decorative className="h-4 w-4 text-brand-500" />
          Fetch Admin
        </span>
        <div className="flex items-center gap-4">
          <Link to="/app/security" className="text-xs text-gray-400 dark:text-gray-500 hover:text-white transition-colors">
            Security
          </Link>
          <Link to="/app/home" className="text-xs text-gray-400 dark:text-gray-500 hover:text-white transition-colors">
            Back to app
          </Link>
        </div>
      </div>

      {/* Horizontal nav tabs (scrollable on mobile) */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <div className="flex min-w-max px-2">
          {navItems.map(({ path, label, ...rest }) => (
            <NavLink
              key={path}
              to={path}
              end={'end' in rest}
              className={({ isActive }) =>
                `px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-700'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-4xl mx-auto p-4">
        <Outlet />
      </div>
    </div>
  );
}
