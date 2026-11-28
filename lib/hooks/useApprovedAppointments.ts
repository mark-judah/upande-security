import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from '@react-navigation/native';
import { api } from '@/lib/services/api';

/** The gate's Approved list: today's visits and everyone inside, or - with
 *  `search` - matching approvals from any day. Refreshes every 30 s only
 *  while the screen is open and not searching: a hidden tab polling the
 *  list kept low-end phones busy for nothing. */
export function useApprovedAppointments(search = '') {
  const focused = useIsFocused();
  const q = search.trim();
  return useQuery({
    queryKey: ['approved-appointments', q],
    queryFn: () => api.approvedAppointments(q || undefined),
    enabled: q.length === 0 || q.length >= 2,
    refetchInterval: focused && !q ? 30_000 : false,
  });
}
