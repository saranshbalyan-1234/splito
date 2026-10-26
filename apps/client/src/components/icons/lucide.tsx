import {useId} from 'react'
import {type LucideIcon} from 'lucide-react-native'
import Svg, {Defs, G, Mask, Rect} from 'react-native-svg'

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

/**
 * A filled glyph whose inner detail is cut out, like Bluesky's `_Filled_`
 * icons (a solid house with its door open, a solid gear with its hub). The
 * cut-outs are a mask, so they show whatever is behind the icon - a hover
 * background included. Shapes use Lucide's 24x24 grid and path data.
 */
export function createFilledIcon(
  name: string,
  draw: (color: string) => {
    /** Painted in the icon colour, then masked by `holes`. */
    body: React.ReactNode
    /** Painted black inside the mask: these areas become transparent. */
    holes: React.ReactNode
    /** Painted on top, unmasked. */
    over?: React.ReactNode
  },
) {
  function SplitoFilledIcon(props: Props) {
    const {fill, size, style, gradient: _g, ...rest} = useCommonSVGProps(props)
    const maskId = 'k' + useId().replace(/[^a-zA-Z0-9_-]/g, '')
    const color = String(fill)
    const {body, holes, over} = draw(color)
    return (
      <Svg
        fill="none"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        style={style}
        {...rest}>
        <Defs>
          <Mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
            <Rect x="0" y="0" width="24" height="24" fill="#fff" />
            {holes}
          </Mask>
        </Defs>
        <G mask={`url(#${maskId})`}>{body}</G>
        {over}
      </Svg>
    )
  }
  SplitoFilledIcon.displayName = `Icon(${name}Filled)`
  return SplitoFilledIcon
}
