import type { Ionicons } from '@expo/vector-icons';

export const TransportMode = {
  OnFoot: 'On Foot',
  Vehicle: 'Vehicle',
  Motorcycle: 'Motorcycle',
  Taxi: 'Taxi',
} as const;

export type TransportMode = (typeof TransportMode)[keyof typeof TransportMode];

export const TRANSPORT_MODES: TransportMode[] = ['On Foot', 'Vehicle', 'Motorcycle', 'Taxi'];

// Shared icon hints for the transport-mode vocabulary — single source of
// truth so VisitorForm, ContractorForm, and FormSelect's fallback all agree.
// Taxi intentionally uses a distinct glyph from Vehicle's `car-outline`
// (Ionicons has no literal taxi icon).
export const TRANSPORT_MODE_ICONS: Record<TransportMode, keyof typeof Ionicons.glyphMap> = {
  'On Foot': 'walk-outline',
  Vehicle: 'car-outline',
  Motorcycle: 'bicycle-outline',
  Taxi: 'car-sport-outline',
};
