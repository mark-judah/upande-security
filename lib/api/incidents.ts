// Thin shim over the server-script verbs in lib/services/api.ts.
// uploadIncidentPhoto stays on /api/method/upload_file — it's the stock
// Frappe file-upload endpoint, not a custom verb.
import client from './client';
import { api } from '@/lib/services/api';
import type {
  CreateIncidentInput,
  IncidentCategory,
  IncidentReport,
} from './types';

export async function fetchIncidentCategories(): Promise<IncidentCategory[]> {
  const cats = await api.listIncidentCategories();
  return cats.map((c) => ({ name: c.name }));
}

export async function createIncidentReport(
  input: CreateIncidentInput,
): Promise<IncidentReport> {
  const created = await api.createIncident(input as Parameters<typeof api.createIncident>[0]);
  return created as unknown as IncidentReport;
}

export async function fetchMyIncidents(_userEmail: string): Promise<IncidentReport[]> {
  // The server script scopes to frappe.session.user — argument kept for API
  // back-compat with existing callers.
  const rows = await api.myIncidents();
  return rows as unknown as IncidentReport[];
}

export async function uploadIncidentPhoto(fileUri: string, fileName: string): Promise<string> {
  const form = new FormData();
  // React Native FormData accepts { uri, name, type } for file fields.
  form.append('file', {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uri: fileUri,
    name: fileName,
    type: 'image/jpeg',
  } as any);
  form.append('is_private', '0');
  form.append('folder', 'Home/Attachments');

  const res = await client.post<{ message: { file_url: string } }>(
    '/api/method/upload_file',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data.message.file_url;
}
