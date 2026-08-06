import { create } from 'zustand';
import { CheckInType } from '@/constants/checkInTypes';
import type { ParsedIdCard } from '@/lib/utils/idCard';

type GateState = {
  selectedType: CheckInType;
  pendingScannedTicket: string | null;
  pendingScannedEmployee: string | null;
  pendingScannedIdCard: ParsedIdCard | null;
  pendingScannedBadge: string | null;
  pendingScannedAsset: string | null;
  setSelectedType: (t: CheckInType) => void;
  setPendingScannedTicket: (v: string | null) => void;
  setPendingScannedEmployee: (v: string | null) => void;
  setPendingScannedIdCard: (v: ParsedIdCard | null) => void;
  setPendingScannedBadge: (v: string | null) => void;
  setPendingScannedAsset: (v: string | null) => void;
};

export const useGateStore = create<GateState>((set) => ({
  selectedType: CheckInType.Visitor,
  pendingScannedTicket: null,
  pendingScannedEmployee: null,
  pendingScannedIdCard: null,
  pendingScannedBadge: null,
  pendingScannedAsset: null,
  setSelectedType: (t) => set({ selectedType: t }),
  setPendingScannedTicket: (v) => set({ pendingScannedTicket: v }),
  setPendingScannedEmployee: (v) => set({ pendingScannedEmployee: v }),
  setPendingScannedIdCard: (v) => set({ pendingScannedIdCard: v }),
  setPendingScannedBadge: (v) => set({ pendingScannedBadge: v }),
  setPendingScannedAsset: (v) => set({ pendingScannedAsset: v }),
}));
