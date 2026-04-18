export type WorkflowState =
  | 'Open'
  | 'Pending Secretary Review'
  | 'Approved by Secretary'
  | 'Rescheduled by Secretary'
  | 'Redirected to Another Host'
  | 'Rejected by Secretary'
  | 'Visitor Checked In'
  | 'Visitor Checked Out';

export const WORKFLOW_META: Record<WorkflowState, { color: string; icon: string }> = {
  Open: { color: '#000000', icon: 'fiber-new' },
  'Pending Secretary Review': { color: '#666666', icon: 'hourglass-top' },
  'Approved by Secretary': { color: '#000000', icon: 'check-circle' },
  'Rescheduled by Secretary': { color: '#555555', icon: 'schedule' },
  'Redirected to Another Host': { color: '#555555', icon: 'alt-route' },
  'Rejected by Secretary': { color: '#333333', icon: 'cancel' },
  'Visitor Checked In': { color: '#000000', icon: 'login' },
  'Visitor Checked Out': { color: '#999999', icon: 'logout' },
};
