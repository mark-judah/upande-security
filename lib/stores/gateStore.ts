import { create } from 'zustand';
import { CheckInType } from '@/constants/checkInTypes';

type GateState = {
  selectedType: CheckInType;
  pendingScannedTicket: string | null;
  pendingScannedEmployee: string | null;
  setSelectedType: (t: CheckInType) => void;
  setPendingScannedTicket: (v: string | null) => void;
  setPendingScannedEmployee: (v: string | null) => void;
};

export const useGateStore = create<GateState>((set) => ({
  selectedType: CheckInType.Visitor,
  pendingScannedTicket: null,
  pendingScannedEmployee: null,
  setSelectedType: (t) => set({ selectedType: t }),
  setPendingScannedTicket: (v) => set({ pendingScannedTicket: v }),
  setPendingScannedEmployee: (v) => set({ pendingScannedEmployee: v }),
}));
