import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { deleteMyAccount } from '../api/auth';
import { useAuth } from '../store/AuthContext';
import { apiErrorMessage } from '../utils/apiError';
import Button from './ui/Button';
import Card from './ui/Card';
import Input from './ui/Input';
import Modal from './ui/Modal';

const CONFIRM_WORD = 'DELETE';

/**
 * Self-serve account closure.
 *
 * The published privacy policy states you can delete your account from inside
 * the app; until now `DELETE /users/me` existed but nothing called it, so the
 * policy described a control that did not exist. This is that control.
 *
 * Type-to-confirm rather than a plain confirm(): the action cannot be undone
 * from the user's side, because login rejects deactivated accounts.
 */
export default function DeleteAccountCard() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const { logout } = useAuth();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: deleteMyAccount,
    onSuccess: () => {
      toast.success('Your account has been closed.');
      logout();
      navigate('/', { replace: true });
    },
    onError: (err) => toast.error(apiErrorMessage(err, "Couldn't close your account")),
  });

  return (
    <Card className="border-danger-200 dark:border-danger-500/30">
      <h2 className="text-base font-bold tracking-tight text-danger-700 dark:text-danger-300">
        Close your account
      </h2>
      <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
        Deactivates your profile and all of your pets immediately. They stop
        appearing in the deck, in rankings, and on public pages.{' '}
        <strong>You won&rsquo;t be able to log back in.</strong>
      </p>
      <Button
        variant="danger"
        size="sm"
        className="mt-4"
        onClick={() => {
          setTyped('');
          setOpen(true);
        }}
      >
        Close account
      </Button>

      <Modal
        open={open}
        onClose={() => {
          if (!mutation.isPending) setOpen(false);
        }}
        title="Close your account?"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            This deactivates your profile and every pet you own, and you will not
            be able to sign in again. If you just want a break, you can log out
            instead.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            To confirm, type <strong className="font-mono">{CONFIRM_WORD}</strong> below.
          </p>
          <Input
            label={`Type ${CONFIRM_WORD} to confirm`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
          />
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setOpen(false)}
              disabled={mutation.isPending}
            >
              Keep my account
            </Button>
            <Button
              type="button"
              variant="danger"
              className="flex-1"
              disabled={typed.trim().toUpperCase() !== CONFIRM_WORD}
              loading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Close account
            </Button>
          </div>
          <p className="text-2xs text-gray-400 dark:text-gray-500">
            Need your data removed entirely rather than deactivated? Email
            support and we&rsquo;ll handle it.
          </p>
        </div>
      </Modal>
    </Card>
  );
}
