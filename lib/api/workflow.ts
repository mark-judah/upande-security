import api from './client';
import { fetchAppointmentDoc } from './visitors';
import type { Appointment } from './types';

export async function runWorkflowAction({ name, action }: { name: string; action: string }) {
  const doc = await fetchAppointmentDoc(name);
  const res = await api.post<{ message: Appointment }>(
    '/api/method/frappe.model.workflow.apply_workflow',
    { doc: JSON.stringify(doc), action },
  );
  return res.data.message;
}
