import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Dispatches verified at the gate that haven't been marked returned yet.
 * Not every dispatch comes back to the farm (e.g. an export truck headed
 * straight to port), so "Confirm Return" is an optional, later action —
 * this list is what lets a guard find it again in a different screen
 * session (or after the app restarts) rather than only right after
 * verifying it. Mirrors the persisted `vehicleStore` pattern.
 */
export type PendingDispatchReturn = {
  /** Gate Dispatch Verification doc name — the arg confirm_dispatch_return expects. */
  name: string;
  reference_doctype: string;
  reference_name: string;
  vehicle_no: string;
  driver_name: string;
  farm: string;
  verified_at: string; // ISO, client-side timestamp of the verify action
};

type DispatchState = {
  pending: PendingDispatchReturn[];
  addPending: (entry: PendingDispatchReturn) => void;
  removePending: (name: string) => void;
  clearAll: () => void;
};

export const useDispatchStore = create<DispatchState>()(
  persist(
    (set) => ({
      pending: [],
      addPending: (entry) =>
        set((s) => ({
          pending: [...s.pending.filter((e) => e.name !== entry.name), entry],
        })),
      removePending: (name) =>
        set((s) => ({ pending: s.pending.filter((e) => e.name !== name) })),
      clearAll: () => set({ pending: [] }),
    }),
    {
      name: 'dispatch-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
