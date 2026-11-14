import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { totpSetup, totpEnable, totpDisable } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Card from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import BackButton from '../components/ui/BackButton';
import DeleteAccountCard from '../components/DeleteAccountCard';
import { useDocumentTitle } from '../utils/useDocumentTitle';

function errDetail(e: unknown): string | undefined {
  return (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
}

export default function SecurityPage() {
  useDocumentTitle('Security · Fetchpawz');
  const { user, refreshUser } = useAuth();
  const [secret, setSecret] = useState<string | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [disablePwd, setDisablePwd] = useState('');
  const [disableCode, setDisableCode] = useState('');

  const setup = useMutation({
    mutationFn: totpSetup,
    onSuccess: (r) => { setSecret(r.secret); setUri(r.otpauth_uri); },
    onError: (e) => toast.error(errDetail(e) || 'Could not start setup'),
  });
  const enable = useMutation({
    mutationFn: () => totpEnable(code),
    onSuccess: async () => {
      toast.success('Two-factor authentication enabled');
      setSecret(null); setUri(null); setCode('');
      await refreshUser();
    },
    onError: (e) => toast.error(errDetail(e) || 'Invalid code'),
  });
  const disable = useMutation({
    // Either proof works on the server. The form used to send a password
    // only, so an account that signs in with Google or GitHub — and has no
    // password at all — could switch 2FA on and never off again.
    mutationFn: () =>
      totpDisable(disableCode ? { code: disableCode } : { password: disablePwd }),
    onSuccess: async () => {
      toast.success('Two-factor authentication disabled');
      setDisablePwd('');
      setDisableCode('');
      await refreshUser();
    },
    onError: (e) => toast.error(errDetail(e) || 'Could not disable'),
  });

  const enabled = user?.totp_enabled;

  return (
    <div className="max-w-md mx-auto p-4">
      <BackButton fallback="/app/home" />
      <h1 className="text-2xl font-bold mt-2 mb-1">Security</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Two-factor authentication adds a one-time code from an authenticator app to your login.
      </p>

      <Card>
        <div className="flex items-center gap-2 mb-3">
          <span className="font-semibold">Two-factor authentication</span>
          <Badge variant={enabled ? 'success' : 'neutral'} className="uppercase">
            {enabled ? 'On' : 'Off'}
          </Badge>
        </div>

        {enabled ? (
          <div className="space-y-2">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              2FA is protecting your account. To turn it off, confirm with a current
              code from your authenticator app, or your password.
            </p>
            <Input
              label="Code from app"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.trim())}
            />
            <Input
              label="Or your password"
              type="password"
              value={disablePwd}
              onChange={(e) => setDisablePwd(e.target.value)}
              autoComplete="current-password"
            />
            <Button
              size="sm"
              variant="danger"
              loading={disable.isPending}
              disabled={disableCode.length < 6 && !disablePwd}
              onClick={() => disable.mutate()}
            >
              Disable 2FA
            </Button>
          </div>
        ) : secret ? (
          <div className="space-y-3">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Add this secret to your authenticator app (or open the setup link), then enter the current code.
            </p>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/60 p-3 text-sm">
              <p className="text-xs text-gray-500 dark:text-gray-400">Secret</p>
              <p className="font-mono break-all">{secret}</p>
              {uri && (
                <a href={uri} className="text-xs text-brand-500 hover:underline break-all block mt-1">
                  Open in authenticator app
                </a>
              )}
            </div>
            <Input
              label="Code from app"
              inputMode="numeric"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            <Button size="sm" loading={enable.isPending} disabled={code.length < 6} onClick={() => enable.mutate()}>
              Turn on 2FA
            </Button>
          </div>
        ) : (
          <Button size="sm" loading={setup.isPending} onClick={() => setup.mutate()}>
            Set up 2FA
          </Button>
        )}
      </Card>

      <DeleteAccountCard />
    </div>
  );
}
