import api from './client';
import type { Appointment, DailySummary } from './types';

export async function fetchDailySummary({ date }: { date: Date }): Promise<DailySummary> {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const start = `${y}-${m}-${d} 00:00:00`;
  const end = `${y}-${m}-${d} 23:59:59`;

  const filters = encodeURIComponent(
    JSON.stringify([['Appointment', 'scheduled_time', 'between', [start, end]]]),
  );
  const fields = encodeURIComponent(
    JSON.stringify([
      'name',
      'customer_name',
      'customer_phone_number',
      'custom_meet_with',
      'workflow_state',
      'custom_reporting_status',
      'custom_check_in_time',
      'custom_check_out_time',
      'scheduled_time',
      'custom_mode_of_transport',
      'custom_vehicles_number_plate',
      'custom_vehicles_colour',
      'customer_details',
    ]),
  );

  const res = await api.get<{ data: Appointment[] }>(
    `/api/resource/Appointment?filters=${filters}&fields=${fields}&limit_page_length=200&order_by=custom_check_in_time desc`,
  );

  const all = res.data.data;
  const checkedIn = all.filter((a) => a.custom_check_in_time);
  const checkedOut = all.filter((a) => a.custom_check_out_time);
  const stillInside = checkedIn.filter((a) => !a.custom_check_out_time);

  return {
    total_checked_in: checkedIn.length,
    total_checked_out: checkedOut.length,
    still_inside: stillInside.length,
    still_inside_list: stillInside,
    all,
  };
}
