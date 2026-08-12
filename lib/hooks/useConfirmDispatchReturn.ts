import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import { useDispatchStore } from '@/lib/stores/dispatchStore';
import { useFeedback } from './useFeedback';

/**
 * Optional, later action — stamps `gate_return_time` on a previously
 * verified Gate Dispatch Verification. `name` here is the verification
 * record's own name (returned by verify_dispatch_at_gate), not the
 * dispatch reference.
 */
export function useConfirmDispatchReturn() {
  const feedback = useFeedback();
  const removePending = useDispatchStore((s) => s.removePending);

  return useMutation({
    mutationFn: (name: string) => api.confirmDispatchReturn(name),
    onSuccess: (result) => {
      removePending(result.name);
      feedback.success('Return confirmed ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Could not confirm return'),
  });
}
