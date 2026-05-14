export function generatePatrolTag(guardCode: string): string {
  const safe = String(guardCode).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '-');
  const d = new Date();
  const pad = (v: number, n = 2) => String(v).padStart(n, '0');
  const ms = pad(d.getMilliseconds(), 3);
  return (
    `PAT-${safe}-` +
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-` +
    `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${ms}`
  );
}

export function sanitizeGuardCode(raw: string): string {
  return String(raw).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '-');
}
