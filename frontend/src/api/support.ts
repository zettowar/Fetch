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
