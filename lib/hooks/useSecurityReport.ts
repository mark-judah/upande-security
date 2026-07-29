import { useQuery } from '@tanstack/react-query';
import {
  api,
  type ReportTab,
  type SecurityReport,
  type SecurityReportFilters,
} from '@/lib/services/api';

/** Fetches the security-management report for one workflow tab over a date range. */
export function useSecurityReport(
  tab: ReportTab,
  fromDate: string,
  toDate: string,
  filters: SecurityReportFilters = {},
) {
  return useQuery<SecurityReport>({
    queryKey: ['security-report', tab, fromDate, toDate, filters.farm ?? '', filters.location ?? ''],
    queryFn: () => api.securityReport(tab, fromDate, toDate, filters),
    staleTime: 60 * 1000,
  });
}
