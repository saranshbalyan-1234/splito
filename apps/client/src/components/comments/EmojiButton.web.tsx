// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/components/MessageComposer.tsx
import {Pressable} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {atoms as a, useTheme} from '#/alf'
import {useIsWebDrawer} from '#/components/Dialog/drawer.web'
import * as EmojiPicker from '#/components/EmojiPicker'
import {EmojiArc_Stroke2_Corner0_Rounded as EmojiSmileIcon} from '#/components/icons/Emoji'

/** Bluesky's emoji picker button inside the composer (web, wider than a phone: phones keep the system keyboard). */
export function EmojiButton({
  onPick,
  onClosed,
}: {
  onPick: (emoji: string) => void
  onClosed: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const isDrawer = useIsWebDrawer()
  if (isDrawer) return null
  return (
    <EmojiPicker.Root
      onEmojiSelect={emoji => onPick(emoji.native)}
      nextFocusRef={() => ({focus: onClosed})}>
      <EmojiPicker.Trigger label={l`Open emoji picker`}>
        {({props, state, control}) => (
          <Pressable
            testID="comment-emoji"
            {...props}
            style={[
              a.overflow_hidden,
              a.absolute,
              a.rounded_full,
              a.align_center,
              a.justify_center,
              a.z_30,
              {height: 20, width: 20, top: 10, right: 10},
            ]}>
            <EmojiSmileIcon
              size="md"
              style={
                state.hovered ||
                state.focused ||
                state.pressed ||
                control.isOpen
                  ? {color: t.palette.primary_500}
                  : t.atoms.text_contrast_high
              }
            />
          </Pressable>
        )}
      </EmojiPicker.Trigger>
      <EmojiPicker.Picker />
    </EmojiPicker.Root>
  )
}
