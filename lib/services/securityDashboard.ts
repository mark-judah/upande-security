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

// The server's own range names (security_dashboard._resolve_range). It
// used to be sent 'last_7_days' / 'last_30_days', which it does not know, so
// both quietly showed today.
export type ShiftPeriod = 'today' | '7d' | '30d' | 'custom';

export type ShiftGuardType = 'Internal Guard' | 'External Guard';
export type ShiftType = 'Day' | 'Night' | 'First' | 'Second' | 'Third';
export type ShiftStatus = 'Scheduled' | 'Active' | 'Ended' | 'Cancelled';

export type FarmColor = { bg: string; text: string };

/** Today's plan for one farm: one slot per shift type the farm runs (Day /
 *  Night, or First / Second / Third), with the guard on it or null. */
export type ShiftCoverageRow = {
  farm: string;
  shifts: { shift_type: ShiftType | string; guard_name: string | null }[];
};

/** Clock-in from the HR biometric devices, for guards who punch into one. */
export type ShiftBiometric = {
  clock_in: string | null;
  clock_out: string | null;
  result: 'Not started' | 'On time' | 'Late' | 'No clock-in' | 'Awaiting clock-in' | 'Absent' | string;
  late_min: number | null;
  departure: 'No clock-out' | 'Left early' | null;
  early_min: number | null;
};

/** A guard's day off in the period, and who covers it (null: nobody). */
export type ShiftOffDay = {
  guard: string;
  guard_name: string;
  farm: string | null;
  date: string;
  covered_by: string | null;
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
  biometric?: ShiftBiometric | null;
  /** Checked in for this shift in the app (check_in_shift). */
  checked_in?: 0 | 1;
  /** The guard whose day off this shift covers. */
  covering_for?: string | null;
  covering_for_name?: string | null;
};

export type ShiftDashboardSummary = {
  total_assignments: number;
  /** Per-shift-type counts, e.g. { Day: 64, First: 164, ... } - covers all
   * five ShiftType values, not just Day/Night. */
  shift_type_counts: Partial<Record<ShiftType, number>>;
  day_shift_count: number;
  night_shift_count: number;
  farms_covered: number;
  farms_total: number;
  unfilled_slots: number;
  guards_on_rotation: number;
  off_count?: number;
  off_uncovered?: number;
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
  off_days?: ShiftOffDay[];
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
