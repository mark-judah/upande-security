import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import type { ReportAssetMissingInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

export function useReportAssetMissing() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: ReportAssetMissingInput) => api.reportAssetMissing(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['my-assets-at-farm'] });
      feedback.success(`${result.asset_code} reported missing`);
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not report asset missing'),
  });
}
