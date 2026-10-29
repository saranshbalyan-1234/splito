import {type ReactNode} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {type DisputeTarget, type HistoryEntry} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {atoms as a, useBreakpoints} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {RecordMenuItems} from '#/components/disputes/RecordMenuItems'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import * as Menu from '#/components/Menu'
import {IS_NATIVE, IS_WEB} from '#/env'

/**
 * A live history row's menu (F-1210): Dispute and Put on hold. Right-click (web) and long-press (native, via the
 * `onLongPress` the `row` render function hands to the row's Link) open it; on wide screens a "..." button beside the
 * row does too. Phones keep the row exactly as it was: no extra button (web adapts, mobile stays the same).
 */
function RowMenu({
  row,
  style,
  testID,
  name,
  targetType,
  targetId,
}: {
  row: (onLongPress?: () => void) => ReactNode
  style?: StyleProp<ViewStyle>
  testID: string
  name: string
  targetType: DisputeTarget
  targetId: string
}) {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const control = Menu.useMenuControl()
  const haptics = useHaptics()
  const open = () => {
    haptics.longPress()
    control.open()
  }
  return (
    <View
      style={[a.flex_row, a.align_center, style]}
      {...(IS_WEB
        ? {
            onContextMenu: (e: {preventDefault(): void}) => {
              e.preventDefault()
              open()
            },
          }
        : {})}>
      <View style={[a.flex_1]}>{row(IS_NATIVE ? open : undefined)}</View>
      <Menu.Root control={control}>
        <Menu.Trigger label={l`More options for ${name}`}>
          {({props}) =>
            gtMobile ? (
              <Button
                {...props}
                testID={testID}
                label={props.accessibilityLabel}
                size="small"
                color="secondary"
                variant="ghost"
                shape="round"
                style={{marginRight: 4}}>
                <ButtonIcon icon={DotsIcon} />
              </Button>
            ) : (
              /* Phones: no button; the trigger is only the anchor the long-press menu opens from. */
              <View {...(props as object)} style={{width: 0, height: 0}} accessible={false} importantForAccessibility="no-hide-descendants" />
            )
          }
        </Menu.Trigger>
        <Menu.Outer>
          <Menu.Group>
            <RecordMenuItems targetType={targetType} targetId={targetId} />
          </Menu.Group>
        </Menu.Outer>
      </Menu.Root>
    </View>
  )
}

/** The menu of a live history row, for `HistoryRow`'s `rowMenu` prop; deleted rows have none (their Hide menu is `hide`). */
export function historyRowMenu(entry: HistoryEntry, fallbackName: string) {
  if (entry.entity.deleted) return undefined
  const name = entry.kind === 'expense' ? entry.entity.data.title : fallbackName
  return {
    wrap: (row: (onLongPress?: () => void) => ReactNode, style: StyleProp<ViewStyle>) => (
      <RowMenu testID={`history-${entry.entity.id}-more`} name={name} targetType={entry.kind} targetId={entry.entity.id} style={style} row={row} />
    ),
  }
}
