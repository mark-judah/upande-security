import client from '@/lib/api/client';

/**
 * Single network surface for the upande_security mobile app.
 *
 * Every method on the exported `api` object maps 1:1 to a Server Script verb
 * deployed on the Frappe instance — see `frappe/scripts/*.py` and
 * `frappe/server_scripts.json` for the server-side source of truth.
 *
 * Soft-fail contract: server scripts return `frappe.response["message"]`,
 * with `{ error: "..." }` on validation/business failure (HTTP 200). The
 * `call<T>` wrapper below promotes that to a thrown error so callers see one
 * consistent failure path.
 *
 * Convention: client method names use lowerCamelCase; server api_method
 * names use snake_case. The mapping is in the path passed to `call`.
 */

async function call<T>(method: string, body: object = {}): Promise<T> {
  const res = await client.post<{ message: T }>(`/api/method/${method}`, body);
  const msg = res.data.message as unknown as { error?: string } | T;
  if (
    msg &&
    typeof msg === 'object' &&
    'error' in msg &&
    (msg as { error?: string }).error
  ) {
    throw new Error((msg as { error: string }).error);
  }
  return res.data.message;
}

// --- Types ---

export type SessionInfo = {
  user: string;
  full_name: string;
  roles: string[];
  is_gate_guard: boolean;
  is_security_head: boolean;
  employee:
    | {
        name?: string;
        employee_name?: string;
        department?: string;
        designation?: string;
        company?: string;
        custom_farm?: string;
      }
    | Record<string, never>;
};

export type VisitorSearchHit = {
  has_appointment: true;
  name: string;
  visitor_name: string;
  id_no: string;
  phone_number: string;
  organization: string;
  host_id: string;
  host_name: string;
  scheduled_time: string;
  purpose: string;
  transport_mode: string;
  vehicle_reg_no: string;
  vehicle_color: string;
  status: string;
  reporting_status: string;
};
export type VisitorSearchMiss = { has_appointment: false; query: string };
export type VisitorSearchResult = VisitorSearchHit | VisitorSearchMiss;

export type StaffSearchHit = {
  found: true;
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  company: string;
  default_shift: string;
  custom_farm: string;
  custom_employee_category: string;
};
export type StaffSearchMiss = { found: false; query: string };
export type StaffSearchResult = StaffSearchHit | StaffSearchMiss;

export type ContractorVehicle = {
  number_plate: string;
  colour: string;
  vehicle_type: string;
};

export type ContractorContractResult = {
  contract_name: string | null;
  contractor_name: string | null;
  supplier_id: string | null;
  supplier_group?: string | null;
  is_contractor: boolean;
  is_approved?: boolean;
  approved_by?: string | null;
  approval_date?: string | null;
  access_start?: string | null;
  access_end?: string | null;
  contact_phone?: string;
  vehicles: ContractorVehicle[];
  error?: string;
};

export type ContractorCheckInInput = {
  appointment_name?: string;
  contractor_ref?: string;
  contractor_name?: string;
  phone?: string;
  company?: string;
  purpose?: string;
  transport_mode?: string;
  number_plate?: string;
  vehicle_color?: string;
  passengers?: number;
};
export type ContractorCheckInResult = {
  success: boolean;
  appointment_name: string;
  check_in_time: string;
};
export type ContractorCheckOutResult = {
  success: boolean;
  appointment: string;
  check_out_time: string;
};

export type EmployeeHit = {
  name: string;
  employee_name: string;
  designation: string;
  department: string;
  status: string;
};

export type EmployeeFull = {
  name: string;
  employee_name: string;
  department: string;
  designation: string;
  company: string;
  default_shift: string;
  custom_farm: string;
  custom_employee_category: string;
  status: string;
};

export type DailySummaryRow = {
  name: string;
  customer_name: string;
  customer_phone_number: string;
  custom_meet_with: string;
  host_name: string;
  workflow_state: string;
  custom_reporting_status: string;
  custom_check_in_time: string;
  custom_check_out_time: string;
  scheduled_time: string;
  custom_mode_of_transport: string;
  custom_vehicles_number_plate: string;
  custom_vehicles_colour: string;
  customer_details: string;
};

export type DailySummary = {
  date: string;
  total_checked_in: number;
  total_checked_out: number;
  still_inside: number;
  still_inside_list: DailySummaryRow[];
  all: DailySummaryRow[];
};

