import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getStats, getStatsTimeseries } from '../../api/admin';
import { Spinner } from '../../components/ui/Skeleton';
import ErrorState from '../../components/ui/ErrorState';
import Card from '../../components/ui/Card';
import PageHeader from '../../components/ui/PageHeader';
import SectionHeader from '../../components/ui/SectionHeader';
import BrandIcon, { type BrandIconName } from '../../components/brand/BrandIcon';
import { STAT_INK, STAT_NUMBER } from './adminStyles';

function formatHours(h: number | null): string {
  if (h === null) return '--';
  if (h < 1) return '<1h';
  if (h < 24) return `${Math.round(h)}h`;
  // floor, not round: 36h is "1d 12h", and rounding the days made it "2d 12h".
  return `${Math.floor(h / 24)}d ${Math.round(h % 24)}h`;
}

/** A linked panel stays flat; hovering firms up its hairline. */
const LINKED_PANEL = 'transition-colors hover:border-navy/40 dark:hover:border-white/30';

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
      <PageHeader
        title="Dashboard"
        className="mb-5"
        action={
          <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
            Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </span>
        }
      />

      {/* Urgent action bar */}
      {hasUrgent && (
        <div
          className={`rounded-2xl border-[1.5px] p-3 mb-5 flex items-center justify-between gap-3 ${
            reportSlaBreached || ticketSlaBreached
              ? 'bg-danger-50 border-danger-300 dark:bg-danger-500/10 dark:border-danger-500/40'
              : 'bg-warning-100 border-warning-500/70 dark:bg-warning-500/10 dark:border-warning-400/40'
          }`}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {stats.pending_reports > 0 && (
              <Link to="/admin/reports" className="font-bold text-danger-700 dark:text-danger-300 hover:underline underline-offset-2">
                {stats.pending_reports} pending report{stats.pending_reports > 1 ? 's' : ''}
                {stats.oldest_pending_report_hours !== null && (
                  <span className="text-xs font-semibold text-danger-600 dark:text-danger-400 ml-1">(oldest: {formatHours(stats.oldest_pending_report_hours)})</span>
                )}
              </Link>
            )}
            {stats.open_tickets > 0 && (
              <Link to="/admin/tickets" className="font-bold text-warning-800 dark:text-warning-200 hover:underline underline-offset-2">
                {stats.open_tickets} open ticket{stats.open_tickets > 1 ? 's' : ''}
                {stats.oldest_open_ticket_hours !== null && (
                  <span className="text-xs font-semibold text-warning-800 dark:text-warning-300 ml-1">(oldest: {formatHours(stats.oldest_open_ticket_hours)})</span>
                )}
              </Link>
            )}
          </div>
          {/* Go to whichever queue the strip is actually about: with only
              tickets open, "Review" landed on an empty reports page. */}
          <Link
            to={stats.pending_reports > 0 ? '/admin/reports' : '/admin/tickets'}
            className="shrink-0 text-xs font-bold text-navy dark:text-biscuit hover:underline underline-offset-2"
          >
            Review &rarr;
          </Link>
        </div>
      )}

      {/* 14-day trends */}
      {series && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          <TrendCard label="New users" values={series.new_users} />
          <TrendCard label="New reports" values={series.new_reports} />
          <TrendCard label="New pets" values={series.new_dogs} />
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Total users" value={stats.total_users} />
        <StatCard label="Active" value={stats.active_users} color="text-success-700 dark:text-success-400" />
        <StatCard label="Suspended" value={stats.suspended_users} color={stats.suspended_users > 0 ? 'text-danger-600 dark:text-danger-400' : 'text-gray-500 dark:text-gray-400'} />
        <StatCard label="New (7d)" value={stats.users_last_7d} color="text-brand-700 dark:text-brand-300" />
        <StatCard label="Total pets" value={stats.total_pets} />
        <StatCard label="Reports (7d)" value={stats.reports_last_7d} />
      </div>

      {/* Revenue + inquiries */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <MoneyCard label="Donations raised" cents={stats.donations_total_cents} link="/admin/donations" />
        <MoneyCard label="Donations (7d)" cents={stats.donations_last_7d_cents} link="/admin/donations" />
        <StatCard label="Open inquiries" value={stats.open_inquiries} link="/admin/inquiries" color={stats.open_inquiries > 0 ? 'text-warning-800 dark:text-warning-300' : undefined} />
      </div>

      {/* Quick actions */}
      <SectionHeader title="Quick actions" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-7">
        <QuickAction to="/admin/reports" icon="flag" label="Review reports" count={stats.pending_reports} urgent={stats.pending_reports > 0} />
        <QuickAction to="/admin/tickets" icon="chat" label="Handle tickets" count={stats.open_tickets} urgent={stats.open_tickets > 0} />
        <QuickAction to="/admin/rescues" icon="rescue" label="Verify rescues" count={stats.unverified_rescues} />
        <QuickAction to="/admin/invites" icon="mail" label="Manage invites" count={stats.unused_invites} />
      </div>

      {/* Beta health */}
      <SectionHeader title="Beta program" />
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Feedback" value={stats.total_feedback} link="/admin/feedback" />
        <StatCard label="Unused invites" value={stats.unused_invites} link="/admin/invites" />
        <StatCard label="Unverified rescues" value={stats.unverified_rescues} link="/admin/rescues" />
      </div>
    </div>
  );
}

