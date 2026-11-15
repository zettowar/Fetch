import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSettings, putSetting, type AppSetting } from '../../api/admin';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import PageHeader from '../../components/ui/PageHeader';
import ErrorState from '../../components/ui/ErrorState';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { FIELD, LINK } from './adminStyles';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['admin-settings'],
    queryFn: getSettings,
  });

  const save = useMutation({
    mutationFn: ({ key, value }: { key: string; value: unknown }) => putSetting(key, value),
    onSuccess: () => {
      toast.success('Setting saved');
      queryClient.invalidateQueries({ queryKey: ['admin-settings'] });
    },
    onError: () => toast.error('Failed to save setting'),
  });

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Runtime feature flags. Changes take effect within ~30 seconds across all servers."
        className="mb-5"
      />

      {isLoading ? (
        <ListSkeleton rows={3} />
      ) : isError ? (
        <ErrorState message="Couldn't load settings." onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {settings.map((s) => (
            <SettingRow key={s.key} setting={s} pending={save.isPending} onSave={(value) => save.mutate({ key: s.key, value })} />
          ))}
        </div>
      )}

      <Card className="mt-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-extrabold text-navy dark:text-biscuit">Your account</p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              Password and two-factor auth are managed in your account security settings.
            </p>
          </div>
          <Link
            to="/app/security"
            className={`shrink-0 text-sm ${LINK}`}
          >
            Open security <span aria-hidden>→</span>
          </Link>
        </div>
      </Card>
    </div>
  );
}

function SettingRow({ setting, pending, onSave }: { setting: AppSetting; pending: boolean; onSave: (v: unknown) => void }) {
  const isBool = typeof setting.default === 'boolean';
  const [text, setText] = useState(typeof setting.value === 'string' ? setting.value : '');

  return (
    <Card>
      {/* Wraps under a narrow width so a long description keeps a readable
          measure instead of being squeezed beside the control. */}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-[14rem] flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-navy dark:text-biscuit">{setting.key}</span>
            {setting.overridden && <Badge variant="warning" size="md">overridden</Badge>}
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">{setting.description}</p>
        </div>

        {isBool ? (
          // Switching a flag is not destructive, so no danger red: the state
          // reads from the dot (green on, hollow off) and the label.
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            loading={pending}
            onClick={() => onSave(!setting.value)}
          >
            <span
              aria-hidden
              className={`h-2.5 w-2.5 rounded-full border-[1.5px] ${
                setting.value
                  ? 'border-navy bg-success-500 dark:border-success-300'
                  : 'border-gray-400 bg-transparent dark:border-gray-500'
              }`}
            />
            {setting.value ? 'On — turn off' : 'Off — turn on'}
          </Button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`${FIELD} w-48 font-mono`}
              placeholder="(empty)"
            />
            <Button size="sm" loading={pending} onClick={() => onSave(text || null)}>Save</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
