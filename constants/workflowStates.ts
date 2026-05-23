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

export const WORKFLOW_META: Record<WorkflowState, { color: string; icon: string }> = {
  Open:                          { color: '#000000', icon: 'fiber-new' },
  'Pending Host Review':         { color: '#666666', icon: 'hourglass-bottom' },
  'Approved by Host':            { color: '#000000', icon: 'verified' },
  'Rescheduled by Host':         { color: '#555555', icon: 'update' },
  'Rejected by Host':            { color: '#333333', icon: 'block' },
  'Pending Secretary Review':    { color: '#666666', icon: 'hourglass-top' },
  'Approved by Secretary':       { color: '#000000', icon: 'check-circle' },
  'Rescheduled by Secretary':    { color: '#555555', icon: 'schedule' },
  'Redirected to Another Host':  { color: '#555555', icon: 'alt-route' },
  'Rejected by Secretary':       { color: '#333333', icon: 'cancel' },
  'Visitor Checked In':          { color: '#000000', icon: 'login' },
  'Visitor Checked Out':         { color: '#999999', icon: 'logout' },
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
