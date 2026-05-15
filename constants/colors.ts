// Blueprint §16.9 — monochrome palette shared across every org mobile app.
// Resist per-feature accents. Distinguish sections by icons/layout, not colour.
// The only colour with real meaning is `danger` — reserve it for actual errors.
export const COLORS = {
  primary: '#000000',
  success: '#000000',
  danger: '#A32D2D',
  warn: '#4B5563',
  info: '#000000',
  text: '#000000',
  textMuted: '#6B6B6B',
  border: '#D0D0D0',
  bg: '#FFFFFF',
  bgMuted: '#F5F5F5',
} as const;
