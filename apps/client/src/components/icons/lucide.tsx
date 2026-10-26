import {type LucideIcon} from 'lucide-react-native'

import {type Props, useCommonSVGProps} from '#/components/icons/common'

/**
 * Splito icons are Lucide (ISC). Bluesky's glyphs are licensed and must not be
 * copied; this keeps Bluesky's icon prop API (`size`, `fill`, `style`) so
 * adapted components work unchanged.
 */
export function createIcon(Icon: LucideIcon) {
  function SplitoIcon(props: Props) {
    const {fill, size, style, gradient: _g, ...rest} = useCommonSVGProps(props)
    return <Icon {...rest} color={fill} size={size} style={style} strokeWidth={2} />
  }
  SplitoIcon.displayName = `Icon(${Icon.displayName ?? 'Lucide'})`
  return SplitoIcon
}
