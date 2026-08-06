import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import type { ScanAssetInput } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

export function useScanAsset() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: ScanAssetInput) => api.scanAsset(input),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['my-assets-at-farm'] });
      feedback.success(
        result.is_new
          ? `New asset ${result.asset_code} registered`
          : `${result.asset_code} confirmed present`,
      );
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not log scan'),
  });
}
