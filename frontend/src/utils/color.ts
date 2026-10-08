/**
 * VICTOR — colour helpers.
 *
 * The design system keeps every colour in a CSS custom property so both themes
 * stay correct. That makes naive alpha string concatenation unusable: appending
 * a hex alpha pair to a token (`var(--accent)` + `18`) produces an invalid CSS
 * value that the browser silently drops. `withAlpha` works for BOTH a raw hex
 * colour and a `var(--token)` reference, so tints can be derived from tokens.
 */

/**
 * Return `color` at `pct` percent opacity over a transparent backdrop.
 *
 * Accepts any valid CSS colour, including `var(--token)` references.
 */
export function withAlpha(color: string, pct: number): string {
  const clamped = Math.max(0, Math.min(100, pct));
  return `color-mix(in srgb, ${color} ${clamped}%, transparent)`;
}

/**
 * Read a resolved CSS custom property value off the document root.
 *
 * Needed where a colour must be handed to a canvas/SVG API that cannot resolve
 * `var()` itself (Leaflet vector styles, for instance). Returns `fallback`
 * during SSR or when the property is not set.
 */
export function readToken(name: string, fallback: string): string {
  if (typeof window === 'undefined' || typeof document === 'undefined') return fallback;
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}
