// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/components/MessageComposer.tsx
import {forwardRef, useRef, useState} from 'react'
import {TextInput as RNTextInput, type TextInputKeyPressEvent, View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {HITSLOP_10} from '#/lib/constants'
import {useHaptics} from '#/lib/haptics'
import {PressableScale} from '#/motion/PressableScale'
import {atoms as a, platform, useTheme, web} from '#/alf'
import {PaperPlaneVertical_Filled_Stroke2_Corner1_Rounded as PaperPlaneIcon} from '#/components/icons/PaperPlane'
import {IS_WEB} from '#/env'

type InputRef = React.ComponentRef<typeof RNTextInput>

const MIN_HEIGHT = 40
const MAX_HEIGHT = 120

/**
 * Bluesky's message composer: a rounded field that grows with its text, and a
 * round send button that is muted until there is something to send. Enter
 * sends on the web (Shift+Enter breaks the line); the draft belongs to the
 * caller, who keeps it when the drawer closes.
 */
export function AskComposer({
  draft,
  onDraftChange,
  onSend,
  isDisabled = false,
}: {
  draft: string
  onDraftChange: (text: string) => void
  onSend: (text: string) => void
  isDisabled?: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const input = useRef<InputRef>(null)
  const [height, setHeight] = useState(MIN_HEIGHT)
  const canSend = draft.trim().length > 0 && !isDisabled

  const send = () => {
    if (!canSend) return
    haptics.confirm()
    const text = draft
    onDraftChange('')
    setHeight(MIN_HEIGHT)
    onSend(text)
    if (IS_WEB) input.current?.focus()
  }

  const onKeyPress = (e: TextInputKeyPressEvent) => {
    if (!IS_WEB) return
    const ev = e.nativeEvent as unknown as {key: string; shiftKey?: boolean}
    if (ev.key === 'Enter' && !ev.shiftKey) {
      ;(e as unknown as {preventDefault: () => void}).preventDefault()
      send()
    }
  }

  return (
    <View style={[a.flex_row, a.align_end, a.gap_sm]}>
      <View
        style={[
          a.flex_1,
          a.rounded_xl,
          t.atoms.bg_contrast_50,
          {minHeight: MIN_HEIGHT},
        ]}>
        <Input
          ref={input}
          value={draft}
          onChangeText={onDraftChange}
          onKeyPress={onKeyPress}
          onContentSizeChange={h => setHeight(Math.min(Math.max(h, MIN_HEIGHT), MAX_HEIGHT))}
          height={height}
          placeholder={l`Ask about your balances and spending`}
          label={l`Message input field`}
          onSubmit={platform({web: undefined, default: send})}
        />
      </View>
      <PressableScale
        testID="ask-send"
        accessibilityRole="button"
        accessibilityLabel={l`Send message`}
        accessibilityHint=""
        hitSlop={HITSLOP_10}
        targetScale={0.95}
        disabled={!canSend}
        onPress={send}
        style={[
          a.rounded_full,
          a.align_center,
          a.justify_center,
          {
            height: MIN_HEIGHT,
            width: MIN_HEIGHT,
            backgroundColor: canSend ? t.palette.primary_500 : t.palette.contrast_100,
          },
        ]}>
        <PaperPlaneIcon size="md" fill={t.palette.white} />
      </PressableScale>
    </View>
  )
}

const Input = forwardRef<
  InputRef,
  {
    value: string
    onChangeText: (t: string) => void
    onKeyPress: (e: TextInputKeyPressEvent) => void
    onContentSizeChange: (height: number) => void
    height: number
    placeholder: string
    label: string
    onSubmit?: () => void
  }
>(function Input({value, onChangeText, onKeyPress, onContentSizeChange, height, placeholder, label, onSubmit}, ref) {
  const t = useTheme()
  return (
    <RNTextInput
      ref={ref}
      testID="ask-input"
      accessibilityLabel={label}
      accessibilityHint=""
      placeholder={placeholder}
      placeholderTextColor={t.atoms.text_contrast_medium.color}
      value={value}
      onChangeText={onChangeText}
      onKeyPress={onKeyPress}
      onContentSizeChange={e => onContentSizeChange(e.nativeEvent.contentSize.height + 20)}
      onSubmitEditing={onSubmit}
      submitBehavior="submit"
      returnKeyType="send"
      multiline
      autoFocus
      style={[
        a.text_md,
        a.leading_snug,
        t.atoms.text,
        {height, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, textAlignVertical: 'center'},
        web({outlineStyle: 'none', resize: 'none'} as object),
      ]}
    />
  )
})
