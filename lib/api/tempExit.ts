// Thin shim over the server-script verb in lib/services/api.ts.
import { api } from '@/lib/services/api';
import type { TempExitDoctype, TempExitDirection, TempExitResult } from '@/lib/services/api';

export type { TempExitDoctype, TempExitDirection, TempExitResult };

/**
 * Step someone currently inside "out" temporarily, or mark them returned —
 * used by both the visitor/contractor Inside list and the staff gate panel.
 * Backed by the gate_temp_exit server script.
 */
export async function setTempExit(
  referenceDoctype: TempExitDoctype,
  referenceName: string,
  direction: TempExitDirection,
): Promise<TempExitResult> {
  return api.setTempExit(referenceDoctype, referenceName, direction);
}
