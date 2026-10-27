/** Keeps the keyboard's current result on screen as the arrows move it. */
export function scrollRowIntoView(nav: number) {
  document
    .querySelector(`[data-testid="search-row-${nav}"]`)
    ?.scrollIntoView({block: 'nearest'})
}
