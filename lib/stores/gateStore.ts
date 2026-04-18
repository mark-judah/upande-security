import { create } from 'zustand';
import { CheckInType } from '@/constants/checkInTypes';

type GateState = {
  selectedType: CheckInType;
  pendingScannedTicket: string | null;
  setSelectedType: (t: CheckInType) => void;
  setPendingScannedTicket: (v: string | null) => void;
};

export const useGateStore = create<GateState>((set) => ({
  selectedType: CheckInType.Visitor,
  pendingScannedTicket: null,
  setSelectedType: (t) => set({ selectedType: t }),
  setPendingScannedTicket: (v) => set({ pendingScannedTicket: v }),
}));
