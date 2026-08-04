import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  getSystemJobs,
  listScheduledTasks,
  getAvailableTasks,
  createScheduledTask,
  updateScheduledTask,
  deleteScheduledTask,
  runScheduledTask,
  sendTestEmail,
  type PeriodicTask,
  type PeriodicTaskInput,
  type ScheduleType,
  type TestEmailResult,
} from '../../api/admin';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import TimeAgo from '../../components/TimeAgo';
import { ListSkeleton } from '../../components/ui/Skeleton';

const inputClasses =
  'rounded-xl border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm outline-none focus:border-brand-500 bg-white dark:bg-gray-900';

const errDetail = (e: unknown): string | undefined =>
  (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;

const BLANK = {
  name: '',
  task: '',
  scheduleType: 'interval' as ScheduleType,
  intervalSeconds: '3600',
  minute: '*',
  hour: '*',
  dayOfMonth: '*',
  monthOfYear: '*',
  dayOfWeek: '*',
  enabled: true,
  oneOff: false,
  description: '',
  argsText: '[]',
  kwargsText: '{}',
};

export default function AdminSystemPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK });
  const [testEmail, setTestEmail] = useState('');
  const [testResult, setTestResult] = useState<TestEmailResult | null>(null);
  const set = <K extends keyof typeof BLANK>(key: K, value: (typeof BLANK)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const { data: health, dataUpdatedAt } = useQuery({
    queryKey: ['admin-system-jobs'],
    queryFn: getSystemJobs,
    refetchInterval: 15000,
  });
  const { data: jobs, isLoading } = useQuery({
    queryKey: ['admin-scheduled-tasks'],
    queryFn: listScheduledTasks,
    refetchInterval: 15000,
  });
  const { data: availableTasks = [] } = useQuery({
    queryKey: ['admin-available-tasks'],
    queryFn: getAvailableTasks,
  });

  const anyUnregistered = jobs?.some((j) => !j.registered) ?? false;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-scheduled-tasks'] });
    queryClient.invalidateQueries({ queryKey: ['admin-system-jobs'] });
  };

  const resetForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ ...BLANK });
  };

  /** Build the API payload from form state, or return null (+ toast) on bad JSON. */
  const buildPayload = (): PeriodicTaskInput | null => {
    let args: unknown, kwargs: unknown;
    try {
      args = JSON.parse(form.argsText || '[]');
      kwargs = JSON.parse(form.kwargsText || '{}');
    } catch {
      toast.error('Args / kwargs must be valid JSON');
      return null;
    }
    if (!Array.isArray(args)) {
      toast.error('Args must be a JSON array');
      return null;
    }
    if (typeof kwargs !== 'object' || kwargs === null || Array.isArray(kwargs)) {
      toast.error('Kwargs must be a JSON object');
      return null;
    }
    const base: PeriodicTaskInput = {
      name: form.name.trim(),
      task: form.task,
      schedule_type: form.scheduleType,
      args: args as unknown[],
      kwargs: kwargs as Record<string, unknown>,
      enabled: form.enabled,
      one_off: form.oneOff,
      description: form.description.trim() || null,
    };
    if (form.scheduleType === 'interval') {
      base.interval_seconds = Number(form.intervalSeconds);
    } else {
      base.minute = form.minute;
      base.hour = form.hour;
      base.day_of_month = form.dayOfMonth;
      base.month_of_year = form.monthOfYear;
      base.day_of_week = form.dayOfWeek;
    }
    return base;
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = buildPayload();
      if (!payload) return Promise.reject(new Error('invalid'));
      return editId ? updateScheduledTask(editId, payload) : createScheduledTask(payload);
    },
    onSuccess: () => {
      toast.success(editId ? 'Job updated' : 'Job created');
      invalidate();
      resetForm();
    },
    onError: (e: unknown) => {
      if (e instanceof Error && e.message === 'invalid') return; // toast already shown
      toast.error(errDetail(e) ?? 'Failed to save job');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (job: PeriodicTask) => updateScheduledTask(job.id, { enabled: !job.enabled }),
    onSuccess: (job) => {
      toast.success(job.enabled ? 'Enabled' : 'Disabled');
      invalidate();
    },
    onError: () => toast.error('Failed'),
  });

  const runMutation = useMutation({
    mutationFn: (id: string) => runScheduledTask(id),
    onSuccess: (res) => toast.success(res.detail ?? 'Enqueued'),
    onError: (e: unknown) => toast.error(errDetail(e) ?? 'Could not enqueue'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteScheduledTask,
    onSuccess: () => {
      toast.success('Deleted');
      invalidate();
    },
    onError: () => toast.error('Failed'),
  });

  const testEmailMutation = useMutation({
    mutationFn: () => sendTestEmail(testEmail.trim()),
    onSuccess: (res) => {
      // A rejected send still resolves — the reason is the whole point.
      setTestResult(res);
      if (res.delivered) toast.success('Test email sent');
      else toast.error('Send failed');
    },
    onError: (e: unknown) => {
      setTestResult(null);
      toast.error(errDetail(e) ?? 'Could not send test email');
    },
  });

  const canSendTest = /^\S+@\S+\.\S+$/.test(testEmail.trim());

  const startEdit = (job: PeriodicTask) => {
    setEditId(job.id);
    setForm({
      name: job.name,
      task: job.task,
      scheduleType: job.schedule_type,
      intervalSeconds: job.interval_seconds != null ? String(job.interval_seconds) : '3600',
      minute: job.minute,
      hour: job.hour,
      dayOfMonth: job.day_of_month,
      monthOfYear: job.month_of_year,
      dayOfWeek: job.day_of_week,
      enabled: job.enabled,
      oneOff: job.one_off,
      description: job.description ?? '',
      argsText: JSON.stringify(job.args ?? []),
      kwargsText: JSON.stringify(job.kwargs ?? {}),
    });
    setShowForm(true);
    window.scrollTo({ top: 0 });
  };

  const canSave =
    form.name.trim() &&
    form.task &&
    (form.scheduleType === 'crontab' || Number(form.intervalSeconds) > 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">System</h1>
        {dataUpdatedAt > 0 && (
          <span className="text-xs text-gray-400 dark:text-gray-500">
            Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Health cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card>
          <p className="text-2xl font-bold">{health?.broker_queue_depth ?? '—'}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Broker queue depth</p>
        </Card>
        <Card>
          <p
            className={`text-2xl font-bold ${
              anyUnregistered
                ? 'text-danger-600 dark:text-danger-400'
                : 'text-success-600 dark:text-success-400'
            }`}
          >
            {anyUnregistered ? 'Attention' : 'Healthy'}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scheduled jobs</p>
        </Card>
      </div>

      {anyUnregistered && (
        <div className="mb-4 rounded-lg bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/30 p-3 text-sm text-danger-700 dark:text-danger-300">
          One or more jobs point at a task the worker doesn't have registered — they'll be
          dispatched but silently discarded. Fix the task name or remove the job.
        </div>
      )}

      {/* Email deliverability probe */}
      <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Email
      </h2>
      <Card className="mb-6 flex flex-col gap-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Sends a probe through Resend to confirm the API key, sender domain, and DNS are
          working. Failures are reported here with the provider's reason.
        </p>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Send a test email to"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={testEmail}
              onChange={(e) => {
                setTestEmail(e.target.value);
                setTestResult(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && canSendTest && !testEmailMutation.isPending) {
                  testEmailMutation.mutate();
                }
              }}
            />
          </div>
          <Button
            onClick={() => testEmailMutation.mutate()}
            loading={testEmailMutation.isPending}
            disabled={!canSendTest}
          >
            Send test
          </Button>
        </div>
        {testResult && (
          <div
            className={`rounded-lg border p-3 text-sm ${
              testResult.delivered
                ? 'bg-success-50 dark:bg-success-500/10 border-success-200 dark:border-success-500/30 text-success-700 dark:text-success-300'
                : 'bg-danger-50 dark:bg-danger-500/10 border-danger-200 dark:border-danger-500/30 text-danger-700 dark:text-danger-300'
            }`}
          >
            <p className="font-medium">
              {testResult.delivered ? 'Accepted by Resend' : 'Not delivered'}
            </p>
            <p className="mt-0.5">{testResult.detail}</p>
            <p className="mt-1 text-2xs opacity-80">
              Sent from <span className="font-mono">{testResult.sent_from}</span>
            </p>
          </div>
        )}
      </Card>

      {/* Editor header */}
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Scheduled jobs (Celery Beat)
        </h2>
        <Button
          size="sm"
          onClick={() => {
            const opening = !showForm;
            resetForm();
            setShowForm(opening);
          }}
        >
          {showForm ? 'Cancel' : 'New job'}
        </Button>
      </div>

      {showForm && (
        <Card className="mb-4 flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="nightly-cleanup"
            />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Task</label>
              <select
                className={inputClasses}
                value={form.task}
                onChange={(e) => set('task', e.target.value)}
              >
                <option value="">Select a task…</option>
                {availableTasks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Schedule type */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Schedule</label>
            <div className="flex gap-4 text-sm">
              {(['interval', 'crontab'] as ScheduleType[]).map((t) => (
                <label key={t} className="inline-flex items-center gap-1.5 capitalize">
                  <input
                    type="radio"
                    name="scheduleType"
                    checked={form.scheduleType === t}
                    onChange={() => set('scheduleType', t)}
                  />
                  {t}
                </label>
              ))}
            </div>

            {form.scheduleType === 'interval' ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Every</span>
                <input
                  type="number"
                  min={1}
                  className={`${inputClasses} w-32`}
                  value={form.intervalSeconds}
                  onChange={(e) => set('intervalSeconds', e.target.value)}
                />
                <span className="text-sm text-gray-500">seconds</span>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-2">
                {(
                  [
                    ['minute', 'minute'],
                    ['hour', 'hour'],
                    ['dayOfMonth', 'day (month)'],
                    ['monthOfYear', 'month'],
                    ['dayOfWeek', 'day (week)'],
                  ] as [keyof typeof BLANK, string][]
                ).map(([key, lbl]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-[11px] text-gray-500">{lbl}</label>
                    <input
                      className={`${inputClasses} text-center`}
                      value={form[key] as string}
                      onChange={(e) => set(key, e.target.value as never)}
                    />
                  </div>
                ))}
                <p className="col-span-5 text-xs text-gray-400">
                  Cron syntax, UTC (e.g. <code>*/5</code>, <code>0,30</code>, <code>mon</code>).
                </p>
              </div>
            )}
          </div>

          <Input
            label="Description (optional)"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
          />

          <div className="flex gap-6">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.enabled}
                onChange={(e) => set('enabled', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              Enabled
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.oneOff}
                onChange={(e) => set('oneOff', e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              Run once, then disable
            </label>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-gray-500 select-none">
              Advanced — args / kwargs (JSON)
            </summary>
            <div className="grid gap-3 sm:grid-cols-2 mt-2">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-500">args (array)</label>
                <textarea
                  className={`${inputClasses} font-mono`}
                  rows={2}
                  value={form.argsText}
                  onChange={(e) => set('argsText', e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] text-gray-500">kwargs (object)</label>
                <textarea
                  className={`${inputClasses} font-mono`}
                  rows={2}
                  value={form.kwargsText}
                  onChange={(e) => set('kwargsText', e.target.value)}
                />
              </div>
            </div>
          </details>

          <Button
            onClick={() => saveMutation.mutate()}
            loading={saveMutation.isPending}
            disabled={!canSave}
          >
            {editId ? 'Update job' : 'Create job'}
          </Button>
        </Card>
      )}

      {isLoading || !jobs ? (
        <ListSkeleton rows={4} />
      ) : jobs.length === 0 ? (
        <Card>
          <p className="text-sm text-gray-500 py-4 text-center">No scheduled jobs.</p>
        </Card>
      ) : (
        <Card padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
          {jobs.map((job) => (
            <div key={job.id} className="p-3 flex items-start gap-3">
              <input
                type="checkbox"
                checked={job.enabled}
                disabled={toggleMutation.isPending}
                onChange={() => toggleMutation.mutate(job)}
                title={job.enabled ? 'Disable' : 'Enable'}
                className="mt-1 rounded border-gray-300 dark:border-gray-700"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={`font-semibold text-sm ${job.enabled ? '' : 'text-gray-400'}`}>
                    {job.name}
                  </p>
                  {job.one_off && <Badge variant="neutral">one-off</Badge>}
                  <Badge variant={job.registered ? 'success' : 'danger'} className="uppercase">
                    {job.registered ? 'registered' : 'missing'}
                  </Badge>
                </div>
                <p className="font-mono text-[11px] text-gray-400 dark:text-gray-500 truncate">
                  {job.task}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {job.schedule_display} · runs: {job.total_run_count} ·{' '}
                  {job.last_run_at ? <>last <TimeAgo value={job.last_run_at} /></> : 'never run'}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={runMutation.isPending && runMutation.variables === job.id}
                  onClick={() => runMutation.mutate(job.id)}
                >
                  Run
                </Button>
                <Button size="sm" variant="ghost" onClick={() => startEdit(job)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={deleteMutation.isPending && deleteMutation.variables === job.id}
                  onClick={() => {
                    if (confirm(`Delete "${job.name}"?`)) deleteMutation.mutate(job.id);
                  }}
                >
                  Del
                </Button>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