function StatCard({ label, value, color = STAT_INK, link }: { label: string; value: number; color?: string; link?: string }) {
  const content = (
    <Card className={link ? LINKED_PANEL : undefined}>
      <p className={`${STAT_NUMBER} ${color}`}>{value}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </Card>
  );
  return link ? <Link to={link} className="block rounded-2xl">{content}</Link> : content;
}

function MoneyCard({ label, cents, link }: { label: string; cents: number; link?: string }) {
  const money = (cents / 100).toLocaleString(undefined, { style: 'currency', currency: 'usd' });
  const content = (
    <Card className={link ? LINKED_PANEL : undefined}>
      <p className={`${STAT_NUMBER} text-success-700 dark:text-success-400`}>{money}</p>
      <p className="eyebrow mt-1.5">{label}</p>
    </Card>
  );
  return link ? <Link to={link} className="block rounded-2xl">{content}</Link> : content;
}

function TrendCard({ label, values }: { label: string; values: number[] }) {
  const latest = values[values.length - 1] ?? 0;
  const half = Math.floor(values.length / 2);
  const currentTotal = values.slice(half).reduce((a, b) => a + b, 0);
  const priorTotal = values.slice(0, half).reduce((a, b) => a + b, 0);
  const delta = currentTotal - priorTotal;
  const deltaColor =
    delta > 0 ? 'text-success-700 dark:text-success-400' : delta < 0 ? 'text-danger-600 dark:text-danger-400' : 'text-gray-500 dark:text-gray-400';

  return (
    <Card>
      <p className="eyebrow">{label} · 14d</p>
      <div className="flex items-baseline gap-2 mt-1.5">
        <span className={`${STAT_NUMBER} ${STAT_INK}`}>{latest}</span>
        <span className={`text-xs font-bold ${deltaColor}`}>
          {delta > 0 ? '+' : ''}{delta} vs. prior 7d
        </span>
      </div>
      <Sparkline values={values} className="mt-2 text-brand-600 dark:text-brand-400" />
    </Card>
  );
}

function Sparkline({
  values,
  width = 160,
  height = 32,
  className,
}: { values: number[]; width?: number; height?: number; className?: string }) {
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
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
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
}: { to: string; label: string; count: number; urgent?: boolean; icon?: BrandIconName }) {
  return (
    <Link
      to={to}
      className={`rounded-2xl border-[1.5px] p-3 text-center transition-colors ${
        urgent
          ? 'border-danger-300 bg-danger-50 hover:border-danger-500 dark:border-danger-500/40 dark:bg-danger-500/10 dark:hover:border-danger-400'
          : 'border-gray-200 bg-white hover:border-navy/40 dark:border-white/10 dark:bg-night-surface dark:hover:border-white/30'
      }`}
    >
      {icon && <BrandIcon name={icon} size={24} className="mx-auto mb-1.5 text-navy dark:text-biscuit" />}
      <p className={`${STAT_NUMBER} ${urgent ? 'text-danger-600 dark:text-danger-400' : STAT_INK}`}>{count}</p>
      <p className="text-xs font-bold text-gray-600 dark:text-gray-300">{label}</p>
    </Link>
  );
}
