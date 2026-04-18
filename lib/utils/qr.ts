export function extractTicketName(raw: string): string {
  const v = raw.trim();
  if (!v) return '';
  if (v.includes('/app/tractor-daily-task/')) {
    return decodeURIComponent(v.split('/app/tractor-daily-task/').pop()!);
  }
  if (v.includes('/')) {
    return decodeURIComponent(v.split('/').pop()!);
  }
  return v;
}
