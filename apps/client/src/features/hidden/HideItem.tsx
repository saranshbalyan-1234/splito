import {Trans, useLingui} from '@lingui/react/macro'
import {type MoneyType} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {useHiddenItems, useSetHidden} from '#/data/hiddenItems'
import {Button, ButtonIcon} from '#/components/Button'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import * as Menu from '#/components/Menu'
import * as Toast from '#/components/Toast'
import {EyeIcon, EyeOffIcon} from '#/components/settings/icons'

/** What can be hidden: a deleted expense, payment, write-off or friend (by item), or a group (any time). */
export type HideTarget = {type: MoneyType | 'person'; id: string} | {type: 'group'; id: string}

/**
 * Hide / Unhide one thing for me only (decisions 104 to 106), with an Undo toast. `isHidden` is the item's current
 * state; the result of `toggle` is true when the change was saved.
 */
export function useHideItem(target: HideTarget) {
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const set = useSetHidden()
  const hidden = useHiddenItems()
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
  return {isHidden: target.type !== 'group' && hidden.has(target.id), toggle}
}

/**
 * A deleted row's "..." menu: Hide, or Unhide when "Show hidden" has brought it back. A sibling of the row's link,
 * never nested in it (Bluesky's row overflow). Rows of live items have no such menu: only a deleted one can be hidden.
 */
export function HideMenu({
  testID,
  target,
  isHidden,
  name,
}: {
  testID: string
  target: HideTarget
  isHidden: boolean
  /** The row's title, for the screen reader. */
  name: string
}) {
  const {t: l} = useLingui()
  const {toggle} = useHideItem(target)
  return (
    <Menu.Root>
      <Menu.Trigger label={l`More options for ${name}`}>
        {({props}) => (
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
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Item
          testID={`${testID}-${isHidden ? 'unhide' : 'hide'}`}
          label={isHidden ? l`Unhide` : l`Hide`}
          onPress={() => void toggle(!isHidden)}>
          <Menu.ItemText>{isHidden ? <Trans>Unhide</Trans> : <Trans>Hide</Trans>}</Menu.ItemText>
          <Menu.ItemIcon icon={isHidden ? EyeIcon : EyeOffIcon} position="right" />
        </Menu.Item>
      </Menu.Outer>
    </Menu.Root>
  )
}
