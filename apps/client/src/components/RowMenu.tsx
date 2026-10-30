import {type ReactNode} from 'react'
import {type StyleProp, View, type ViewStyle} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {isContextMenuKey} from '#/lib/contextMenuKey'
import {useHaptics} from '#/lib/haptics'
import {atoms as a, useBreakpoints, web} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import * as Menu from '#/components/Menu'
import {IS_NATIVE, IS_WEB} from '#/env'

type Control = ReturnType<typeof Menu.useMenuControl>

type Anchor = {x: number; y: number}
type WebEvent = {
  preventDefault(): void
  clientX: number
  clientY: number
  currentTarget: Element
}
type WebKeyEvent = {key: string; shiftKey: boolean; preventDefault(): void; currentTarget: Element}

/**
 * The one way a row opens its "more actions" menu (Bluesky's PostControls / ContextMenu gestures), so every row
 * answers the same gestures:
 * - `onLongPress`: native, and phone-width web, where iOS Safari fires no `contextmenu` on a long-press. Wide web has
 *   a mouse (right-click or the "..." button), so a held mouse button does not open it.
 * - `onContextMenu`: right-click (web only).
 * - `onKeyDown`: the Menu key and Shift+F10 (web only).
 * `onAnchor` is told where the menu should hang from (relative to the row), for rows whose "..." button is absent.
 */
export function useRowMenuTrigger(control: Control, {onAnchor}: {onAnchor?: (at: Anchor) => void} = {}) {
  const haptics = useHaptics()
  const {gtMobile} = useBreakpoints()
  const open = () => {
    haptics.longPress()
    control.open()
  }
  return {
    open,
    onLongPress: IS_NATIVE || !gtMobile ? open : undefined,
    onContextMenu: IS_WEB
      ? (e: WebEvent) => {
          e.preventDefault()
          const box = e.currentTarget.getBoundingClientRect()
          onAnchor?.({x: e.clientX - box.left, y: e.clientY - box.top})
          open()
        }
      : undefined,
    onKeyDown: IS_WEB
      ? (e: WebKeyEvent) => {
          if (!isContextMenuKey(e)) return
          e.preventDefault()
          const box = e.currentTarget.getBoundingClientRect()
          onAnchor?.({x: box.width / 2, y: box.height})
          control.open()
        }
      : undefined,
  }
}

/**
 * A row with its "more actions" menu beside it. `row` is handed the long-press handler to put on the row's own
 * Link / Pressable (a sibling of the menu button, never nested in it, as Bluesky's row overflow). Right-click, the
 * Menu key and the "..." button open the same menu. The button shows on every width, or on wide screens only with
 * `isButtonOnWideOnly` (phones keep the row exactly as it was, and long-press is the way in). `children` are the
 * menu's items.
 */
export function RowMenu({
  row,
  style,
  testID,
  name,
  isButtonOnWideOnly = false,
  children,
}: {
  row: (onLongPress?: () => void) => ReactNode
  style?: StyleProp<ViewStyle>
  testID: string
  /** The row's title, for the screen reader. */
  name: string
  isButtonOnWideOnly?: boolean
  children: ReactNode
}) {
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const control = Menu.useMenuControl()
  const trigger = useRowMenuTrigger(control)
  const isButtonShown = gtMobile || !isButtonOnWideOnly
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        style,
        /* Safari's link callout (preview sheet) would take a long-press on an anchor row before the menu does. */
        web({WebkitTouchCallout: 'none'} as ViewStyle),
      ]}
      {...(IS_WEB ? {onContextMenu: trigger.onContextMenu, onKeyDown: trigger.onKeyDown as never} : {})}>
      <View style={[a.flex_1]}>{row(trigger.onLongPress)}</View>
      <Menu.Root control={control}>
        <Menu.Trigger label={l`More options for ${name}`}>
          {({props}) =>
            isButtonShown ? (
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
        <Menu.Outer>{children}</Menu.Outer>
      </Menu.Root>
    </View>
  )
}
