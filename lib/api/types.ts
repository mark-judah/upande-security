import type { WorkflowState } from '@/constants/workflowStates';
import type { TransportMode } from '@/constants/transportModes';

export type VisitorAppointmentSearchResult = {
  has_appointment: boolean;
  visitor_name?: string;
  id_no?: string;
  phone_number?: string;
  organization?: string;
  host_id?: string;
  host_name?: string;
  scheduled_time?: string;
  purpose?: string;
  transport_mode?: TransportMode;
  vehicle_reg_no?: string;
  vehicle_color?: string;
  name?: string;
  status?: string;
};

export type Appointment = {
  name: string;
  customer_name: string;
  customer_phone_number?: string;
  customer_email?: string;
  custom_meet_with?: string;
  host_name?: string;
  scheduled_time?: string;
  customer_details?: string;
  status: string;
  workflow_state: WorkflowState;
  custom_mode_of_transport?: TransportMode;
  custom_vehicles_number_plate?: string;
  custom_vehicles_colour?: string;
  custom_reporting_status?: string;
  custom_check_in_time?: string;
  custom_check_out_time?: string;
  custom_visitor_badge?: string;
  custom_visitor_badge_number?: number | null;
  custom_visitor_badge_company?: string;
  custom_visitor_badge_farm?: string;
  custom_host_received_time?: string;
  custom_number_of_passengers?: number;
  custom_visitor_type?: 'Visitor' | 'Staff' | 'Contractor' | 'Customer';
  custom_contractor_ref?: string;
  custom_temp_exit_time?: string;
};

export type VisitorHistoryResult = {
  found: boolean;
  visitor_name?: string;
  phone_number?: string;
  id_no?: string;
  host_id?: string;
  host_name?: string;
  purpose?: string;
  transport_mode?: TransportMode;
  vehicle_reg_no?: string;
  vehicle_color?: string;
  last_visit_date?: string;
};

export type EmployeeResult = {
  name: string;
  employee_name: string;
  first_name?: string;
  last_name?: string;
  designation?: string;
  department?: string;
  status: string;
};

export type Employee = {
  name: string;
  employee_name: string;
  first_name?: string;
  last_name?: string;
  designation?: string;
  department?: string;
  company?: string;
  status?: string;
  default_shift?: string;
  image?: string;
  custom_farm?: string;
  custom_location?: string;
  custom_employee_category?: string;
};

export type AttendanceStatus =
  | 'Present'
  | 'Absent'
  | 'On Leave'
  | 'Half Day'
  | 'Work From Home';

export type Attendance = {
  name: string;
  doctype: 'Attendance';
  naming_series?: string;
  employee: string;
  employee_name?: string;
  status: AttendanceStatus;
  attendance_date: string;
  in_time?: string;
  out_time?: string;
  working_hours?: number;
  late_entry?: 0 | 1;
  early_exit?: 0 | 1;
  company?: string;
  department?: string;
  shift?: string;
  docstatus?: 0 | 1 | 2;
  custom_temp_exit_time?: string;
};

export type StaffSearchResult = {
  full_name?: string;
  employee_id?: string;
};

export type ContractorVehicle = {
  number_plate: string;
  colour?: string;
  vehicle_type?: string;
};

export type ContractorProject = {
  name: string;
  project_name?: string;
  status?: string;
  is_active?: 'Yes' | 'No' | string;
  expected_end_date?: string;
};

export type ContractorPersonnelHistoryResult = {
  found: boolean;
  full_name?: string;
  id_number?: string;
  last_contractor_name?: string;
  last_visit_date?: string;
};

export type ContractorSearchResult = {
  // Real Contract docname (party_type=Supplier), not the Supplier's own
  // name — may point at a lapsed/unsigned contract when has_active_contract
  // is false, so the gate can say *why*, not just "not found".
  contract_name?: string;
  contractor_name?: string;
  // is_contractor = true means a Supplier matched (custom_is_contractor=1) —
  // their standing identity as a contractor org, independent of whether
  // they currently have an active contract.
  is_contractor?: boolean;
  // Real check: is there a Contract for this supplier with status=Active
  // (ERPNext-computed from is_signed + start_date/end_date), not just "a
  // supplier record exists". This is the actual gate-access decision.
  has_active_contract?: boolean;
  contract_status?: 'Unsigned' | 'Active' | 'Inactive' | 'Cancelled' | string;
  fulfilment_status?: string;
  contract_start?: string;
  contract_end?: string;
  // The contract's linked ongoing project (Contract.document_type=Project),
  // if any — null when the contract isn't tied to one.
  project?: ContractorProject | null;
  supplier_id?: string;
  supplier_group?: string;
  vehicles?: ContractorVehicle[];
  contact_phone?: string;
};

export type TractorDailyTask = {
  name: string;
  motor_vehicle?: string;
  farm?: string;
  operator?: string;
  custom_employee?: string;
  company?: string;
  erp_task?: string;
  timesheet?: string;
  task?: {
    name?: string;
    activity_type: string;
    description?: string;
    from_time?: string;
    to_time?: string;
    expected_hours?: number;
    hours?: number;
    completed?: 0 | 1;
    is_billable?: 0 | 1;
  }[];
  custom_gate_entry_time?: string;
  custom_gate_entry_farm?: string;
  custom_gate_exit_time?: string;
  custom_completion_note?: string;
  custom_gate_status?: 'Inside' | 'Exited' | null;
};

export type TimesheetDetail = {
  name?: string;
  doctype?: 'Timesheet Detail';
  activity_type: string;
  from_time: string;
  to_time: string;
  hours: number;
  expected_hours: number;
  description?: string;
  task?: string;
  is_billable?: 0 | 1;
  completed?: 0 | 1;
};

export type Timesheet = {
  name: string;
  doctype: 'Timesheet';
  naming_series?: string;
  title?: string;
  company?: string;
  employee: string;
  employee_name?: string;
  department?: string;
  start_date: string;
  end_date: string;
  status?: string;
  docstatus?: 0 | 1 | 2;
  total_hours?: number;
  total_billable_hours?: number;
  custom_asset?: string;
  time_logs: TimesheetDetail[];
};

export type DailySummary = {
  total_checked_in: number;
  total_checked_out: number;
  still_inside: number;
  still_inside_list: Appointment[];
  all: Appointment[];
};

export type IncidentSeverity = 'Low' | 'Medium' | 'High' | 'Critical';

export type IncidentCategory = {
  name: string;
};

export type IncidentReport = {
  name: string;
  doctype: 'Incident Report';
  naming_series?: string;
  incident_datetime: string;
  location: string;
  nature_of_incident: string;
  severity: IncidentSeverity;
  description: string;
  reported_by?: string;
  reporter_name?: string;
  reported_datetime?: string;
  attachment_1?: string;
  attachment_2?: string;
  attachment_3?: string;
  attachment_4?: string;
};

export type CreateIncidentInput = {
  incident_datetime: string;
  location: string;
  nature_of_incident: string;
  severity: IncidentSeverity;
  description: string;
  attachment_1?: string;
  attachment_2?: string;
  attachment_3?: string;
  attachment_4?: string;
};
