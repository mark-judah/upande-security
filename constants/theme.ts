export const theme = {
  primaryColor: '#000000',
  secondaryAccent: '#000000',
  success: '#000000',
  error: '#000000',
  warning: '#555555',
  info: '#000000',
  textPrimary: '#111111',
  textSecondary: '#666666',
  border: '#D0D0D0',
  borderLight: '#E8E8E8',
  background: '#FFFFFF',
  surface: '#F5F5F5',
  surfaceAlt: '#FAFAFA',
} as const;

export type Theme = typeof theme;
