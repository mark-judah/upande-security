import Constants from 'expo-constants';

/** App version from app.json — surfaced in Settings and the login footer. */
export const APP_VERSION: string = Constants.expoConfig?.version ?? '1.0.0';
