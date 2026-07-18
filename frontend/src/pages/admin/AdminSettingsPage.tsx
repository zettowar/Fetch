import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { getSettings, putSetting, type AppSetting } from '../../api/admin';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { ListSkeleton } from '../../components/ui/Skeleton';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { data: settings = [], isLoading } = useQuery({
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
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Runtime feature flags. Changes take effect within ~30 seconds across all servers.
      </p>

      {isLoading ? (
        <ListSkeleton rows={3} />
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
            <p className="font-medium text-sm">Your account</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Password and two-factor auth are managed in your account security settings.
            </p>
          </div>
          <Link
            to="/app/security"
            className="shrink-0 text-sm font-semibold text-brand-600 dark:text-brand-400 hover:underline"
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">{setting.key}</span>
            {setting.overridden && <Badge variant="warning" size="md">overridden</Badge>}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{setting.description}</p>
        </div>

        {isBool ? (
          <Button
            size="sm"
            variant={setting.value ? 'danger' : 'secondary'}
            loading={pending}
            onClick={() => onSave(!setting.value)}
          >
            {setting.value ? 'On — turn off' : 'Off — turn on'}
          </Button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent px-2 py-1 text-sm w-48"
              placeholder="(empty)"
            />
            <Button size="sm" loading={pending} onClick={() => onSave(text || null)}>Save</Button>
          </div>
        )}
      </div>
    </Card>
  );
}