export type AppointmentDoc = {
  name: string;
  customer_name: string;
  customer_phone_number: string;
  customer_email: string;
  custom_meet_with: string;
  host_name: string;
  scheduled_time: string;
  customer_details: string;
  custom_mode_of_transport: string;
  custom_vehicles_number_plate: string;
  custom_vehicles_colour: string;
  workflow_state: string;
  status: string;
  custom_reporting_status: string;
  custom_check_in_time: string;
  custom_check_out_time: string;
};

export type CheckInResult = {
  name: string;
  custom_reporting_status: string;
  custom_check_in_time: string;
};
export type CheckOutResult = {
  name: string;
  custom_reporting_status: string;
  custom_check_out_time: string;
};
export type CreateWalkInResult = {
  name: string;
  customer_name: string;
  host_id: string;
  custom_reporting_status: string;
  custom_check_in_time: string;
};

export type NotifyHostResult = {
  success: boolean;
  appointment: string;
  workflow_state: string;
  notified: number;
};

export type CreateWalkInNotifyResult = {
  name: string;
  customer_name: string;
  host_id: string;
  workflow_state: string;
  notified: number;
};

export type CheckInInput = {
  name: string;
  transport?: string;
  plate?: string;
  colour?: string;
  passengers?: number;
};
export type VehicleTicketHit = {
  name: string;
  motor_vehicle: string;
  farm: string;
  operator: string;
  custom_employee: string;
  company: string;
  date: string;
  erp_task: string;
  timesheet: string;
  workflow_state: string;
};

export type VehicleTaskRow = {
  name: string;
  activity_type: string;
  description: string;
  from_time: string;
  to_time: string;
  hours: number;
  completed: number;
  task: string;
  is_billable: number;
};

export type VehicleTicket = VehicleTicketHit & {
  operator_name: string;
  employee_name: string;
  location: string;
  custom_qr_code: string;
  task: VehicleTaskRow[];
};

export type MarkTaskResult = {
  ticket: string;
  task_row: string | null;
  completed: number;
  message?: string;
};

export type CreateGateTimesheetResult = {
  name: string;
  ticket: string;
  entry_time: string;
  activity_type: string;
  description: string;
};
export type SubmitGateTimesheetResult = {
  name: string;
  docstatus: number;
  exit_time?: string;
  hours?: number;
  completion_note?: string;
  message?: string;
};

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type IncidentCategory = { name: string };

export type IncidentSummary = {
  name: string;
  incident_datetime: string;
  location: string;
  nature_of_incident: string;
  severity: string;
  description: string;
  status: string;
  reported_datetime: string;
};

export type CreateIncidentInput = {
  incident_datetime?: string;
  location?: string;
  nature_of_incident: string;
  severity: IncidentSeverity;
  description?: string;
  attachment_1?: string;
  attachment_2?: string;
  attachment_3?: string;
  attachment_4?: string;
};

export type CreatedIncident = {
  name: string;
  incident_datetime: string;
  location: string;
  nature_of_incident: string;
  severity: string;
  description: string;
  reported_by: string;
  reporter_name: string;
  status: string;
};

export type StaffAttendanceResult = {
  name: string;
  employee?: string;
  employee_name?: string;
  status?: string;
  in_time?: string;
  docstatus: number;
  message?: string;
};

export type CreateWalkInInput = {
  customer_name: string;
  phone: string;
  host: string;
  email?: string;
  purpose?: string;
  transport?: string;
  plate?: string;
  colour?: string;
  passengers?: number;
  scheduled_time?: string;
};

export type PendingApprovalRow = {
  name: string;
  customer_name: string;
  phone: string;
  purpose: string;
  scheduled_time: string;
  workflow_state: string;
  host_id: string;
  host_name: string;
};

export type ApprovedAppointmentRow = {
  name: string;
  customer_name: string;
  phone: string;
  purpose: string;
  scheduled_time: string;
  workflow_state: 'Approved by Host' | 'Visitor Checked In' | string;
  host_id: string;
  host_name: string;
  check_in_time: string;
  transport: string;
  plate: string;
  colour: string;
  passengers: number;
};

