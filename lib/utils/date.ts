import { format, parseISO } from 'date-fns';

export function getDuration(iso?: string): string {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff / 60_000) % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  } catch {
    return '';
  }
}

export function fmtTime(iso?: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'HH:mm');
  } catch {
    return '';
  }
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '';
  try {
    return format(parseISO(iso), 'HH:mm, dd MMM');
  } catch {
    return '';
  }
}

export function fmtLongDate(d: Date): string {
  return format(d, 'EEEE, d MMMM yyyy');
}

// The business runs on a single fixed timezone (Africa/Nairobi, UTC+3,
// no DST) — guards' phones do not. Using the device's own local getters
// here (getHours(), etc.) would silently shift every timestamp sent to
// the server by however many hours the phone's timezone happens to be
// off from Nairobi, since the server treats any naive "YYYY-MM-DD
// HH:MM:SS" string it receives as already being in its own configured
// timezone. `d.getTime()` is always the true UTC instant regardless of
// device timezone, so offsetting that by Nairobi's fixed +3h and reading
// it back with the UTC getters yields the correct Nairobi wall-clock
// value no matter how the device itself is configured.
const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;

export function toFrappeDateTime(d: Date = new Date()): string {
  const nairobi = new Date(d.getTime() + NAIROBI_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${nairobi.getUTCFullYear()}-${pad(nairobi.getUTCMonth() + 1)}-${pad(nairobi.getUTCDate())}` +
    ` ${pad(nairobi.getUTCHours())}:${pad(nairobi.getUTCMinutes())}:${pad(nairobi.getUTCSeconds())}`
  );
}
