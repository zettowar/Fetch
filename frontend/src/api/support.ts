import client from './client';

export interface FAQEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  sort_order: number;
}

export interface Ticket {
  id: string;
  user_id: string;
  subject: string;
  body: string;
  source_screen: string | null;
  status: string;
  ticket_number: string;
  assigned_to: string | null;
  admin_notes: string | null;
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
