import { useQuery } from '@tanstack/react-query';
import { fetchTodayStaffAttendance } from '@/lib/api/attendance';

// enabled=false (Staff Gate Attendance switched off) skips the request
// entirely - the server would only refuse it.
export function useStaffAttendanceSummary(enabled = true) {
  return useQuery({
    enabled,
    queryKey: ['staff-attendance-summary'],
    queryFn: fetchTodayStaffAttendance,
    staleTime: 5 * 60 * 1000,
  });
}
