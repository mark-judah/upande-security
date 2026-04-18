import { useMutation } from '@tanstack/react-query';
import { fetchVisitorAppointment } from '@/lib/api/visitors';

export function useVisitorSearch() {
  return useMutation({
    mutationFn: (query: string) => fetchVisitorAppointment(query),
  });
}
