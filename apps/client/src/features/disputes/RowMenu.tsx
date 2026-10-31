import {type ReactNode} from 'react'
import {type StyleProp, type ViewStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type DisputeTarget, type HistoryEntry} from '@splito/sync'

import {RecordMenuItems} from '#/components/disputes/RecordMenuItems'
import * as Menu from '#/components/Menu'
import {RowMenu} from '#/components/RowMenu'

/**
 * A live history row's menu (F-1210): Dispute and Put on hold, in the one `RowMenu`. Phones keep the row exactly as it
 * was (no extra button; long-press opens it), wide screens add a "..." button beside the row (web adapts, mobile stays
 * the same).
 */
function RecordRowMenu({
  row,
  style,
  testID,
  entry,
  targetType,
  targetId,
}: {
  row: (onLongPress?: () => void) => ReactNode
  style?: StyleProp<ViewStyle>
  testID: string
  entry: HistoryEntry
  targetType: DisputeTarget
  targetId: string
}) {
  const {t: l} = useLingui()
  const name = entry.kind === 'expense' ? entry.entity.data.title : l`this record`
  return (
    <RowMenu testID={testID} name={name} row={row} style={style} isButtonOnWideOnly>
      <Menu.Group>
        <RecordMenuItems targetType={targetType} targetId={targetId} />
      </Menu.Group>
    </RowMenu>
  )
}

/**
 * The menu of a live history row, for `HistoryRow`'s `rowMenu` prop (a module-level function, so rows get the same
 * `rowMenu` every render and the compiler can keep them still); deleted rows have none (their Hide menu is `hide`).
 */
export function rowMenuWrap(entry: HistoryEntry, row: (onLongPress?: () => void) => ReactNode, style: StyleProp<ViewStyle>) {
  return <RecordRowMenu testID={`history-${entry.entity.id}-record-menu`} entry={entry} targetType={entry.kind} targetId={entry.entity.id} style={style} row={row} />
}
