import client from './client';

export type ReportTargetType = 'photo' | 'pet' | 'user' | 'comment' | 'post';

/** A report as its reporter sees it (moderator notes are staff-only). */
export interface Report {
  id: string;
  target_type: ReportTargetType;
  target_id: string;
  reason: string;
  status: string;
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
