import AsyncStorage from '@react-native-async-storage/async-storage';

export const StorageKeys = {
  cookie: 'cookie',
  instanceUrl: 'instanceurl',
  instanceUrlBackup: 'instanceurl_backup',
  emailBackup: 'email_backup',
  fullName: 'fullname',
  userStation: 'userStation',
  versionLastReportedOn: 'versionLastReportedOn',
  userRoles: 'userRoles',
  biometricEnabled: 'biometric_enabled',
} as const;

export const storage = {
  get: (key: string): Promise<string | null> => AsyncStorage.getItem(key),
  set: (key: string, value: string): Promise<void> => AsyncStorage.setItem(key, value),
  remove: (key: string): Promise<void> => AsyncStorage.removeItem(key),
  async clearExcept(keep: string[]): Promise<void> {
    const allKeys = Object.values(StorageKeys);
    await Promise.all(
      allKeys
        .filter((k) => !keep.includes(k))
        .map((k) => AsyncStorage.removeItem(k)),
    );
  },
};
