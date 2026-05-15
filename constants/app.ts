import Constants from 'expo-constants';

export const APP_VERSION: string =
  (Constants.expoConfig?.version as string | undefined) ?? '0.0.0';
