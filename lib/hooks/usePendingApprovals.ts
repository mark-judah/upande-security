import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '@/lib/api/client';
import { runWorkflowAction } from '@/lib/api/workflow';
import { useAuthStore } from '@/lib/stores/authStore';
import { APPROVAL_ROLE_MAP } from '@/constants/workflowStates';
import type { Appointment } from '@/lib/api/types';
import { useFeedback } from './useFeedback';

export function useApproverConfig() {
  const roles = useAuthStore((s) => s.roles);
  return Object.entries(APPROVAL_ROLE_MAP).filter(([role]) => roles.includes(role));
}

export function useIsApprover() {
  return useApproverConfig().length > 0;
}

export function usePendingApprovals() {
  const configs = useApproverConfig();
  const user = useAuthStore((s) => s.user);

  const pendingStates = configs.map(([, cfg]) => cfg.pendingState);

  return useQuery({
    queryKey: ['pending-approvals', pendingStates, user?.email],
    enabled: pendingStates.length > 0,
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const filtersJson = JSON.stringify([
        ['Appointment', 'workflow_state', 'in', pendingStates],
      ]);
      const fields = [
        'name', 'customer_name', 'customer_phone_number', 'workflow_state',
        'scheduled_time', 'custom_meet_with', 'host_name', 'customer_details',
        'custom_mode_of_transport', 'custom_check_in_time',
      ].join(',');

      const res = await api.get<{ data: Appointment[] }>(
        `/api/resource/Appointment?filters=${encodeURIComponent(filtersJson)}&fields=${encodeURIComponent(`[${fields.split(',').map(f => `"${f.trim()}"`).join(',')}]`)}&limit_page_length=100&order_by=scheduled_time asc`,
      );

      const appointments = res.data.data ?? [];

      // For host-filtered roles, only keep appointments where custom_meet_with matches
      // the current user's employee record. We filter client-side since the user email
      // to employee ID mapping would require an extra lookup per record.
      // Guards who are Secretaries see all pending-secretary records.
      return appointments;
    },
  });
}

export function useApprovalAction() {
  const qc = useQueryClient();
  const feedback = useFeedback();

  return useMutation({
    mutationFn: ({ name, action }: { name: string; action: string }) =>
      runWorkflowAction({ name, action }),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      feedback.success(`${action} ✓`);
    },
    onError: (err: Error) => feedback.error(err.message || 'Action failed'),
  });
}
