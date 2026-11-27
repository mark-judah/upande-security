import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import type { PipelineLine, ScanPipelineInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

/** Pipelines this guard traces, points in order, with today's progress. */
export function usePipelinePoints(enabled = true) {
  return useQuery({
    queryKey: ['pipeline-points'],
    queryFn: async () => (await api.pipelinePoints()).pipelines,
    enabled,
  });
}

/** A refused scan (too far, poor GPS...) is a normal answer with a message -
 * only a transport/server error goes to the error toast. */
export function useScanPipelinePoint() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: ScanPipelineInput) => api.scanPipelinePoint(input),
    onSuccess: (result) => {
      const line = result.pipeline;
      if (line) {
        qc.setQueryData<PipelineLine[]>(['pipeline-points'], (old) =>
          old ? old.map((l) => (l.pipeline === line.pipeline ? line : l)) : old,
        );
      }
      if (result.accepted) feedback.success(result.message);
      else feedback.error(result.message);
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not record the scan'),
  });
}
