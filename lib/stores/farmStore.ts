import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'manual_checking_farm';

/**
 * The farm a guard chose on the Gate tab because their login is linked to
 * no farm (no Employee.custom_farm, no Security Guard farm). Remembered on
 * the device until logout. The HTTP client sends it as `checking_farm` with
 * every request; the server only uses it when the login has no farm of its
 * own (upande_security.api.gate_movement.requested_farm).
 */
type FarmState = {
  farm: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setFarm: (farm: string | null) => Promise<void>;
};

export const useFarmStore = create<FarmState>((set) => ({
  farm: null,
  hydrated: false,
  hydrate: async () => {
    try {
      set({ farm: await AsyncStorage.getItem(KEY), hydrated: true });
    } catch {
      set({ hydrated: true });
    }
  },
  setFarm: async (farm) => {
    set({ farm });
    try {
      if (farm) await AsyncStorage.setItem(KEY, farm);
      else await AsyncStorage.removeItem(KEY);
    } catch {
      // Kept in memory for this session either way.
    }
  },
}));

// Load the saved choice as soon as the module is imported.
useFarmStore.getState().hydrate();
