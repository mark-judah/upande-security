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

export function useUpdateSecurityOpsSettings() {
  const qc = useQueryClient();
  const feedback = useFeedback();

  return useMutation({
    mutationFn: (input: UpdateSecurityOpsSettingsInput) => api.updateSecurityOpsSettings(input),
    onSuccess: (result) => {
      qc.setQueryData(QUERY_KEY, result);
      feedback.success('Settings saved ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not save settings'),
  });
}
