import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import type { GpsReading, ScanCheckpointInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

/** This patrol's checkpoints in its own (shuffled) order, with progress. */
export function usePatrolCheckpoints(patrol: string | null) {
  return useQuery({
    queryKey: ['patrol-checkpoints', patrol],
    queryFn: () => api.patrolCheckpoints(patrol as string),
    enabled: Boolean(patrol),
  });
}

/** A refused scan is a normal answer (accepted=false + message), so only a
 * transport/server error goes to the error toast here - the screen shows
 * the refusal itself. */
export function useScanCheckpoint() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: ScanCheckpointInput) => api.scanCheckpoint(input),
    onSuccess: (result, input) => {
      if (result.plan) qc.setQueryData(['patrol-checkpoints', input.patrol], result.plan);
      if (result.accepted) feedback.success(result.message);
      else feedback.error(result.message);
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record the scan'),
  });
}

export function useCheckpointsForSetup() {
  return useQuery({
    queryKey: ['checkpoints-for-setup'],
    queryFn: async () => (await api.checkpointsForSetup()).checkpoints,
  });
}

export function useSetCheckpointPosition() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: { code: string; readings: GpsReading[]; mocked: 0 | 1 }) =>
      api.setCheckpointPosition(input.code, input.readings, input.mocked),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['checkpoints-for-setup'] });
      feedback.success(`${result.checkpoint_name} position saved (±${result.accuracy_m} m)`);
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not save the position'),
  });
}
