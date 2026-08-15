import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import client from '../api/client';
import TicketThreadPage from './TicketThreadPage';

afterEach(() => vi.restoreAllMocks());

const TICKET_ID = 'tkt-1';

function thread(overrides: Record<string, unknown> = {}) {
  return {
    id: TICKET_ID,
    subject: 'Swipes ran out early',
    body: 'I had 12 left and now 0.',
    source_screen: 'support',
    status: 'resolved',
    ticket_number: 'FETCH-ABC123',
    created_at: new Date().toISOString(),
    last_message_at: new Date().toISOString(),
    unread_count: 0,
    reply_count: 1,
    messages: [
      {
        id: 'm1',
        author_role: 'staff',
        body: 'Your allowance resets at midnight UTC.',
        created_at: new Date().toISOString(),
      },
    ],
    ...overrides,
  };
}

function renderIt() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[`/app/support/tickets/${TICKET_ID}`]}>
        <Routes>
          <Route path="/app/support/tickets/:id" element={<TicketThreadPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TicketThreadPage', () => {
  it('shows the opening message and the staff reply as one conversation', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: thread() });
    renderIt();

    expect(await screen.findByText('I had 12 left and now 0.')).toBeInTheDocument();
    expect(screen.getByText('Your allowance resets at midnight UTC.')).toBeInTheDocument();
    // The reply is attributed to support, never to the individual who wrote it.
    expect(screen.getByText(/fetchpawz support/i)).toBeInTheDocument();
  });

  it('warns that replying reopens a resolved ticket', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: thread() });
    renderIt();
    expect(await screen.findByText(/replying reopens this conversation/i)).toBeInTheDocument();
  });

  it('sends a reply and refetches the thread', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: thread() });
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { id: 'm2' } });

    renderIt();
    await screen.findByText('I had 12 left and now 0.');

    fireEvent.change(screen.getByLabelText(/reply/i), {
      target: { value: 'That did not work.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1));
    expect(post).toHaveBeenCalledWith(`/support/tickets/${TICKET_ID}/messages`, {
      body: 'That did not work.',
    });
  });

  it('offers no reply box once the ticket is closed', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: thread({ status: 'closed' }) });
    renderIt();

    expect(await screen.findByText(/this conversation is closed/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /send reply/i })).toBeNull();
  });

  it('will not send a whitespace-only reply', async () => {
    vi.spyOn(client, 'get').mockResolvedValue({ data: thread({ status: 'open' }) });
    const post = vi.spyOn(client, 'post').mockResolvedValue({ data: { id: 'm2' } });

    renderIt();
    await screen.findByText('I had 12 left and now 0.');

    fireEvent.change(screen.getByLabelText(/reply/i), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

    // The mutation would fire on a microtask, so asserting straight after the
    // click passes whether or not the guard exists. Give it a real chance to
    // run first — this test was worthless until it did.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /send reply/i })).toBeDisabled();
  });
});
