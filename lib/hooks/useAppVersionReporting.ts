import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/authStore';
import { startAppVersionReporting } from '@/lib/services/appVersion';

/** Reports this app's version to the server while logged in (see
 *  lib/services/appVersion.ts). Mount once in the root layout. */
export function useAppVersionReporting(): void {
  const hasSession = useAuthStore((s) => s.hasSession);
  useEffect(() => {
    if (!hasSession) return;
    return startAppVersionReporting();
  }, [hasSession]);
}
