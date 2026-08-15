import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import client from '../api/client';
import { ReportButton } from './ReportDialog';

afterEach(() => {
  vi.restoreAllMocks();
});

function renderButton() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ReportButton targetType="pet" targetId="pet-123" targetLabel="Rex" />
    </QueryClientProvider>,
  );
}

describe('ReportButton', () => {
  it('opens a dialog naming what is being reported', () => {
    renderButton();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /report/i }));
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-label', 'Report Rex');
  });

  it('posts the selected reason against the right target', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { id: 'r1' } });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /report/i }));

    fireEvent.click(screen.getByLabelText('Harassment or abuse'));
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith('/reports', {
      target_type: 'pet',
      target_id: 'pet-123',
      reason: 'Harassment or abuse',
    });
  });

  it('appends the optional detail to the reason', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { id: 'r1' } });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /report/i }));

    fireEvent.change(screen.getByLabelText(/anything else/i), {
      target: { value: 'they keep messaging me' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post.mock.calls[0][1]).toMatchObject({
      reason: 'Inappropriate or explicit content — they keep messaging me',
    });
  });

  it('keeps the reason within the 500-char limit the API enforces', async () => {
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { id: 'r1' } });
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /report/i }));

    fireEvent.change(screen.getByLabelText(/anything else/i), {
      target: { value: 'x'.repeat(600) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send report' }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    const body = post.mock.calls[0][1] as { reason: string };
    expect(body.reason.length).toBeLessThanOrEqual(500);
  });

  it('closes without sending when cancelled', () => {
    const post = vi.spyOn(client, 'post');
    renderButton();
    fireEvent.click(screen.getByRole('button', { name: /report/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(post).not.toHaveBeenCalled();
  });
});
