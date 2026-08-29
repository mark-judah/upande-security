import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/** Current user, roles, and linked Employee/Security Guard record — mainly
 * used here for the logged-in guard's own farm (employee.custom_farm), the
 * relevant farm for an entry-gate picker at check-in. */
export function useSessionInfo() {
  return useQuery({
    queryKey: ['session-info'],
    queryFn: () => api.getSessionInfo(),
    staleTime: 10 * 60 * 1000,
  });
}
