import { useQuery } from '@tanstack/react-query';
import { fetchTodayStaffAttendance } from '@/lib/api/attendance';

export function useStaffAttendanceSummary() {
  return useQuery({
    queryKey: ['staff-attendance-summary'],
    queryFn: fetchTodayStaffAttendance,
    staleTime: 5 * 60 * 1000,
  });
}
