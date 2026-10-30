import {type StyleProp, type ViewStyle} from 'react-native'

import {Link} from '#/view/com/util/Link'
import {atoms as a} from '#/alf'

/**
 * A count or amount that opens Activity (owners 192-195): the shared Link, pushed with Back, a 44 px target, a label
 * and a testID. Build `href` with `activityPath`, `seeAllTransactionsPath`, `seeDisputedPath` or `seeRequestsPath`.
 */
export function ActivityLink({testID, href, label, children, style}: {testID: string; href: string; /** What a screen reader says ("See disputed transactions"). */ label: string; children: React.ReactNode; style?: StyleProp<ViewStyle>}) {
  return (
    <Link testID={testID} href={href} title={label} accessibilityLabel={label} accessibilityHint="" asAnchor anchorNoUnderline style={[a.flex_row, a.align_center, {minHeight: 44}, style]}>
      {children}
    </Link>
  )
}
