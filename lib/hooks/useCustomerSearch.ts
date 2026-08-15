import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/services/api';

/**
 * Debounced type-ahead search against the Customer master — used by
 * CustomerBookingForm's customer picker. Mirrors useEmployeeSearch's
 * query-key + staleTime convention (the caller owns the debounce timer).
 */
export function useCustomerSearch(query: string) {
  return useQuery({
    queryKey: ['customer-search', query],
    queryFn: () => api.searchCustomers(query),
    enabled: query.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}
