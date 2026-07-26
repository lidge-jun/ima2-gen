/**
 * Pencil / edit glyph.
 *
 * Replaces the pencil dingbat that three surfaces were using as a rename affordance.
 * A text glyph renders at a different weight and baseline per font fallback, and a
 * screen reader announces it as "lower right pencil" instead of the action — the
 * button's own `aria-label` carries the meaning, so the mark stays decorative.
 */
export function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" width="14" height="14">
      <path
        d="M4 20h4l10-10a2.5 2.5 0 0 0-3.5-3.5L4.5 16.5 4 20Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}
