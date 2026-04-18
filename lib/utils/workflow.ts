import { WORKFLOW_META, type WorkflowState } from '@/constants/workflowStates';

export function stateColor(state: string): string {
  return WORKFLOW_META[state as WorkflowState]?.color ?? '#26A69A';
}

export function stateIcon(state: string): string {
  return WORKFLOW_META[state as WorkflowState]?.icon ?? 'fiber-new';
}
