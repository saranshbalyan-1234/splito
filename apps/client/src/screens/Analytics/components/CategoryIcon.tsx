import {CategoryTile} from '#/components/split/shared'

/**
 * A category's glyph in its own colour on a soft tint of it, the size of Bluesky's row avatars: the app's one
 * category tile, so Analytics draws it like every other list.
 */
export function CategoryIcon({
  icon,
  color,
  size = 40,
}: {
  icon: string
  color: string
  size?: number
}) {
  return <CategoryTile category={{icon, color}} size={size} />
}
