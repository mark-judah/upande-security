import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type UpdateSecurityOpsSettingsInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

const QUERY_KEY = ['command-center-security-ops-settings'];

export function useSecurityOpsSettings() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.getSecurityOpsSettings(),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Returns the mutation plus the last skipped_users list (emails that
 * weren't a real User and so weren't saved) — callers show that as a
 * warning, distinct from the success toast for the fields that did save.
 */
export function useUpdateSecurityOpsSettings() {
  const qc = useQueryClient();
  const feedback = useFeedback();

  return useMutation({
    mutationFn: (input: UpdateSecurityOpsSettingsInput) => api.updateSecurityOpsSettings(input),
    onSuccess: (result) => {
      qc.setQueryData(QUERY_KEY, result);
      if (result.skipped_users.length > 0) {
        feedback.warning('Not saved: ' + result.skipped_users.join(', ') + " — no matching user");
      } else {
        feedback.success('Settings saved ✓');
      }
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not save settings'),
  });
}
