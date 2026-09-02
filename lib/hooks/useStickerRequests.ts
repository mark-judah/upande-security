import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type ListStickerRequestsInput, type StickerRequestStatus } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

const QUERY_KEY = 'command-center-sticker-requests';

/**
 * Command Center — Vehicle Sticker request queue. `status` defaults to
 * "Pending" server-side when omitted — pass "" explicitly for full history.
 */
export function useStickerRequests(input: ListStickerRequestsInput = {}) {
  return useQuery({
    queryKey: [QUERY_KEY, input.status ?? 'Pending', input.limit ?? null],
    queryFn: () => api.listStickerRequests(input),
    staleTime: 2 * 60 * 1000,
  });
}

/**
 * Approve/reject are role-gated server-side to System Manager/Security Head
 * only — narrower than the general Command Center allowlist — so an
 * allow-listed-but-not-those-roles user can legitimately get a permission
 * error back here. Surfaced via the standard toast, not a crash.
 */
export function useStickerRequestAction() {
  const qc = useQueryClient();
  const feedback = useFeedback();

  const approve = useMutation({
    mutationFn: (request_name: string) => api.approveStickerRequest(request_name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      feedback.success('Sticker request approved ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not approve request'),
  });

  const reject = useMutation({
    mutationFn: ({ request_name, review_notes }: { request_name: string; review_notes?: string }) =>
      api.rejectStickerRequest(request_name, review_notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
      feedback.success('Sticker request rejected');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not reject request'),
  });

  return { approve, reject };
}

export type { StickerRequestStatus };
