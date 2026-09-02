import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, type UpdateIncidentInput } from '@/lib/services/api';

/**
 * Command Center — Incident review (status transition + resolution /
 * corrective-actions notes). Invalidates the `['incidents', ...]` key
 * prefix so both useIncidents' Command Center list (`['incidents', 'all',
 * from, to]`) and useMyIncidents' guard-facing list (`['incidents', 'mine',
 * email]`) pick up the change — a reviewed incident should disappear from
 * "Open" filters and update its status wherever it's shown, including for
 * the guard who originally filed it.
 */
export function useUpdateIncident() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateIncidentInput) => api.updateIncident(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}
