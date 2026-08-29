import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/services/api';
import type { PendingApprovalRow } from '@/lib/services/api';
import { useFeedback } from './useFeedback';

export type CheckInInput = {
  name: string;
  custom_mode_of_transport?: string;
  custom_vehicles_number_plate?: string;
  custom_vehicles_colour?: string;
  entry_gate?: string;
};

export function useCheckIn() {
  const qc = useQueryClient();
  const feedback = useFeedback();
  return useMutation({
    mutationFn: (input: CheckInInput) =>
      api.checkInVisitor({
        name: input.name,
        transport: input.custom_mode_of_transport,
        plate: input.custom_vehicles_number_plate,
        colour: input.custom_vehicles_colour,
        entry_gate: input.entry_gate,
      }),
    onSuccess: (_, vars) => {
      qc.setQueryData<PendingApprovalRow[]>(['pending-approvals'], (old) =>
        old ? old.filter((row) => row.name !== vars.name) : old,
      );
      qc.invalidateQueries({ queryKey: ['appointment', vars.name] });
      qc.invalidateQueries({ queryKey: ['daily-summary'] });
      qc.invalidateQueries({ queryKey: ['pending-approvals'] });
      qc.invalidateQueries({ queryKey: ['approved-appointments'] });
      feedback.success('Checked in ✓');
    },
    onError: (err: Error) => feedback.error(err.message || 'Check-in failed'),
  });
}
