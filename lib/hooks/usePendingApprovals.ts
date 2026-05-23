import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

export function usePendingApprovals() {
  return useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => api.pendingApprovals(),
  });
}
