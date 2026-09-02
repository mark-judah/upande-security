// ─────────────────────────────────────────────────────────────────────────
// ONE-OFF EXCEPTION to this app's "Server Scripts only" house rule (see the
// header comment in lib/services/api.ts and CLAUDE.md §4 "Endpoint
// inventory"). This file exists ONLY to call the whitelisted Python
// function `upande_security.api.security_dashboard.fetchSecurityDasboardData`
// directly, for the Command Center's Shift Planning screen — agreed
// one-time with the project owner so mobile can reuse the same aggregation
// endpoint the web security dashboard already uses, instead of duplicating
// its shift-coverage SQL in a brand new Server Script verb.
//
// DO NOT treat this as precedent. Every other backend call in this app
// MUST go through `lib/services/api.ts`'s `api` object (one Server Script
// verb per method, see that file). If another screen seems to need a
// whitelisted Python method called directly "since there's already one
// example", stop — get a proper Server Script verb written instead
// (security-backend's job) and add it to lib/services/api.ts like
// everything else. This file is intentionally NOT part of the `api`
// object so it can't be mistaken for a general-purpose "call any
// whitelisted method" utility.
//
// Same soft-fail envelope as every other verb in this app
// (`frappe.response["message"]`, `{error: "..."}` on failure) —
// reimplemented locally below rather than importing api.ts's `call<T>`
// helper, so this stays a single, trivially-greppable/removable exception.
// ─────────────────────────────────────────────────────────────────────────

import client from '@/lib/api/client';

const WHITELISTED_METHOD_PATH =
  '/api/method/upande_security.api.security_dashboard.fetchSecurityDasboardData';

export type ShiftPeriod = 'today' | 'last_7_days' | 'last_30_days' | 'custom';

export type ShiftGuardType = 'Internal Guard' | 'External Guard';
export type ShiftType = 'Day' | 'Night';
export type ShiftStatus = 'Scheduled' | 'Active' | 'Ended' | 'Cancelled';

export type FarmColor = { bg: string; text: string };

export type ShiftCoverageRow = {
  farm: string;
  day_guard: string | null;
  night_guard: string | null;
};

export type ShiftRow = {
  name: string;
  guard_key: string;
  guard_name: string;
  guard_type: ShiftGuardType;
  farm: string;
  farm_color: FarmColor;
  block: string;
  shift_type: ShiftType;
  /** "YYYY-MM-DD HH:MM:SS" or null — a real timestamp now, not date-only. */
  start_date: string | null;
  end_date: string | null;
  status: ShiftStatus;
  remarks: string;
};

export type ShiftDashboardSummary = {
  total_assignments: number;
  day_shift_count: number;
  night_shift_count: number;
  farms_covered: number;
  farms_total: number;
  unfilled_slots: number;
  guards_on_rotation: number;
};

export type ShiftDashboardFilterOptions = {
  farms: string[];
  shift_types: ShiftType[];
  statuses: string[];
  companies: string[];
};

export type ShiftDashboardResult = {
  success: true;
  range_from: string;
  range_to: string;
  summary: ShiftDashboardSummary;
  coverage_board: ShiftCoverageRow[];
  rows: ShiftRow[];
  farm_colors: Record<string, FarmColor>;
  filter_options: ShiftDashboardFilterOptions;
};

export type ShiftDashboardInput = {
  period: ShiftPeriod;
  /** Required when period === 'custom'. "YYYY-MM-DD". */
  from_date?: string;
  to_date?: string;
  farm?: string;
  shift_type?: ShiftType;
  status?: string;
  company?: string;
};

type ShiftDashboardErrorShape = { error: string; success?: false };

export async function fetchShiftDashboard(
  input: ShiftDashboardInput,
): Promise<ShiftDashboardResult> {
  const res = await client.post<{ message: ShiftDashboardResult | ShiftDashboardErrorShape }>(
    WHITELISTED_METHOD_PATH,
    { tab: 'shifts', ...input },
  );
  const msg = res.data.message as unknown as ShiftDashboardErrorShape | ShiftDashboardResult;
  if (msg && typeof msg === 'object' && 'error' in msg && (msg as ShiftDashboardErrorShape).error) {
    throw new Error((msg as ShiftDashboardErrorShape).error);
  }
  if (msg === undefined || msg === null) {
    throw new Error('Server returned an unexpected empty response for fetchSecurityDasboardData');
  }
  return msg as ShiftDashboardResult;
}
