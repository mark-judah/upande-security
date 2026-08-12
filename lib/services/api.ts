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

export type SecurityHeadContact = {
  name: string;
  phone: string;
  company: string;
  farm: string;
};

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

export type StaffSearchMatch = {
  employee_id: string;
  full_name: string;
  department: string;
  designation: string;
  company: string;
  default_shift: string;
  custom_farm: string;
  custom_employee_category: string;
};
export type StaffSearchResult = { matches: StaffSearchMatch[] };

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
  custom_number_of_passengers: number;
  custom_visitor_type: 'Visitor' | 'Staff' | 'Contractor' | 'Customer';
  custom_contractor_ref: string;
  custom_temp_exit_time: string;
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
export type IssueVisitorBadgeResult = {
  badge_number: number;
  company: string;
  confirm_url: string;
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

export type ContractorPersonnelInput = {
  full_name: string;
  id_number?: string;
  is_team_leader?: boolean;
};
export type CreateContractorNotifyInput = {
  contractor_ref?: string;
  contractor_name?: string;
  host: string;
  phone?: string;
  purpose?: string;
  plate?: string;
  passengers?: number;
  transport_mode?: string;
  scope_of_work?: string;
  /** "YYYY-MM-DD HH:MM:SS" (Frappe datetime format) — see toFrappeDateTime in lib/utils/date.ts. */
  expected_exit?: string;
  /** Structured input — this method JSON-stringifies it into the `personnel` string param the server script expects. */
  personnel?: ContractorPersonnelInput[];
};
export type CreateContractorNotifyResult = {
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
  reported_by?: string;
};

export type ListIncidentsInput = {
  from_date?: string; // YYYY-MM-DD
  to_date?: string;   // YYYY-MM-DD
  limit?: number;
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

export type StaffCheckOutResult = {
  success: boolean;
  out_time: string;
  working_hours?: number;
};

export type CheckedInStaffRow = {
  name: string;
  employee: string;
  employee_name?: string;
  department?: string;
  in_time?: string;
  custom_temp_exit_time?: string;
  docstatus: number;
};

export type TempExitDoctype = 'Appointment' | 'Attendance';
export type TempExitDirection = 'out' | 'in';
export type TempExitResult = {
  success: boolean;
  direction: TempExitDirection;
  temp_exit_time?: string;
  out_time?: string;
  duration_minutes?: number;
};

export type VisitorHistoryResult =
  | {
      found: true;
      visitor_name?: string;
      id_no?: string;
      phone_number?: string;
      organization?: string;
      last_visit_date?: string;
    }
  | { found: false };

export type CreateWalkInInput = {
  customer_name: string;
  id_number?: string;
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

export type GateActivityRow = {
  name: string;
  customer_name: string;
  phone: string;
  purpose: string;
  scheduled_time: string;
  workflow_state:
    | 'Open'
    | 'Pending Secretary Review'
    | 'Pending Host Review'
    | 'Approved by Secretary'
    | 'Rescheduled by Secretary'
    | 'Rescheduled by Host'
    | 'Redirected to Another Host'
    | 'Rejected by Secretary'
    | 'Rejected by Host'
    | string;
  modified: string;
  host_id: string;
  host_name: string;
  actor: string;
  reason: string;
  extra_label: string;
  extra_value: string;
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
  custom_visitor_badge_number?: number | null;
  custom_host_received_time?: string;
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

export type PatrolReportType = 'Routine' | 'Incident';

export type FilePatrolReportInput = {
  patrol: string;
  report_type: PatrolReportType;
  observations: string;
  farm?: string;
  started_at?: string;
  ended_at?: string;
  severity?: IncidentSeverity;
  nature_of_incident?: string;
  incident_report?: string;
  attachment_1?: string;
  attachment_2?: string;
  attachment_3?: string;
  attachment_4?: string;
};
export type FilePatrolReportResult = {
  name: string;
  patrol: string;
  report_type: string;
  status: string;
  filed_at: string;
  points_logged: number;
  updated: boolean;
};

export type CurrentShift = {
  name: string;
  farm: string;
  shift_type: 'Day' | 'Night';
  start_date: string;
  end_date: string;
  status: 'Scheduled' | 'Active' | 'Ended' | 'Cancelled';
  guard_type: 'Internal' | 'External' | null;
  checked_in: 0 | 1;
};
export type MyCurrentShiftResult = { shift: CurrentShift | null; guard_type?: 'Internal' | 'External' | null };
export type CheckInShiftResult = { name: string; checked_in: 1 };

export type ScanAssetInput = {
  asset_code: string;
  latitude: number | string;
  longitude: number | string;
  accuracy?: number | string | null;
};
export type ScanAssetResult = {
  asset_code: string;
  asset_name: string | null;
  farm: string | null;
  is_new: boolean;
  latitude: string | null;
  longitude: string | null;
  location_sample_count: number;
};

export type ReportAssetMissingInput = {
  asset_code: string;
  latitude?: number | string;
  longitude?: number | string;
  accuracy?: number | string | null;
  remarks?: string;
};
export type ReportAssetMissingResult = { asset_code: string; status: 'Missing'; reported_at: string };

export type KnownAsset = {
  asset_code: string;
  asset_name: string | null;
  category: string | null;
  last_status: 'Found' | 'Missing' | null;
  last_seen_at: string | null;
  last_missing_reported_at: string | null;
};
export type MyAssetsAtFarmResult = { assets: KnownAsset[] };

export type ReportKpi = { label: string; value: number | string; sub?: string };
export type ReportColumn = { key: string; label: string; align?: 'left' | 'right' };
export type ReportTable = {
  title: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
};
export type ReportWatch = {
  title: string;
  tone: 'danger' | 'warn' | 'ok';
  rows: { label: string; detail: string }[];
};
export type IncidentPerson = {
  name: string;
  type: string;
  id_number: string;
  contact: string;
  notes: string;
};
export type IncidentDetail = {
  name: string;
  datetime: string;
  severity: string;
  status: string;
  nature: string;
  location: string;
  reporter: string;
  description: string;
  remarks: string;
  corrective_actions: string;
  resolution: string;
  resolution_datetime: string;
  assigned_to: string;
  attachments: string[];
  witnesses: IncidentPerson[];
  victims: IncidentPerson[];
  responsible: IncidentPerson[];
};
export type PatrolPoint = {
  lat: string;
  lng: string;
  at: string;
  guard: string;
  patrol: string;
};

export type SecurityReport = {
  tab: string;
  from_date: string;
  to_date: string;
  kpis: ReportKpi[];
  tables: ReportTable[];
  watch: ReportWatch[];
  /** incidents tab only — full incident records */
  details?: IncidentDetail[];
  /** patrols tab only — GPS points for the map */
  points?: PatrolPoint[];
  /** visitors/contractors tabs — farm filter options */
  farms?: string[];
  /** incidents tab — location filter options */
  locations?: string[];
};

export type SecurityReportFilters = { farm?: string; location?: string };

export type ReportTab =
  | 'overview'
  | 'visitors'
  | 'contractors'
  | 'staff'
  | 'vehicles'
  | 'incidents'
  | 'patrols';

// --- Gate Dispatch Verification (config-driven gate check against a
// Dispatch Form or similar dispatch doctype — see
// upande_security.api.gate_dispatch on the server) ---

export type DispatchSearchHit = {
  found: true;
  reference_doctype: string;
  reference_name: string;
  vehicle_no: string;
  driver_name: string;
  dispatch_datetime: string;
  farm: string;
  items_summary: string;
  source_status: string;
  is_authorized: boolean;
};
export type DispatchSearchMiss = { found: false; error: string };
export type DispatchSearchResult = DispatchSearchHit | DispatchSearchMiss;

export type GateVerificationStatus = 'Verified' | 'Rejected';

export type VerifyDispatchInput = {
  reference: string;
  gate_verification_status: GateVerificationStatus;
  remarks?: string;
};
export type VerifyDispatchResult = {
  name: string;
  reference_name: string;
  gate_verification_status: GateVerificationStatus;
  is_authorized: boolean;
};

export type ConfirmDispatchReturnResult = {
  name: string;
  gate_return_time: string;
};

// --- API surface ---

export const api = {
  // Session
  getSessionInfo: () => call<SessionInfo>('get_session_info'),
  getSecurityHeadContact: () => call<SecurityHeadContact>('get_security_head_contact'),

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
  filePatrolReport: (input: FilePatrolReportInput) =>
    call<FilePatrolReportResult>('file_patrol_report', input),
  myCurrentShift: () => call<MyCurrentShiftResult>('my_current_shift'),
  checkInShift: () => call<CheckInShiftResult>('check_in_shift'),

  // Asset protection — QR-scanned physical assets (water pumps, generators,
  // etc.). Scanning confirms presence and slowly refines the asset's
  // location as more guards scan the same sticker over time; missing-asset
  // reports go through a separate verb since there's no QR left to scan.
  scanAsset: (input: ScanAssetInput) => call<ScanAssetResult>('scan_asset', input),
  reportAssetMissing: (input: ReportAssetMissingInput) =>
    call<ReportAssetMissingResult>('report_asset_missing', input),
  myAssetsAtFarm: () => call<MyAssetsAtFarmResult>('my_assets_at_farm'),

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
  createContractorNotify: (input: CreateContractorNotifyInput) => {
    const { personnel, ...rest } = input;
    const body: Record<string, unknown> = { ...rest };
    if (personnel && personnel.length > 0) {
      body.personnel = JSON.stringify(
        personnel.map((p) => ({
          full_name: p.full_name,
          id_number: p.id_number ?? '',
          is_team_leader: Boolean(p.is_team_leader),
        })),
      );
    }
    return call<CreateContractorNotifyResult>('create_contractor_notify', body);
  },
  checkInVisitor: (input: CheckInInput) => call<CheckInResult>('check_in_visitor', input),
  checkOutVisitor: (name: string) => call<CheckOutResult>('check_out_visitor', { name }),
  issueVisitorBadge: (name: string, badge_number: string) =>
    call<IssueVisitorBadgeResult>('issue_visitor_badge', { name, badge_number }),
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
  createStaffAttendance: (employee: string) =>
    call<StaffAttendanceResult>('create_staff_attendance', { employee }),
  submitStaffAttendance: (name: string) =>
    call<StaffAttendanceResult>('submit_staff_attendance', { name }),
  checkOutStaffAttendance: (attendance_name: string) =>
    call<StaffCheckOutResult>('staff_gate_checkout', { attendance_name }),
  // Staff currently checked in via this app specifically (custom_gate_app_entry=1),
  // not the general Attendance list — feeds the gate checkout picker.
  listCheckedInStaff: () => call<{ staff: CheckedInStaffRow[] }>('list_checked_in_staff'),

  // Temp exit ("step out" / "return") — shared by the visitor/contractor
  // Inside list and the staff gate panel.
  setTempExit: (reference_doctype: TempExitDoctype, reference_name: string, direction: TempExitDirection) =>
    call<TempExitResult>('gate_temp_exit', { reference_doctype, reference_name, direction }),

  // Walk-in visitor history lookup (pre-fill from a past visit).
  getVisitorHistory: (query: string) =>
    call<VisitorHistoryResult>('get_visitor_history', { query }),

  // Pending approvals
  pendingApprovals: () => call<PendingApprovalRow[]>('pending_approvals'),
  approvedAppointments: () => call<ApprovedAppointmentRow[]>('approved_appointments'),
  gateActivity: () => call<GateActivityRow[]>('gate_activity'),

  // Reports (security management dashboard)
  securityReport: (
    tab: ReportTab,
    from_date: string,
    to_date: string,
    filters: SecurityReportFilters = {},
  ) =>
    call<SecurityReport>('security_report', {
      tab,
      from_date,
      to_date,
      farm: filters.farm || undefined,
      location: filters.location || undefined,
    }),

  // Incidents
  listIncidentCategories: () => call<IncidentCategory[]>('list_incident_categories'),
  createIncident: (input: CreateIncidentInput) =>
    call<CreatedIncident>('create_incident', input),
  myIncidents: () => call<IncidentSummary[]>('my_incidents'),
  listIncidents: (input: ListIncidentsInput = {}) =>
    call<IncidentSummary[]>('list_incidents', input),

  // Gate Dispatch Verification — config-driven gate check of trucks
  // against a Dispatch Form (or any future dispatch doctype). Read-only
  // against the source document; the server owns authorization checks.
  searchDispatchForGate: (reference: string) =>
    call<DispatchSearchResult>('search_dispatch_for_gate', { reference }),
  verifyDispatchAtGate: (input: VerifyDispatchInput) =>
    call<VerifyDispatchResult>('verify_dispatch_at_gate', input),
  confirmDispatchReturn: (name: string) =>
    call<ConfirmDispatchReturnResult>('confirm_dispatch_return', { name }),
};
