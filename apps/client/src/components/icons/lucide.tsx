import {type LucideIcon} from 'lucide-react-native'

import {type Props, useCommonSVGProps} from '#/components/icons/common'

/**
 * Splito icons are Lucide (ISC). Bluesky's glyphs are licensed and must not be
 * copied; this keeps Bluesky's icon prop API (`size`, `fill`, `style`) so
 * adapted components work unchanged.
 *
 * Lucide only ships outline glyphs. For Bluesky's `_Filled_` variants,
 * `filled` paints the glyph's shapes in the icon colour; `strokeWidth` is for
 * glyphs where a fill would hide inner detail.
 */
export function createIcon(
  Icon: LucideIcon,
  {filled = false, strokeWidth = 2}: {filled?: boolean; strokeWidth?: number} = {},
) {
  function SplitoIcon(props: Props) {
    const {fill, size, style, gradient: _g, ...rest} = useCommonSVGProps(props)
    return (
      <Icon
        {...rest}
        color={fill}
        fill={filled ? fill : 'none'}
        size={size}
        style={style}
        strokeWidth={strokeWidth}
      />
    )
  }
  SplitoIcon.displayName = `Icon(${Icon.displayName ?? 'Lucide'})`
  return SplitoIcon
}