export type PatrolPointInput = {
  patrol_tag: string;
  guard?: string;
  latitude: number | string;
  longitude: number | string;
  accuracy?: number | string | null;
  captured_at: string;
};
export type PatrolPointResult = {
  status: 'success' | 'error';
  name?: string;
  patrol_tag?: string;
  captured_at?: string;
  duplicate?: boolean;
  message?: string;
};

// --- API surface ---

export const api = {
  // Session
  getSessionInfo: () => call<SessionInfo>('get_session_info'),

  // Searches (visitor / staff / contractor)
  searchVisitorAppointment: (query: string) =>
    call<VisitorSearchResult>('search_visitor_appointment', { query }),
  searchStaff: (query: string) => call<StaffSearchResult>('search_staff', { query }),

  // Contractor flow (Supplier-backed, with vehicle child table)
  // Server scripts: getContractorContract / contractor_gate_checkin / contractor_gate_checkout
  searchContractor: (query: string) =>
    call<ContractorContractResult>('getContractorContract', { query }),
  contractorCheckIn: (input: ContractorCheckInInput) =>
    call<ContractorCheckInResult>('contractor_gate_checkin', input),
  contractorCheckOut: (appointment_name: string) =>
    call<ContractorCheckOutResult>('contractor_gate_checkout', { appointment_name }),

  // Patrol GPS — body is an array; response is an array of per-row results.
  // The wrapper's soft-fail check only runs for object responses, so the
  // top-level shape passes through.
  submitPatrolPoints: (points: PatrolPointInput[]) =>
    call<PatrolPointResult[]>('submit_patrol_points', points as unknown as object),

  // Employees (host search + lookup)
  searchEmployees: (query: string) =>
    call<EmployeeHit[]>('search_employees', { query }),
  getEmployee: (name: string) => call<EmployeeFull>('get_employee', { name }),

  // Summary tab
  dailySummary: (date?: string) =>
    call<DailySummary>('daily_summary', date ? { date } : {}),

  // Visitor flow
  getAppointment: (name: string) => call<AppointmentDoc>('get_appointment', { name }),
  notifyHost: (name: string) => call<NotifyHostResult>('notify_host', { name }),
  createWalkInAndNotify: (input: CreateWalkInInput) =>
    call<CreateWalkInNotifyResult>('create_walk_in_notify', input),
  checkInVisitor: (input: CheckInInput) => call<CheckInResult>('check_in_visitor', input),
  checkOutVisitor: (name: string) => call<CheckOutResult>('check_out_visitor', { name }),
  createWalkIn: (input: CreateWalkInInput) =>
    call<CreateWalkInResult>('create_walk_in', input),

  // Vehicle flow (Tractor Daily Task)
  searchVehicleTickets: (query: string) =>
    call<VehicleTicketHit[]>('search_vehicle_tickets', { query }),
  getVehicleTicket: (name: string) => call<VehicleTicket>('get_vehicle_ticket', { name }),
  markVehicleTaskCompleted: (ticket: string, task_row?: string) =>
    call<MarkTaskResult>('mark_vehicle_task_completed', { ticket, task_row }),

  // Gate timesheet (vehicle entry/exit lifecycle)
  createGateTimesheet: (ticket: string, entry_time?: string) =>
    call<CreateGateTimesheetResult>('create_gate_timesheet', { ticket, entry_time }),
  submitGateTimesheet: (timesheet: string, exit_time: string, completion_note: string) =>
    call<SubmitGateTimesheetResult>('submit_gate_timesheet', {
      timesheet,
      exit_time,
      completion_note,
    }),

  // Staff attendance
  createStaffAttendance: (employee: string, vehicle_plate?: string) =>
    call<StaffAttendanceResult>('create_staff_attendance', { employee, vehicle_plate }),
  submitStaffAttendance: (name: string) =>
    call<StaffAttendanceResult>('submit_staff_attendance', { name }),

  // Pending approvals
  pendingApprovals: () => call<PendingApprovalRow[]>('pending_approvals'),
  approvedAppointments: () => call<ApprovedAppointmentRow[]>('approved_appointments'),

  // Incidents
  listIncidentCategories: () => call<IncidentCategory[]>('list_incident_categories'),
  createIncident: (input: CreateIncidentInput) =>
    call<CreatedIncident>('create_incident', input),
  myIncidents: () => call<IncidentSummary[]>('my_incidents'),
};
