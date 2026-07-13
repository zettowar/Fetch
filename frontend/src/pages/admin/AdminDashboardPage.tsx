import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getStats, getStatsTimeseries } from '../../api/admin';
import { Spinner } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import Card from '../../components/ui/Card';

function formatHours(h: number | null): string {
  if (h === null) return '--';
  if (h < 1) return '<1h';
  if (h < 24) return `${Math.round(h)}h`;
  return `${Math.round(h / 24)}d ${Math.round(h % 24)}h`;
}

export default function AdminDashboardPage() {
  const { data: stats, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: getStats,
    refetchInterval: 30000,
  });

  const { data: series } = useQuery({
    queryKey: ['admin-timeseries', 14],
    queryFn: () => getStatsTimeseries(14),
    refetchInterval: 60_000,
  });

  if (isError) {
    return <ErrorState message="Couldn't load dashboard stats." onRetry={() => refetch()} />;
  }

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
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
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
        </span>
      </div>

      {/* Urgent action bar */}
      {hasUrgent && (
        <div className={`rounded-xl p-3 mb-4 flex items-center justify-between ${reportSlaBreached || ticketSlaBreached ? 'bg-danger-50 border border-danger-200 dark:bg-danger-500/10 dark:border-danger-500/30' : 'bg-warning-50 border border-warning-200 dark:bg-warning-500/10 dark:border-warning-500/30'}`}>
          <div className="flex items-center gap-3 text-sm">
            {stats.pending_reports > 0 && (
              <Link to="/admin/reports" className="font-medium text-danger-700 dark:text-danger-300 hover:underline">
                {stats.pending_reports} pending report{stats.pending_reports > 1 ? 's' : ''}
                {stats.oldest_pending_report_hours !== null && (
                  <span className="text-xs text-danger-500 dark:text-danger-400 ml-1">(oldest: {formatHours(stats.oldest_pending_report_hours)})</span>
                )}
              </Link>
            )}
            {stats.open_tickets > 0 && (
              <Link to="/admin/tickets" className="font-medium text-warning-700 dark:text-warning-300 hover:underline">
                {stats.open_tickets} open ticket{stats.open_tickets > 1 ? 's' : ''}
                {stats.oldest_open_ticket_hours !== null && (
                  <span className="text-xs text-warning-500 dark:text-warning-400 ml-1">(oldest: {formatHours(stats.oldest_open_ticket_hours)})</span>
                )}
              </Link>
            )}
          </div>
          <Link to="/admin/reports" className="text-xs font-medium text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200">
            Review &rarr;
          </Link>
        </div>
      )}

      {/* 14-day trends */}
      {series && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <TrendCard label="New Users" color="#2563eb" values={series.new_users} />
          <TrendCard label="New Reports" color="#dc2626" values={series.new_reports} />
          <TrendCard label="New Pets" color="#16a34a" values={series.new_dogs} />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total Users" value={stats.total_users} />
        <StatCard label="Active" value={stats.active_users} color="text-success-600 dark:text-success-400" />
        <StatCard label="Suspended" value={stats.suspended_users} color={stats.suspended_users > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-gray-400 dark:text-gray-500'} />
        <StatCard label="New (7d)" value={stats.users_last_7d} color="text-blue-600 dark:text-blue-400" />
        <StatCard label="Total Pets" value={stats.total_pets} />
        <StatCard label="Reports (7d)" value={stats.reports_last_7d} />
      </div>

      {/* Revenue + inquiries */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <MoneyCard label="Donations raised" cents={stats.donations_total_cents} link="/admin/donations" />
        <MoneyCard label="Donations (7d)" cents={stats.donations_last_7d_cents} link="/admin/donations" />
        <StatCard label="Open inquiries" value={stats.open_inquiries} link="/admin/inquiries" color={stats.open_inquiries > 0 ? 'text-warning-600 dark:text-warning-400' : undefined} />
      </div>

      {/* Quick actions */}
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Quick Actions</h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
        <QuickAction to="/admin/reports" icon="🚩" label="Review Reports" count={stats.pending_reports} urgent={stats.pending_reports > 0} />
        <QuickAction to="/admin/tickets" icon="🎟️" label="Handle Tickets" count={stats.open_tickets} urgent={stats.open_tickets > 0} />
        <QuickAction to="/admin/rescues" icon="🏠" label="Verify Rescues" count={stats.unverified_rescues} />
        <QuickAction to="/admin/invites" icon="✉️" label="Manage Invites" count={stats.unused_invites} />
      </div>

      {/* Beta health */}
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Beta Program</h2>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Feedback" value={stats.total_feedback} link="/admin/feedback" />
        <StatCard label="Unused Invites" value={stats.unused_invites} link="/admin/invites" />
        <StatCard label="Unverified Rescues" value={stats.unverified_rescues} link="/admin/rescues" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color = 'text-gray-800 dark:text-gray-200', link }: { label: string; value: number; color?: string; link?: string }) {
  const content = (
    <Card className="hover:shadow-soft transition-shadow">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </Card>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function MoneyCard({ label, cents, link }: { label: string; cents: number; link?: string }) {
  const money = (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'usd' });
  const content = (
    <Card className="hover:shadow-soft transition-shadow">
      <p className="text-2xl font-bold text-success-600 dark:text-success-400">{money}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</p>
    </Card>
  );
  return link ? <Link to={link}>{content}</Link> : content;
}

function TrendCard({ label, color, values }: { label: string; color: string; values: number[] }) {
  const latest = values[values.length - 1] ?? 0;
  const half = Math.floor(values.length / 2);
  const currentTotal = values.slice(half).reduce((a, b) => a + b, 0);
  const priorTotal = values.slice(0, half).reduce((a, b) => a + b, 0);
  const delta = currentTotal - priorTotal;
  const deltaColor =
    delta > 0 ? 'text-success-600 dark:text-success-400' : delta < 0 ? 'text-danger-600 dark:text-danger-400' : 'text-gray-400 dark:text-gray-500';

  return (
    <Card>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label} · 14d</p>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="text-2xl font-bold text-gray-800 dark:text-gray-200">{latest}</span>
        <span className={`text-xs font-medium ${deltaColor}`}>
          {delta > 0 ? '+' : ''}{delta} vs. prior 7d
        </span>
      </div>
      <Sparkline values={values} color={color} className="mt-2" />
    </Card>
  );
}

function Sparkline({
  values,
  color,
  width = 160,
  height = 32,
  className,
}: { values: number[]; color: string; width?: number; height?: number; className?: string }) {
  if (!values.length) return null;
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * step;
    const y = height - (v / max) * height;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
}

function QuickAction({
  to,
  label,
  count,
  urgent,
  icon,
}: { to: string; label: string; count: number; urgent?: boolean; icon?: string }) {
  return (
    <Link
      to={to}
      className={`rounded-xl border p-3 text-center hover:shadow-sm transition-shadow ${
        urgent ? 'border-danger-200 bg-danger-50' : 'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
      }`}
    >
      {icon && <p className="text-lg leading-none mb-1" aria-hidden>{icon}</p>}
      <p className={`text-lg font-bold ${urgent ? 'text-danger-600 dark:text-danger-400' : 'text-gray-700 dark:text-gray-300'}`}>{count}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    </Link>
  );
}
