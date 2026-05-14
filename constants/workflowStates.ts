export type WorkflowState =
  | 'Open'
  | 'Pending Secretary Review'
  | 'Pending Host Review'
  | 'Approved by Secretary'
  | 'Rescheduled by Secretary'
  | 'Redirected to Another Host'
  | 'Rejected by Secretary'
  | 'Approved by Host'
  | 'Rescheduled by Host'
  | 'Rejected by Host'
  | 'Visitor Checked Out';

export const WORKFLOW_META: Record<WorkflowState, { color: string; icon: string }> = {
  Open: { color: '#000000', icon: 'fiber-new' },
  'Pending Secretary Review': { color: '#666666', icon: 'hourglass-top' },
  'Pending Host Review': { color: '#666666', icon: 'hourglass-bottom' },
  'Approved by Secretary': { color: '#000000', icon: 'check-circle' },
  'Rescheduled by Secretary': { color: '#555555', icon: 'schedule' },
  'Redirected to Another Host': { color: '#555555', icon: 'alt-route' },
  'Rejected by Secretary': { color: '#333333', icon: 'cancel' },
  'Approved by Host': { color: '#000000', icon: 'verified' },
  'Rescheduled by Host': { color: '#555555', icon: 'update' },
  'Rejected by Host': { color: '#333333', icon: 'block' },
  'Visitor Checked Out': { color: '#999999', icon: 'logout' },
};

/**
 * Transitions the Gate Guard (this app) is allowed to perform.
 * All other transitions happen on the ERP side by Secretary or Host.
 */
export const GUARD_ACTIONS = {
  CONFIRM_CHECK_IN: 'Confirm Check In',
  CONFIRM_CHECK_OUT: 'Confirm Check Out',
} as const;

/**
 * States from which the guard can check the visitor out.
 * Mirrors every "Confirm Check Out" transition allowed to Gate Guard in the workflow.
 * CHECK OUT is not allowed from Pending Secretary/Host Review — those are waiting states.
 */
export const CHECK_OUT_ALLOWED_FROM: WorkflowState[] = [
  'Approved by Secretary',
  'Rescheduled by Secretary',
  'Redirected to Another Host',
  'Rejected by Secretary',
  'Approved by Host',
  'Rescheduled by Host',
  'Rejected by Host',
];

/**
 * States where the visitor is checked in but awaiting approval — the guard
 * cannot yet check them out and must wait for Secretary/Host action on ERP.
 */
export const AWAITING_REVIEW_STATES: WorkflowState[] = [
  'Pending Secretary Review',
  'Pending Host Review',
];
