import api from './client';
import type {
  CreateIncidentInput,
  IncidentCategory,
  IncidentReport,
} from './types';

export async function fetchIncidentCategories(): Promise<IncidentCategory[]> {
  const fields = encodeURIComponent(JSON.stringify(['name']));
  const res = await api.get<{ data: IncidentCategory[] }>(
    `/api/resource/Incident Category?fields=${fields}&limit_page_length=100&order_by=name asc`,
  );
  return res.data.data;
}

export async function createIncidentReport(input: CreateIncidentInput): Promise<IncidentReport> {
  const res = await api.post<{ data: IncidentReport }>('/api/resource/Incident Report', input);
  return res.data.data;
}

export async function fetchMyIncidents(userEmail: string): Promise<IncidentReport[]> {
  const filters = encodeURIComponent(
    JSON.stringify([['Incident Report', 'reported_by', '=', userEmail]]),
  );
  const fields = encodeURIComponent(
    JSON.stringify([
      'name',
      'incident_datetime',
      'location',
      'nature_of_incident',
      'severity',
      'description',
    ]),
  );
  const res = await api.get<{ data: IncidentReport[] }>(
    `/api/resource/Incident Report?filters=${filters}&fields=${fields}&limit_page_length=50&order_by=incident_datetime desc`,
  );
  return res.data.data;
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

  const res = await api.post<{ message: { file_url: string } }>(
    '/api/method/upload_file',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return res.data.message.file_url;
}
