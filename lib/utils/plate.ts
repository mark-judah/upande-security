/**
 * Normalizes a Kenyan vehicle registration plate to NTSA's canonical
 * spacing — a letter prefix, a single space, then the digit + trailing-
 * letter suffix — so "kaa001a", "KAA-001A" and "KAA  001A" all become
 * "KAA 001A" instead of being recorded as whatever the guard happened to
 * type.
 *
 * Both common plate shapes fit the same pattern (letters, then digits,
 * then a trailing letter) and only differ in how many leading letters
 * there are, so one regex covers both without hardcoding either format
 * specifically:
 *   - Cars / trucks / buses (most gate traffic): "KAA 001A"
 *     K + 2 series letters, 3 digits, 1 trailing letter.
 *   - Motorcycles: "KMFA 001A"
 *     K + M (the motorcycle class letter) + 2 series letters, 3 digits,
 *     1 trailing letter — one extra leading letter than a car plate.
 *
 * Anything that doesn't fit this shape (GK/diplomatic/trailer plates, an
 * unusual format, or a plate that's still mid-typing) is returned just
 * uppercased and trimmed rather than force-split into the wrong groups.
 */
export function formatKenyanPlate(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (!cleaned) return '';
  const m = cleaned.match(/^([A-Z]{2,4})(\d{1,4})([A-Z]{0,2})$/);
  if (!m) return cleaned;
  const [, letters, digits, trailing] = m;
  return trailing ? letters + ' ' + digits + trailing : letters + ' ' + digits;
}
