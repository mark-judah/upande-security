import { create } from 'zustand';
import type { TractorDailyTask } from '@/lib/api/types';

type VehicleState = {
  ticketName: string | null;
  ticketData: TractorDailyTask | null;
  gateEntryTime: string | null;
  vehicleInside: boolean;
  setVehicleInside: (data: {
    ticketName: string;
    ticketData: TractorDailyTask;
    gateEntryTime: string;
  }) => void;
  clearVehicle: () => void;
};

export const useVehicleStore = create<VehicleState>((set) => ({
  ticketName: null,
  ticketData: null,
  gateEntryTime: null,
  vehicleInside: false,
  setVehicleInside: ({ ticketName, ticketData, gateEntryTime }) =>
    set({ ticketName, ticketData, gateEntryTime, vehicleInside: true }),
  clearVehicle: () =>
    set({ ticketName: null, ticketData: null, gateEntryTime: null, vehicleInside: false }),
}));
