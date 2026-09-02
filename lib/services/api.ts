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
  // A 2xx response with no `message` field at all means the server didn't
  // actually return the shape every verb is supposed to produce — an
  // unhandled exception that fell through without setting
  // frappe.response["message"], a maintenance/redeploy page served at 200,
  // etc. Silently resolving to undefined here just moves the crash
  // downstream to whatever field a caller reads off it next (e.g.
  // `result.found`) with a much more confusing error. Fail loudly here
  // instead, at the one place that actually knows what happened.
  if (msg === undefined || msg === null) {
    throw new Error('Server returned an unexpected empty response for ' + method);
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
  // Gates the mobile "Command Center" admin section (shift planning, full
  // incident list, sticker/badge approvals, Security Ops Settings).
  // Server-resolved in get_session_info.py: true for Security Head /
  // System Manager by role, OR anyone listed in Security Ops Settings'
  // command_center_extra_users allowlist. Never re-derive this from
  // `roles` client-side — the allowlist-membership case has no signal the
  // client can see on its own.
  has_command_center_access: boolean;
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

// Staff Vehicle Sticker scan — a durable badge assigned to one employee at a
// time (see search_staff_vehicle_sticker), scanned once to resolve straight
// to that employee instead of the guard typing a name/ID. Always resolves to
// at most one employee (a sticker has exactly one holder), unlike Supplier
// Badge's scan which can fan out to several open POs.
export type StaffStickerScanHit = StaffSearchMatch & {
  found: true;
  vehicle_type: string;
  plate_number: string;
  color: string;
};
export type StaffStickerScanMiss = { found: false; error: string };
export type StaffStickerScanResult = StaffStickerScanHit | StaffStickerScanMiss;

export type ContractorVehicle = {
  number_plate: string;
  colour: string;
  vehicle_type: string;
};

export type ContractorProject = {
  name: string;
  project_name?: string;
  status?: string;
  is_active?: 'Yes' | 'No' | string;
  expected_end_date?: string;
};

export type ContractorContractResult = {
  // Real Contract docname (party_type=Supplier) — not the Supplier's own
  // name — may point at a lapsed/unsigned contract when has_active_contract
  // is false.
  contract_name: string | null;
  contractor_name: string | null;
  supplier_id: string | null;
  supplier_group?: string | null;
  // is_contractor = a Supplier matched (custom_is_contractor=1); their
  // standing identity, independent of contract status.
  is_contractor: boolean;
  // has_active_contract = the real gate-access decision: a Contract row
  // for this supplier with status=Active (ERPNext-computed from is_signed
  // + start_date/end_date).
  has_active_contract?: boolean;
  contract_status?: 'Unsigned' | 'Active' | 'Inactive' | 'Cancelled' | string;
  fulfilment_status?: string;
  contract_start?: string | null;
  contract_end?: string | null;
  project?: ContractorProject | null;
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
  entry_gate?: string;
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

export type FarmGate = {
  gate_name: string;
  is_main_gate: boolean;
};

export type CheckInInput = {
  name: string;
  transport?: string;
  plate?: string;
  colour?: string;
  passengers?: number;
  entry_gate?: string;
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

// Contractor Personnel history — unlike VisitorHistoryResult, there is no
// "today's appointment" match path: the same individual can legitimately be
// sent by different contractor companies (or the same one) on different
// visits, so this is a pure history-by-exact-ID-number lookup across ALL
// past Appointments' Contractor Personnel child rows. See
// get_contractor_personnel_history.py.
export type ContractorPersonnelHistoryResult =
  | {
      found: true;
      full_name?: string;
      id_number?: string;
      last_contractor_name?: string;
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
  custom_visitor_type?: 'Visitor' | 'Staff' | 'Contractor' | 'Customer' | string;
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

export type DispatchExpectedItem = {
  row_id: string;
  item_code: string;
  item_name: string;
  qty: number;
  uom: string | null;
};

// Fields shared by the primary scanned match AND every entry in its
// related_by_vehicle list — both come from the same server-side
// _lookup_in_source(). The related entries do NOT carry `found` or their
// own `related_by_vehicle` (only the top-level search_dispatch_for_gate
// response adds those two), so this base type is what actually matches
// the wire shape of a related_by_vehicle[] element; DispatchSearchHit
// below only adds the two extra fields on top of it for the primary
// match.
export type DispatchSearchHitFields = {
  reference_doctype: string;
  reference_name: string;
  vehicle_no: string;
  driver_name: string;
  dispatch_datetime: string;
  farm: string;
  items_summary: string;
  source_status: string;
  is_authorized: boolean;
  expected_items: DispatchExpectedItem[];
  /** Set when the most recent Gate Dispatch Verification for this reference
   * already has status "Verified" — the client should block re-verifying
   * (re-verifying after a Rejected attempt is still allowed server-side, so
   * this only ever reflects a prior Verified record). */
  already_verified?: boolean;
  already_verified_at?: string | null;
  already_verified_by?: string | null;
};

export type DispatchSearchHit = DispatchSearchHitFields & {
  found: true;
  /** Other open (not yet Verified) dispatch documents — across ALL enabled
   * Dispatch Sources, not just this one's — that share this match's
   * vehicle_no. One truck can genuinely be carrying more than one delivery
   * note at once; these are what let the guard release the whole load in
   * one action via verifyDispatchAtGateBulk instead of scanning each
   * document separately. Never includes the primary match itself, and
   * elements never carry their own nested related_by_vehicle.
   *
   * Optional, NOT guaranteed present: the server-side piece that adds this
   * (_find_related_by_vehicle / search_dispatch_for_gate) is real app code
   * pending its own redeploy — a live response can genuinely omit this
   * field entirely until that lands, and every read of it must treat
   * undefined the same as an empty list (this crashed the whole Dispatch
   * screen once already from a bare `.length` access — don't repeat that). */
  related_by_vehicle?: DispatchSearchHitFields[];
};
export type DispatchSearchMiss = { found: false; error: string };
export type DispatchSearchResult = DispatchSearchHit | DispatchSearchMiss;

export type GateVerificationStatus = 'Verified' | 'Rejected';

export type DispatchItemCheckInput = {
  row_id: string;
  actual_qty: number;
};

export type VerifyDispatchInput = {
  reference: string;
  gate_verification_status: GateVerificationStatus;
  remarks?: string;
  item_checks?: DispatchItemCheckInput[];
  /** ISO timestamp captured client-side the moment the guard's search
   * found a match — distinct from gate_exit_time, which the server stamps
   * itself at submission time. */
  gate_arrival_time?: string;
  /** Guard-entered vehicle/driver at the gate — AUTHORITATIVE over whatever
   * the source document says (a guard swap of trucks/drivers must be
   * reflected even if the source document is stale), not just a fallback
   * for blank values. */
  vehicle_no?: string;
  driver_name?: string;
};

export type DispatchItemCheckResult = {
  item_code: string;
  item_name: string;
  expected_qty: number;
  actual_qty: number | null;
  match_status: 'Not Checked' | 'Matches' | 'Short' | 'Over';
};

export type VerifyDispatchResult = {
  name: string;
  reference_name: string;
  gate_verification_status: GateVerificationStatus;
  is_authorized: boolean;
  // Set to the new Incident Report's name when any item cleared the gate
  // short of its own paperwork — auto-filed server-side, category Theft.
  shortfall_incident: string | null;
  item_checks: DispatchItemCheckResult[];
};

// Bulk verify — the primary scanned dispatch plus any related_by_vehicle
// documents the guard additionally selected, released together against
// one shared vehicle/driver. No item_checks input here: item_checks is
// always returned empty per reference (every row lands "Not Checked",
// same as calling verify_dispatch_at_gate with item_checks omitted) —
// per-item quantity counting stays exclusive to the ONE primary document
// the guard is actually looking at, verified separately via the existing
// verifyDispatchAtGate/VerifyDispatchInput. Each reference still gets its
// own Gate Dispatch Verification record and can independently succeed or
// fail, hence the per-reference result union.
export type VerifyDispatchBulkHit = {
  name: string;
  reference_name: string;
  gate_verification_status: GateVerificationStatus;
  is_authorized: boolean;
  shortfall_incident: string | null;
  item_checks: DispatchItemCheckResult[];
};
export type VerifyDispatchBulkMiss = { reference: string; error: string };
export type VerifyDispatchBulkResult = {
  results: (VerifyDispatchBulkHit | VerifyDispatchBulkMiss)[];
};

// --- Gate Receiving Verification (inbound supplier deliveries checked
// against Purchase Order — see upande_security.api.gate_receiving on the
// server). Single-doctype, not config-driven like dispatch, since there's
// exactly one clear inbound-authorization document in this system. ---

export type ReceivingSearchHit = {
  found: true;
  purchase_order: string;
  supplier: string;
  supplier_name: string;
  po_status: string;
  supplier_active: boolean;
  transaction_date: string | null;
  schedule_date: string | null;
  items_summary: string;
  is_authorized: boolean;
};
export type ReceivingSearchMiss = { found: false; error: string };
export type ReceivingSearchResult = ReceivingSearchHit | ReceivingSearchMiss;

// Supplier Badge scan — a durable badge assigned to one supplier at a time
// (see upande_security.api.gate_receiving.search_receiving_by_supplier_badge).
// Unlike a plain PO/supplier-name lookup, a badge can resolve to several
// currently open POs at once — the guard picks which one matches the truck
// actually at the gate.
export type SupplierBadgeScanResult = {
  found: boolean;
  badge?: string;
  supplier?: string;
  supplier_name?: string;
  matches: ReceivingSearchHit[];
  error: string | null;
};

export type VerifyReceivingInput = {
  reference: string;
  gate_verification_status: GateVerificationStatus;
  vehicle_no?: string;
  driver_name?: string;
  remarks?: string;
};
export type VerifyReceivingResult = {
  name: string;
  purchase_order: string;
  gate_verification_status: GateVerificationStatus;
  is_authorized: boolean;
};

// Bulk verify — every PO the guard selected off one Supplier Badge scan,
// released together against the one truck/driver at the gate. Each
// reference still gets its own Gate Receiving Verification record and can
// independently succeed or fail (a stale/cancelled PO among several
// selected shouldn't block the rest) — hence a per-reference result union
// rather than a single pass/fail for the whole call.
export type VerifyReceivingBulkHit = {
  name: string;
  purchase_order: string;
  gate_verification_status: GateVerificationStatus;
  is_authorized: boolean;
};
export type VerifyReceivingBulkMiss = { reference: string; error: string };
export type VerifyReceivingBulkResult = {
  results: (VerifyReceivingBulkHit | VerifyReceivingBulkMiss)[];
};

export type ConfirmReceivingDepartureResult = {
  name: string;
  gate_departure_time: string;
};

// --- Customer appointment booking (book a future visit ahead of time for
// a known Customer — see search_customers / book_customer_appointment on
// the server). Phone/email are never typed client-side; the server stamps
// whatever's on the linked Customer record. ---

export type CustomerSearchHit = {
  name: string;
  customer_name: string;
  mobile_no: string;
  email_id: string;
};

export type BookCustomerAppointmentInput = {
  customer: string;
  person_name: string;
  id_number: string;
  host: string;
  scheduled_time: string;
  purpose: string;
};

export type BookCustomerAppointmentResult = {
  name: string;
  customer_name: string;
  custom_customer: string;
  host_id: string;
  scheduled_time: string;
  workflow_state: string;
};

// --- Command Center: Vehicle Sticker approvals ---
// (Shift Planning has its own types/wrapper in
// lib/services/securityDashboard.ts — see that file's header for why.)

export type StickerRequestStatus = 'Pending' | 'Approved' | 'Rejected';

export type StickerRequestRow = {
  name: string;
  employee: string;
  employee_name: string;
  vehicle_type: string;
  plate_number: string;
  color: string;
  collection_farm: string;
  collection_point: string;
  status: StickerRequestStatus | string;
  review_notes: string;
  linked_sticker: string;
  creation: string;
};

export type ListStickerRequestsInput = {
  /** Server defaults to "Pending" when omitted — pass "" explicitly to see all statuses. */
  status?: StickerRequestStatus | '';
  limit?: number;
};

export type StickerRequestActionResult = { success: true; request: string };

// --- Command Center: Supplier Badges (read-only for now — no
// create/edit mutation endpoint exists yet) ---

export type SupplierBadgeStatus = 'Unassigned' | 'Active' | 'Suspended' | 'Lost';

export type SupplierBadgeRow = {
  name: string;
  badge_number: string;
  company: string;
  supplier: string;
  supplier_name: string;
  status: SupplierBadgeStatus | string;
  qr_image: string;
  creation: string;
};

export type ListSupplierBadgesInput = {
  status?: SupplierBadgeStatus | '';
  company?: string;
  limit?: number;
};

// --- Command Center: Security Ops Settings ---

export type CommandCenterExtraUser = { user: string; full_name: string };

export type SecurityOpsSettings = {
  nearby_guard_alert_radius_m: number;
  nearby_alert_stale_minutes: number;
  missed_checkin_minutes: number;
  escalation_minutes: number;
  command_center_extra_users: CommandCenterExtraUser[];
};

export type UpdateSecurityOpsSettingsInput = {
  nearby_guard_alert_radius_m?: number;
  nearby_alert_stale_minutes?: number;
  missed_checkin_minutes?: number;
  escalation_minutes?: number;
  /** Full replacement of the allowlist by email — NOT an incremental
   * add/remove. Always send the complete desired list when editing this. */
  command_center_extra_users?: string[];
};

export type UpdateSecurityOpsSettingsResult = SecurityOpsSettings & {
  success: true;
  /** Emails in the submitted command_center_extra_users that don't match
   * a real User — silently dropped server-side, surfaced here so the UI
   * can warn instead of pretending they saved. */
  skipped_users: string[];
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
  searchStaffVehicleSticker: (reference: string) =>
    call<StaffStickerScanResult>('search_staff_vehicle_sticker', { reference }),

  // Contractor flow (Supplier-backed, with vehicle child table)
  // Server scripts: getContractorContract / contractor_gate_checkin / contractor_gate_checkout
  searchContractor: (query: string) =>
    call<ContractorContractResult>('getContractorContract', { query }),
  contractorCheckIn: (input: ContractorCheckInInput) =>
    call<ContractorCheckInResult>('contractor_gate_checkin', input),
  contractorCheckOut: (appointment_name: string, exit_gate?: string) =>
    call<ContractorCheckOutResult>('contractor_gate_checkout', { appointment_name, exit_gate }),

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
  checkOutVisitor: (name: string, exit_gate?: string) =>
    call<CheckOutResult>('check_out_visitor', { name, exit_gate }),
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
  createGateTimesheet: (ticket: string, entry_time?: string, entry_gate?: string) =>
    call<CreateGateTimesheetResult>('create_gate_timesheet', { ticket, entry_time, entry_gate }),
  submitGateTimesheet: (
    timesheet: string,
    exit_time: string,
    completion_note: string,
    exit_gate?: string,
  ) =>
    call<SubmitGateTimesheetResult>('submit_gate_timesheet', {
      timesheet,
      exit_time,
      completion_note,
      exit_gate,
    }),

  // Gate config — which gates a farm has (Security Ops Settings' Farm
  // Gates table), for the "which gate?" picker at entry/exit.
  getFarmGates: (farm: string) =>
    call<FarmGate[]>('upande_security.api.gate_movement.get_farm_gates', { farm }),

  // Staff attendance
  createStaffAttendance: (employee: string, vehiclePlate?: string) =>
    call<StaffAttendanceResult>('create_staff_attendance', {
      employee,
      vehicle_plate: vehiclePlate,
    }),
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

  // Contractor Personnel history lookup (pre-fill + lock a personnel row's
  // Full Name from a past visit, matched by exact id_number). No "today's
  // appointment" fast path — see get_contractor_personnel_history.py.
  getContractorPersonnelHistory: (id_number: string) =>
    call<ContractorPersonnelHistoryResult>('get_contractor_personnel_history', { id_number }),

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
  //
  // Full dotted path required, NOT the bare method name: these are plain
  // @frappe.whitelist() functions in api/gate_dispatch.py, not Server
  // Script api_methods. Frappe's /api/method/<cmd> resolver only resolves
  // bare names via the Server Script map (get_server_script_map()["_api"])
  // or a frappe.handler globals() lookup for legacy shorthand — neither
  // covers a plain app module function, so the bare name 404s with
  // "Failed to get method for command ...". Verified directly against
  // execute_cmd(): the bare name fails to resolve at all; the dotted path
  // resolves and calls the function correctly.
  searchDispatchForGate: (reference: string) =>
    call<DispatchSearchResult>('upande_security.api.gate_dispatch.search_dispatch_for_gate', {
      reference,
    }),
  verifyDispatchAtGate: (input: VerifyDispatchInput) =>
    call<VerifyDispatchResult>('upande_security.api.gate_dispatch.verify_dispatch_at_gate', input),
  // Releases every related_by_vehicle document the guard additionally
  // selected alongside the one they scanned — one shared vehicle/driver,
  // one guard action. The primary scanned document is verified separately
  // via verifyDispatchAtGate above (its own item_checks flow); this call
  // is only ever for the OTHER references on the same truck.
  verifyDispatchAtGateBulk: (input: {
    references: string[];
    gate_verification_status: GateVerificationStatus;
    remarks?: string;
    gate_arrival_time?: string;
    vehicle_no?: string;
    driver_name?: string;
  }) =>
    call<VerifyDispatchBulkResult>(
      'upande_security.api.gate_dispatch.verify_dispatch_at_gate_bulk',
      input,
    ),

  // Gate Receiving Verification — inbound supplier deliveries checked
  // against Purchase Order. Read-only against the source document; the
  // server owns the active-supplier / authorized-status checks. Same
  // full-dotted-path requirement as Gate Dispatch Verification above —
  // api/gate_receiving.py is a plain module, not a Server Script.
  //
  // NOTE: backend rename from gate_delivery -> gate_receiving (and
  // search_delivery_for_gate -> search_receiving_for_gate, etc.) was done
  // in a parallel security-backend task. These dotted paths follow the
  // same naming convention already established for gate_dispatch — double
  // check them against what the backend agent actually landed on before
  // shipping.
  searchReceivingForGate: (reference: string) =>
    call<ReceivingSearchResult>('upande_security.api.gate_receiving.search_receiving_for_gate', {
      reference,
    }),
  searchReceivingByBadge: (reference: string) =>
    call<SupplierBadgeScanResult>(
      'upande_security.api.gate_receiving.search_receiving_by_supplier_badge',
      { reference },
    ),
  verifyReceivingAtGate: (input: VerifyReceivingInput) =>
    call<VerifyReceivingResult>('upande_security.api.gate_receiving.verify_receiving_at_gate', input),
  // Releases every PO the guard selected off one Supplier Badge scan (2+
  // matches) in one action against a single shared vehicle/driver. Each
  // PO still gets its own Gate Receiving Verification record and can
  // independently succeed or fail.
  verifyReceivingAtGateBulk: (input: {
    references: string[];
    gate_verification_status: GateVerificationStatus;
    vehicle_no?: string;
    driver_name?: string;
    remarks?: string;
  }) =>
    call<VerifyReceivingBulkResult>(
      'upande_security.api.gate_receiving.verify_receiving_at_gate_bulk',
      input,
    ),
  confirmReceivingDeparture: (name: string) =>
    call<ConfirmReceivingDepartureResult>(
      'upande_security.api.gate_receiving.confirm_receiving_departure',
      { name },
    ),

  // Customer appointment booking — book a future visit ahead of time
  // (Gate tab's "Book Visit" chip). Bare Server Script api_method names,
  // same convention as searchContractor/createWalkIn above.
  searchCustomers: (query: string) =>
    call<CustomerSearchHit[]>('search_customers', { query }),
  bookCustomerAppointment: (input: BookCustomerAppointmentInput) =>
    call<BookCustomerAppointmentResult>('book_customer_appointment', input),

  // Command Center — Vehicle Sticker request approvals. Approve/reject are
  // role-gated server-side to System Manager/Security Head only (narrower
  // than the general has_command_center_access allowlist) — callers must
  // surface a permission-denied error cleanly rather than assume success.
  listStickerRequests: (input: ListStickerRequestsInput = {}) =>
    call<StickerRequestRow[]>('list_sticker_requests', input),
  approveStickerRequest: (request_name: string) =>
    call<StickerRequestActionResult>('approve_staff_sticker_request', { request_name }),
  rejectStickerRequest: (request_name: string, review_notes?: string) =>
    call<StickerRequestActionResult>('reject_staff_sticker_request', {
      request_name,
      review_notes,
    }),

  // Command Center — Supplier Badges, read-only list.
  listSupplierBadges: (input: ListSupplierBadgesInput = {}) =>
    call<SupplierBadgeRow[]>('list_supplier_badges', input),

  // Command Center — Security Ops Settings.
  getSecurityOpsSettings: () => call<SecurityOpsSettings>('get_security_ops_settings'),
  updateSecurityOpsSettings: (input: UpdateSecurityOpsSettingsInput) =>
    call<UpdateSecurityOpsSettingsResult>('update_security_ops_settings', input),
};
