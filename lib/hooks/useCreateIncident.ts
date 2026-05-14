import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createIncidentReport } from '@/lib/api/incidents';
import type { CreateIncidentInput } from '@/lib/api/types';
import { useFeedback } from './useFeedback';

export function useCreateIncident() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: CreateIncidentInput) => createIncidentReport(input),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      feedback.success(`Incident ${created.name} filed`);
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not file incident'),
  });
}
