import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { TractorDailyTask } from '@/lib/api/types';

export type ActiveVehicleEntry = {
  ticketName: string;
  ticketData: TractorDailyTask;
  timesheetName: string;
  entryTime: string;
  taskRowName?: string;
  description?: string;
};

type VehicleState = {
  entries: ActiveVehicleEntry[];
  addEntry: (entry: ActiveVehicleEntry) => void;
  removeEntry: (ticketName: string) => void;
  clearAll: () => void;
};

export const useVehicleStore = create<VehicleState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (entry) =>
        set((s) => ({
          entries: [...s.entries.filter((e) => e.ticketName !== entry.ticketName), entry],
        })),
      removeEntry: (ticketName) =>
        set((s) => ({ entries: s.entries.filter((e) => e.ticketName !== ticketName) })),
      clearAll: () => set({ entries: [] }),
    }),
    {
      name: 'vehicle-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
