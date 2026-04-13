import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getStats } from '../../api/admin';

function formatHours(h: number | null): string {
  if (h === null) return '--';
  if (h < 1) return '<1h';
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d ${Math.round(h % 24)}h`;
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getStats,
    refetchInterval: 30000,
  });

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  const hasUrgent = stats.pending_reports > 0 || stats.open_tickets > 0;
  const reportSlaBreached = (stats.oldest_pending_report_hours ?? 0) > 24;
  const ticketSlaBreached = (stats.oldest_open_ticket_hours ?? 0) > 48;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-xs text-gray-400">
          Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Urgent action bar */}
      {hasUrgent && (
        <div className={`rounded-xl p-3 mb-4 flex items-center justify-between ${reportSlaBreached || ticketSlaBreached ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
          <div className="flex items-center gap-3 text-sm">
            {stats.pending_reports > 0 && (
              <Link to="/admin/reports" className="font-medium text-red-700 hover:underline">
                {stats.pending_reports} pending report{stats.pending_reports > 1 ? 's' : ''}
                {stats.oldest_pending_report_hours !== null && (
                  <span className="text-xs text-red-500 ml-1">(oldest: {formatHours(stats.oldest_pending_report_hours)})</span>
                )}
              </Link>
            )}
            {stats.open_tickets > 0 && (
              <Link to="/admin/tickets" className="font-medium text-amber-700 hover:underline">
                {stats.open_tickets} open ticket{stats.open_tickets > 1 ? 's' : ''}
                {stats.oldest_open_ticket_hours !== null && (
                  <span className="text-xs text-amber-500 ml-1">(oldest: {formatHours(stats.oldest_open_ticket_hours)})</span>
                )}
              </Link>
            )}
          </div>
          <Link to="/admin/reports" className="text-xs font-medium text-gray-600 hover:text-gray-800">
            Review &rarr;
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Users" value={stats.total_users} />
        <StatCard label="Active" value={stats.active_users} color="text-green-600" />
        <StatCard label="Suspended" value={stats.suspended_users} color={stats.suspended_users > 0 ? 'text-red-600' : 'text-gray-400'} />
        <StatCard label="New (7d)" value={stats.users_last_7d} color="text-blue-600" />
        <StatCard label="Total Dogs" value={stats.total_dogs} />
        <StatCard label="Reports (7d)" value={stats.reports_last_7d} />
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <QuickAction to="/admin/reports" label="Review Reports" count={stats.pending_reports} urgent={stats.pending_reports > 0} />
        <QuickAction to="/admin/tickets" label="Handle Tickets" count={stats.open_tickets} urgent={stats.open_tickets > 0} />
        <QuickAction to="/admin/rescues" label="Verify Rescues" count={stats.unverified_rescues} />
        <QuickAction to="/admin/invites" label="Manage Invites" count={stats.unused_invites} />
      </div>

      {/* Beta health */}
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">Beta Program</h2>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Feedback" value={stats.total_feedback} link="/admin/feedback" />
        <StatCard label="Unused Invites" value={stats.unused_invites} link="/admin/invites" />
        <StatCard label="Unverified Rescues" value={stats.unverified_rescues} link="/admin/rescues" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-gray-800', link }: { label: string; value: number; color?: string; link?: string }) {
  const content = (
    <div className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-shadow">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
    </div>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function QuickAction({ to, label, count, urgent }: { to: string; label: string; count: number; urgent?: boolean }) {
  return (
    <Link
      to={to}
      className={`rounded-xl border p-3 text-center hover:shadow-sm transition-shadow ${
        urgent ? 'border-red-200 bg-red-50' : 'border-gray-100 bg-white'
      }`}
    >
      <p className={`text-lg font-bold ${urgent ? 'text-red-600' : 'text-gray-700'}`}>{count}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </Link>
  );
}
