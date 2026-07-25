/**
 * The single source of truth for the favorite star artwork.
 *
 * Both the overlay button (FavoriteStarButton, absolutely positioned on tiles) and the
 * inline list/dialog toggles render this, so the star can never drift into two shapes.
 * Sizing and fill come from CSS on the parent, not from props.
 */
export function FavoriteStarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="m12 2.75 2.78 5.63 6.22.9-4.5 4.39 1.06 6.2L12 16.94 6.44 19.87l1.06-6.2L3 9.28l6.22-.9L12 2.75Z" />
    </svg>
  );
}
