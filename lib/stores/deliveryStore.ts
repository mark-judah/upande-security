import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Deliveries verified at the gate that haven't been confirmed departed yet.
 * Offloading takes time, so "Confirm Departure" is a separate, later
 * action from the arrival check — this list is what lets a guard find it
 * again in a different screen session (or after the app restarts) rather
 * than only right after verifying it. Mirrors the persisted `dispatchStore`
 * pattern.
 */
export type PendingDeliveryDeparture = {
  /** Gate Delivery Verification doc name — the arg confirm_delivery_departure expects. */
  name: string;
  purchase_order: string;
  supplier_name: string;
  vehicle_no: string;
  driver_name: string;
  verified_at: string; // ISO, client-side timestamp of the verify action
};

type DeliveryState = {
  pending: PendingDeliveryDeparture[];
  addPending: (entry: PendingDeliveryDeparture) => void;
  removePending: (name: string) => void;
  clearAll: () => void;
};

export const useDeliveryStore = create<DeliveryState>()(
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
      name: 'delivery-store',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
