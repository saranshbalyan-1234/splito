import {type ReactNode} from 'react'
import {type StyleProp, type ViewStyle} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type MoneyType} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {useSetHidden} from '#/data/hiddenItems'
import * as Menu from '#/components/Menu'
import {RowMenu} from '#/components/RowMenu'
import * as Toast from '#/components/Toast'
import {EyeIcon, EyeOffIcon} from '#/components/settings/icons'

/** What can be hidden: a deleted expense, payment, write-off or friend (by item), or a group (any time). */
export type HideTarget = {type: MoneyType | 'person'; id: string} | {type: 'group'; id: string}

/**
 * Hide / Unhide one thing for me only (decisions 104 to 106), with an Undo toast; the result of `toggle` is true when
 * the change was saved. It holds no preference subscription (a row's menu must not cost one per row): the screen reads
 * `useHiddenItems()` once and passes each item's state down.
 */
export function useHideItem(target: HideTarget) {
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const set = useSetHidden()
  const run = (hide: boolean) => (target.type === 'group' ? set.group(target.id, hide) : set.item(target.type, target.id, hide))
  const toggle = async (hide: boolean) => {
    if (!(await run(hide))) {
      Toast.show(l`Couldn’t update your lists. Please try again.`, {type: 'error'})
      return false
    }
    haptics.confirm()
    Toast.show(
      <Toast.Outer>
        <Toast.Icon />
        <Toast.Text>{hide ? l`Hidden from your lists` : l`Back in your lists`}</Toast.Text>
        <Toast.Action label={l`Undo`} onPress={() => void run(!hide)}>
          <Trans context="action">Undo</Trans>
        </Toast.Action>
      </Toast.Outer>,
      {type: 'success'},
    )
    return true
  }
  return {toggle}
}

type HideProps = {
  testID: string
  target: HideTarget
  isHidden: boolean
  /** The row's title, for the screen reader. */
  name: string
}

/**
 * A deleted row with its Hide menu beside it: Hide, or Unhide when "Show hidden" has brought it back. Right-click, the
 * Menu key, long-press (native and phone-width web) and the "..." button (every width) open the one `RowMenu`. Rows of
 * live items have no such menu: only a deleted one can be hidden.
 */
export function HideRow({row, style, testID, target, isHidden, name}: HideProps & {row: (onLongPress?: () => void) => ReactNode; style?: StyleProp<ViewStyle>}) {
  const {t: l} = useLingui()
  const {toggle} = useHideItem(target)
  return (
    <RowMenu testID={testID} name={name} row={row} style={style}>
      <Menu.Item
        testID={`${testID}-${isHidden ? 'unhide' : 'hide'}`}
        label={isHidden ? l`Unhide` : l`Hide`}
        onPress={() => void toggle(!isHidden)}>
        <Menu.ItemText>{isHidden ? <Trans>Unhide</Trans> : <Trans>Hide</Trans>}</Menu.ItemText>
        <Menu.ItemIcon icon={isHidden ? EyeIcon : EyeOffIcon} position="right" />
      </Menu.Item>
    </RowMenu>
  )
}
