import { NavLink, Outlet, Link } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/admin', label: 'Dashboard', end: true },
  { path: '/admin/reports', label: 'Reports' },
  { path: '/admin/users', label: 'Users' },
  { path: '/admin/content', label: 'Content' },
  { path: '/admin/lost', label: 'Lost & Found' },
  { path: '/admin/tickets', label: 'Tickets' },
  { path: '/admin/rescues', label: 'Rescues' },
  { path: '/admin/feedback', label: 'Feedback' },
  { path: '/admin/invites', label: 'Invites' },
  { path: '/admin/faq', label: 'FAQ' },
  { path: '/admin/breeds', label: 'Breeds' },
  { path: '/admin/parks', label: 'Parks' },
  { path: '/admin/audit', label: 'Audit Log' },
];

export default function AdminLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin top bar */}
      <div className="bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between">
        <span className="font-bold text-sm">Fetch Admin</span>
        <Link to="/home" className="text-xs text-gray-400 hover:text-white transition-colors">
          Back to app
        </Link>
      </div>

      {/* Horizontal nav tabs (scrollable on mobile) */}
      <div className="bg-white border-b border-gray-200 overflow-x-auto">
        <div className="flex min-w-max px-2">
          {NAV_ITEMS.map(({ path, label, ...rest }) => (
            <NavLink
              key={path}
              to={path}
              end={'end' in rest}
              className={({ isActive }) =>
                `px-3 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-brand-500 text-brand-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
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
