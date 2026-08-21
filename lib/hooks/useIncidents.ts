import { useQuery } from '@tanstack/react-query';
import { api, type IncidentSummary } from '@/lib/services/api';

export type IncidentsFilter = {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
};

/**
 * Fetch ALL incidents (not just the current user's), optionally bounded by
 * an inclusive [from, to] date range on `incident_datetime`. The server-side
 * verb is `list_incidents`; ordering + limit are handled there.
 */
export function useIncidents(filter: IncidentsFilter = {}) {
  return useQuery<IncidentSummary[]>({
    queryKey: ['incidents', 'all', filter.from ?? '', filter.to ?? ''],
    queryFn: () =>
      api.listIncidents({
        from_date: filter.from || undefined,
        to_date: filter.to || undefined,
      }),
    staleTime: 30 * 1000,
  });
}
