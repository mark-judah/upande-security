import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/**
 * Guard types (or scans) a dispatch reference — read-only lookup against
 * whichever dispatch doctype is configured server-side. Safe to call
 * repeatedly as the guard edits the input.
 */
export function useDispatchSearch() {
  return useMutation({
    mutationFn: (reference: string) => api.searchDispatchForGate(reference),
  });
}
