import { create } from 'zustand';
import { CheckInType } from '@/constants/checkInTypes';
import type { ParsedIdCard } from '@/lib/utils/idCard';

type GateState = {
  selectedType: CheckInType;
  pendingScannedEmployee: string | null;
  pendingScannedIdCard: ParsedIdCard | null;
  // The same ID scanner (app/scan-id.tsx) is reachable from two different
  // places: the walk-in form (fills Name/ID fields directly - the existing
  // pendingScannedIdCard above) and, now, the search bar itself (scan an ID
  // as a shortcut for typing it in and searching). Both write their result
  // into a shared screen's single onMRZRead callback, so the screen needs
  // to know which one asked - set this right before navigating there.
  scanIdContext: 'walkin' | 'search';
  pendingScannedIdForSearch: ParsedIdCard | null;
  pendingScannedBadge: string | null;
  pendingScannedAsset: string | null;
  pendingScannedDispatch: string | null;
  pendingScannedReceiving: string | null;
  pendingScannedVehicle: string | null;
  pendingScannedStaffSticker: string | null;
  pendingScannedContractorBadge: string | null;
  // Checkpoint QR read on patrol, and the same QR read in Set position mode -
  // two fields so the two screens can never consume each other's scan.
  pendingScannedCheckpoint: string | null;
  pendingScannedCheckpointSetup: string | null;
  setSelectedType: (t: CheckInType) => void;
  setPendingScannedEmployee: (v: string | null) => void;
  setPendingScannedIdCard: (v: ParsedIdCard | null) => void;
  setScanIdContext: (v: 'walkin' | 'search') => void;
  setPendingScannedIdForSearch: (v: ParsedIdCard | null) => void;
  setPendingScannedBadge: (v: string | null) => void;
  setPendingScannedAsset: (v: string | null) => void;
  setPendingScannedDispatch: (v: string | null) => void;
  setPendingScannedReceiving: (v: string | null) => void;
  setPendingScannedVehicle: (v: string | null) => void;
  setPendingScannedStaffSticker: (v: string | null) => void;
  setPendingScannedContractorBadge: (v: string | null) => void;
  setPendingScannedCheckpoint: (v: string | null) => void;
  setPendingScannedCheckpointSetup: (v: string | null) => void;
};

export const useGateStore = create<GateState>((set) => ({
  selectedType: CheckInType.Visitor,
  pendingScannedEmployee: null,
  pendingScannedIdCard: null,
  scanIdContext: 'walkin',
  pendingScannedIdForSearch: null,
  pendingScannedBadge: null,
  pendingScannedAsset: null,
  pendingScannedDispatch: null,
  pendingScannedReceiving: null,
  pendingScannedVehicle: null,
  pendingScannedStaffSticker: null,
  pendingScannedContractorBadge: null,
  pendingScannedCheckpoint: null,
  pendingScannedCheckpointSetup: null,
  setSelectedType: (t) => set({ selectedType: t }),
  setPendingScannedEmployee: (v) => set({ pendingScannedEmployee: v }),
  setPendingScannedIdCard: (v) => set({ pendingScannedIdCard: v }),
  setScanIdContext: (v) => set({ scanIdContext: v }),
  setPendingScannedIdForSearch: (v) => set({ pendingScannedIdForSearch: v }),
  setPendingScannedBadge: (v) => set({ pendingScannedBadge: v }),
  setPendingScannedAsset: (v) => set({ pendingScannedAsset: v }),
  setPendingScannedDispatch: (v) => set({ pendingScannedDispatch: v }),
  setPendingScannedReceiving: (v) => set({ pendingScannedReceiving: v }),
  setPendingScannedVehicle: (v) => set({ pendingScannedVehicle: v }),
  setPendingScannedStaffSticker: (v) => set({ pendingScannedStaffSticker: v }),
  setPendingScannedContractorBadge: (v) => set({ pendingScannedContractorBadge: v }),
  setPendingScannedCheckpoint: (v) => set({ pendingScannedCheckpoint: v }),
  setPendingScannedCheckpointSetup: (v) => set({ pendingScannedCheckpointSetup: v }),
}));
