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
