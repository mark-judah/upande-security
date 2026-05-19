import api from './client';
import { fetchAppointmentDoc } from './visitors';
import type { Appointment } from './types';

export async function runWorkflowAction({ name, action }: { name: string; action: string }) {
  const doc = await fetchAppointmentDoc(name);
  // Strip custom_meet_with before sending — if it contains a non-Employee value
  // (e.g. a supplier name set for contractors) Frappe's link validator will reject it.
  const safeDoc = { ...doc, custom_meet_with: doc.custom_meet_with ?? null };
  const res = await api.post<{ message: Appointment }>(
    '/api/method/frappe.model.workflow.apply_workflow',
    { doc: JSON.stringify(safeDoc), action },
  );
  return res.data.message;
}
