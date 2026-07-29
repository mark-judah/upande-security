import api from './client';

export type TempExitDoctype = 'Appointment' | 'Attendance';
export type TempExitDirection = 'out' | 'in';

export type TempExitResult = {
  success: boolean;
  direction: TempExitDirection;
  temp_exit_time?: string;
  out_time?: string;
  duration_minutes?: number;
};

/**
 * Step someone currently inside "out" temporarily, or mark them returned —
 * used by both the visitor/contractor Inside list and the staff gate panel.
 * Backed by the gate_temp_exit server script.
 */
export async function setTempExit(
  referenceDoctype: TempExitDoctype,
  referenceName: string,
  direction: TempExitDirection,
): Promise<TempExitResult> {
  const params = new URLSearchParams();
  params.append('reference_doctype', referenceDoctype);
  params.append('reference_name', referenceName);
  params.append('direction', direction);
  const res = await api.post<{ message: TempExitResult }>('/api/method/gate_temp_exit', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return res.data.message;
}
