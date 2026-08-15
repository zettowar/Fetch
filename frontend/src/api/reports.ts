import client from './client';

export type ReportTargetType = 'photo' | 'pet' | 'user' | 'comment';

export interface Report {
  id: string;
  reporter_id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: string;
  admin_notes: string | null;
  created_at: string;
}

/**
 * File an abuse report. The backend takes a single free-text `reason`
 * (3–500 chars); the UI composes it from a preset category plus optional
 * detail so the admin queue gets consistent, sortable text.
 */
export async function createReport(payload: {
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
}): Promise<Report> {
  return (await client.post('/reports', payload)).data;
}

export async function getMyReports(): Promise<Report[]> {
  return (await client.get('/reports/mine')).data;
}
