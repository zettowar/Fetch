import { useQuery } from '@tanstack/react-query';
import { getSystemJobs } from '../../api/admin';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { ListSkeleton } from '../../components/ui/Skeleton';

export default function AdminSystemPage() {
  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['admin-system-jobs'],
    queryFn: getSystemJobs,
    refetchInterval: 15000,
  });

  const anyUnregistered = data?.beat_jobs.some((j) => !j.registered);

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

      {isLoading || !data ? (
        <ListSkeleton rows={4} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <Card>
              <p className="text-2xl font-bold">{data.broker_queue_depth ?? '—'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Broker queue depth</p>
            </Card>
            <Card>
              <p className={`text-2xl font-bold ${anyUnregistered ? 'text-danger-600 dark:text-danger-400' : 'text-success-600 dark:text-success-400'}`}>
                {anyUnregistered ? 'Attention' : 'Healthy'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scheduled jobs</p>
            </Card>
          </div>

          {anyUnregistered && (
            <div className="mb-4 rounded-lg bg-danger-50 dark:bg-danger-500/10 border border-danger-200 dark:border-danger-500/30 p-3 text-sm text-danger-700 dark:text-danger-300">
              One or more scheduled jobs are not registered on the worker — they will be
              dispatched but silently discarded. Check the task import list.
            </div>
          )}

          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Scheduled jobs (beat)</h2>
          <Card as="ul" padding="none" className="divide-y divide-gray-100 dark:divide-gray-800 mb-6">
            {data.beat_jobs.map((j) => (
              <li key={j.name} className="p-3 text-sm flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs truncate">{j.name}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">{j.schedule}</p>
                </div>
                <Badge variant={j.registered ? 'success' : 'danger'} className="uppercase">
                  {j.registered ? 'registered' : 'missing'}
                </Badge>
              </li>
            ))}
          </Card>

          <h2 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Registered tasks</h2>
          <Card as="ul" padding="none" className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.registered_tasks.map((t) => (
              <li key={t} className="p-2.5 px-3 text-xs font-mono text-gray-600 dark:text-gray-300">{t}</li>
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
