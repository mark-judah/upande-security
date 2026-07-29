import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

export function useCheckOut() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (name: string) => api.checkOutVisitor(name),
    onSuccess: (_, name) => {
      qc.invalidateQueries({ queryKey: ['appointment', name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      qc.invalidateQueries({ queryKey: ['approved-appointments'] });
      feedback.success('Checked out ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Check-out failed'),
  });
}
