/**
 * Check / selected glyph.
 *
 * Replaces the check dingbat used as a selection marker. Kept decorative: selection state
 * is announced through `aria-pressed` / `aria-current` on the control itself, not by the
 * mark.
 */
export function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="14" height="14">
      <path
        d="m5 12.5 4.5 4.5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
