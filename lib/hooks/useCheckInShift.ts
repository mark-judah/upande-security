import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

export function useCheckInShift() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: () => api.checkInShift(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-shift'] });
      feedback.success('Checked in to shift');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not check in'),
  });
}
