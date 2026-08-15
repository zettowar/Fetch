import client from './client';

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}

/** What the reporter may see about their own ticket. `admin_notes` is
 *  deliberately absent — staff use it for internal triage and the API no
 *  longer returns it on /tickets/mine. */
export interface Ticket {
  id: string;
  subject: string;
  body: string;
  source_screen: string | null;
  status: string;
  ticket_number: string;
  created_at: string;
  last_message_at: string | null;
  /** Staff replies not yet opened — drives the badge on the support tab. */
  unread_count: number;
  reply_count: number;
}

/** One reply. Carries no author identity: the reporter is talking to support,
 *  not to a named staff member whose profile they could go and find. */
export interface TicketMessage {
  id: string;
  author_role: 'user' | 'staff';
  body: string;
  created_at: string;
}

export interface TicketThread extends Ticket {
  messages: TicketMessage[];
}

export async function getFAQ(category?: string): Promise<FAQEntry[]> {
  return (await client.get('/support/faq', { params: category ? { category } : {} })).data;
}

export async function createTicket(payload: {
  subject: string;
  body: string;
  source_screen?: string;
}): Promise<Ticket> {
  return (await client.post('/support/tickets', payload)).data;
}

export async function getMyTickets(): Promise<Ticket[]> {
  return (await client.get('/support/tickets/mine')).data;
}

export async function getTicketThread(id: string): Promise<TicketThread> {
  return (await client.get(`/support/tickets/${id}`)).data;
}

export async function replyToTicket(id: string, body: string): Promise<TicketMessage> {
  return (await client.post(`/support/tickets/${id}/messages`, { body })).data;
}

export async function getUnreadTicketCount(): Promise<number> {
  return (await client.get('/support/tickets/unread-count')).data.unread;
}
