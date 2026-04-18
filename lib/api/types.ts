import type { WorkflowState } from '@/constants/workflowStates';
import type { TransportMode } from '@/constants/transportModes';

export type VisitorAppointmentSearchResult = {
  has_appointment: boolean;
  visitor_name?: string;
  id_no?: string;
  phone_number?: string;
  organization?: string;
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
  custom_number_of_passengers?: number;
};

export type EmployeeResult = {
  name: string;
  employee_name: string;
  designation?: string;
  department?: string;
  status: string;
};

export type StaffSearchResult = {
  full_name?: string;
  employee_id?: string;
};

export type ContractorSearchResult = {
  contract_name?: string;
  contractor_name?: string;
};

export type TractorDailyTask = {
  name: string;
  motor_vehicle?: string;
  farm?: string;
  operator?: string;
  task?: { activity_type: string }[];
  custom_gate_entry_time?: string;
  custom_gate_entry_farm?: string;
  custom_gate_exit_time?: string;
  custom_completion_note?: string;
  custom_gate_status?: 'Inside' | 'Exited' | null;
};

export type DailySummary = {
  total_checked_in: number;
  total_checked_out: number;
  still_inside: number;
  still_inside_list: Appointment[];
  all: Appointment[];
};
