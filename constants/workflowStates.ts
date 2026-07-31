export type WorkflowState =
  | 'Open'
  | 'Pending Host Review'
  | 'Approved by Host'
  | 'Rescheduled by Host'
  | 'Rejected by Host'
  | 'Pending Secretary Review'
  | 'Approved by Secretary'
  | 'Rescheduled by Secretary'
  | 'Redirected to Another Host'
  | 'Rejected by Secretary'
  | 'Visitor Checked In'
  | 'Visitor Checked Out';

import type { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/src/core/theme';

export const WORKFLOW_META: Record<
  WorkflowState,
  { color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  Open:                          { color: COLORS.text,          icon: 'sparkles-outline' },
  'Pending Host Review':         { color: COLORS.textMuted,     icon: 'hourglass-outline' },
  'Approved by Host':            { color: COLORS.success,       icon: 'shield-checkmark' },
  'Rescheduled by Host':         { color: COLORS.info,          icon: 'refresh-circle-outline' },
  'Rejected by Host':            { color: COLORS.danger,        icon: 'close-circle' },
  'Pending Secretary Review':    { color: COLORS.textMuted,     icon: 'hourglass' },
  'Approved by Secretary':       { color: COLORS.success,       icon: 'checkmark-circle' },
  'Rescheduled by Secretary':    { color: COLORS.info,          icon: 'time-outline' },
  'Redirected to Another Host':  { color: COLORS.info,          icon: 'git-branch-outline' },
  'Rejected by Secretary':       { color: COLORS.danger,        icon: 'ban' },
  'Visitor Checked In':          { color: COLORS.text,          icon: 'log-in' },
  'Visitor Checked Out':         { color: COLORS.textMuted,     icon: 'log-out' },
};

/**
 * States where the guard has notified the host and is waiting for a response.
 * The app polls the appointment every 5 seconds while in these states.
 */
export const AWAITING_HOST_STATES: WorkflowState[] = ['Pending Host Review'];

/**
 * States from which the guard may check the visitor IN.
 * Host (or secretary) must have approved first.
 */
export const CHECK_IN_ALLOWED_FROM: WorkflowState[] = [
  'Approved by Host',
  'Approved by Secretary',
];

/**
 * States from which the guard may check the visitor OUT.
 */
export const CHECK_OUT_ALLOWED_FROM: WorkflowState[] = ['Visitor Checked In'];

/**
 * Terminal states where no further guard action is possible.
 */
export const TERMINAL_STATES: WorkflowState[] = [
  'Visitor Checked Out',
  'Rejected by Host',
  'Rejected by Secretary',
];

/**
 * Maps Frappe role names → the workflow states they can act on + the
 * workflow action strings to use with apply_workflow.
 *
 * Update role names to match exactly what is configured in Kaitet ERPNext
 * (Settings → Role List). Action strings must match the workflow transitions.
 */
export type ApprovalRoleConfig = {
  pendingState: WorkflowState;
  actions: { label: string; action: string; color: string }[];
  filterByHost?: boolean;
};

export const APPROVAL_ROLE_MAP: Record<string, ApprovalRoleConfig> = {
  Secretary: {
    pendingState: 'Pending Secretary Review',
    actions: [
      { label: 'Approve',    action: 'Approve by Secretary',        color: '#2E7D32' },
      { label: 'Reschedule', action: 'Reschedule by Secretary',     color: '#1565C0' },
      { label: 'Redirect',   action: 'Redirect to Another Host',    color: '#6A1B9A' },
      { label: 'Reject',     action: 'Reject by Secretary',         color: '#C62828' },
    ],
  },
  'Department Head': {
    pendingState: 'Pending Host Review',
    filterByHost: true,
    actions: [
      { label: 'Approve',    action: 'Approve by Host',   color: '#2E7D32' },
      { label: 'Reschedule', action: 'Reschedule by Host', color: '#1565C0' },
      { label: 'Reject',     action: 'Reject by Host',    color: '#C62828' },
    ],
  },
};
