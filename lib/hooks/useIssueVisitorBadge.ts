import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

export function useIssueVisitorBadge() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: ({ name, badgeNumber }: { name: string; badgeNumber: string }) =>
      api.issueVisitorBadge(name, badgeNumber),
    onSuccess: (result, vars) => {
      qc.invalidateQueries({ queryKey: ['appointment', vars.name] });
      qc.invalidateQueries({ queryKey: ['approved-appointments'] });
      feedback.success(`Badge #${result.badge_number} issued ✓`);
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not issue badge'),
  });
}
