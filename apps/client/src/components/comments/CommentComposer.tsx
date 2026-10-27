// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/components/MessageComposer.tsx
import {useEffect, useRef, useState} from 'react'
import {
  Pressable,
  TextInput,
  type TextInputKeyPressEvent,
  type TextInputSelectionChangeEvent,
  View,
} from 'react-native'
import {useReanimatedKeyboardAnimation} from 'react-native-keyboard-controller'
import Animated, {useAnimatedStyle} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Trans, useLingui} from '@lingui/react/macro'
import {mentionRanges} from '@splito/sync'

import {HITSLOP_10} from '#/lib/constants'
import {useHaptics} from '#/lib/haptics'
import {PressableScale} from '#/motion/PressableScale'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {useShellLayout} from '#/state/shell/shell-layout'
import {atoms as a, tokens, useBreakpoints, useTheme} from '#/alf'
import {EmojiButton} from '#/components/comments/EmojiButton'
import {KeyboardStickyView} from '#/components/comments/KeyboardStickyView'
import {
  activeMention,
  type CommentPerson,
  insertMention,
  matchPeople,
} from '#/components/comments/mentions'
import {TimesLarge_Stroke2_Corner0_Rounded as CloseIcon} from '#/components/icons/Times'
import {PaperPlaneVertical_Filled_Stroke2_Corner1_Rounded as PaperPlaneIcon} from '#/components/icons/PaperPlane'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'

const MIN_HEIGHT = 40
const MAX_HEIGHT = 140

export interface Editing {
  id: string
  body: string
}

/**
 * The bar at the foot of a discussion, Bluesky's DM composer: a rounded field that
 * grows with the text, a round send button, the emoji picker on the web and the
 * system keyboard's emoji on phones. Typing `@` lists the expense's participants
 * (Bluesky's mention autocomplete). On the web Enter sends, Shift+Enter breaks the
 * line, Up in the empty field edits my last comment and Escape cancels an edit.
 */
export function CommentComposer({
  people,
  editing,
  onCancelEdit,
  onSubmit,
  onEditLast,
}: {
  /** Who can be mentioned: the expense's participants. */
  people: ReadonlyArray<CommentPerson>
  editing: Editing | null
  onCancelEdit(): void
  /** Resolves when written; a rejection puts the text back. */
  onSubmit(body: string, mentions: string[]): Promise<void>
  onEditLast(): void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const haptics = useHaptics()
  const {bottom} = useSafeAreaInsets()
  const {gtMobile} = useBreakpoints()
  // On a phone the tab bar below already covers the safe area; without one the composer does.
  const insetBottom = gtMobile ? bottom : 0
  const input = useRef<React.ComponentRef<typeof TextInput>>(null)
  const [text, setText] = useState('')
  const [caret, setCaret] = useState(0)
  const [forcedSelection, setForcedSelection] = useState<{
    start: number
    end: number
  }>()
  const [height, setHeight] = useState(MIN_HEIGHT)
  const [picked, setPicked] = useState(0)
  const [isSending, setIsSending] = useState(false)
  // Guards a second submit before React re-renders with the cleared field (Bluesky's isSubmittingRef).
  const isSubmitting = useRef(false)

  // Starting an edit loads that comment into the field (the page keeps one `editing` object per edit).
  useEffect(() => {
    if (!editing) return
    setText(editing.body)
    setForcedSelection({start: editing.body.length, end: editing.body.length})
    input.current?.focus()
  }, [editing])

  const token = activeMention(text, caret)
  const options = token ? matchPeople(people, token.query) : []
  const isListOpen = options.length > 0
  const submitDisabled = isSending || text.trim().length === 0

  const choose = (person: CommentPerson) => {
    if (!token) return
    const next = insertMention(text, token, caret, person.name)
    setText(next.text)
    setForcedSelection({start: next.caret, end: next.caret})
    setPicked(0)
    input.current?.focus()
  }

  const submit = () => {
    const body = text.trim()
    if (!body || isSubmitting.current) return
    isSubmitting.current = true
    setIsSending(true)
    const ids = [
      ...new Set(
        mentionRanges(
          body,
          people,
          people.map(p => p.id),
        ).map(r => r.personId),
      ),
    ]
    haptics.confirm()
    // Local writes are instant, so the field clears at once; a failure puts the words back.
    setText('')
    setHeight(MIN_HEIGHT)
    onSubmit(body, ids)
      .catch(() => setText(body))
      .finally(() => {
        isSubmitting.current = false
        setIsSending(false)
        if (IS_WEB) input.current?.focus()
      })
  }

  const cancelEdit = () => {
    setText('')
    setHeight(MIN_HEIGHT)
    onCancelEdit()
  }

  const onKeyPress = (e: TextInputKeyPressEvent) => {
    if (!IS_WEB) return
    const {key, shiftKey} = e.nativeEvent as typeof e.nativeEvent & {
      shiftKey?: boolean
    }
    const stop = () => (e as unknown as Event).preventDefault()
    if (isListOpen && (key === 'ArrowDown' || key === 'ArrowUp')) {
      stop()
      setPicked(
        i =>
          (i + (key === 'ArrowDown' ? 1 : options.length - 1)) % options.length,
      )
    } else if (isListOpen && (key === 'Enter' || key === 'Tab')) {
      stop()
      choose(options[Math.min(picked, options.length - 1)]!)
    } else if (key === 'Enter' && !shiftKey) {
      stop()
      submit()
    } else if (key === 'Escape' && editing) {
      stop()
      cancelEdit()
    } else if (key === 'ArrowUp' && text === '' && !editing) {
      stop()
      onEditLast()
    }
  }

  const onSelectionChange = (e: TextInputSelectionChangeEvent) => {
    setCaret(e.nativeEvent.selection.end)
    setForcedSelection(undefined)
  }

  return (
    <Dock>
      <View
        style={[
          t.atoms.bg,
          a.border_t,
          t.atoms.border_contrast_low,
          a.pt_sm,
          a.px_lg,
          {paddingBottom: tokens.space.md + insetBottom},
        ]}>
        {editing ? (
          <View
            testID="comment-editing"
            style={[a.flex_row, a.align_center, a.gap_sm, a.pb_sm]}>
            <Text
              style={[
                a.flex_1,
                a.text_sm,
                a.font_semi_bold,
                {color: t.palette.primary_500},
              ]}>
              <Trans>Editing comment</Trans>
            </Text>
            <Pressable
              testID="comment-edit-cancel"
              accessibilityRole="button"
              accessibilityLabel={l`Cancel editing`}
              accessibilityHint=""
              hitSlop={HITSLOP_10}
              onPress={cancelEdit}>
              <CloseIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
            </Pressable>
          </View>
        ) : null}
        <View style={[a.flex_row, a.gap_sm, a.align_end]}>
          <View
            style={[
              a.flex_1,
              a.rounded_xl,
              t.atoms.bg_contrast_50,
              {minHeight: MIN_HEIGHT},
            ]}>
            {isListOpen ? (
              <View
                testID="mention-list"
                style={[
                  a.absolute,
                  a.left_0,
                  a.right_0,
                  a.p_xs,
                  a.rounded_sm,
                  a.border,
                  a.z_50,
                  t.atoms.bg,
                  t.atoms.border_contrast_low,
                  t.atoms.shadow_md,
                  {bottom: '100%', marginBottom: 6},
                ]}>
                {options.map((p, i) => (
                  <Pressable
                    key={p.id}
                    testID={`mention-option-${p.name}`}
                    accessibilityRole="button"
                    accessibilityLabel={l`Mention ${p.name}`}
                    accessibilityHint=""
                    // The field keeps focus (and the keyboard) while a person is chosen.
                    onPressIn={e => IS_WEB && e.preventDefault?.()}
                    onPress={() => choose(p)}
                    style={[
                      a.flex_row,
                      a.align_center,
                      a.gap_md,
                      a.px_md,
                      a.py_sm,
                      a.rounded_xs,
                      i === picked && t.atoms.bg_contrast_25,
                    ]}>
                    <UserAvatar size={28} name={p.avatarName} type="user" />
                    <Text
                      numberOfLines={1}
                      style={[a.flex_1, a.text_md, a.font_medium]}>
                      {p.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {IS_WEB ? (
              <EmojiButton
                onPick={emoji =>
                  setText(x => x.slice(0, caret) + emoji + x.slice(caret))
                }
                onClosed={() => input.current?.focus()}
              />
            ) : null}
            <TextInput
              ref={input}
              testID="comment-input"
              accessibilityLabel={editing ? l`Edit comment` : l`Add a comment`}
              accessibilityHint=""
              placeholder={l({
                message: 'Add a comment',
                context: 'placeholder',
              })}
              placeholderTextColor={t.palette.contrast_500}
              multiline
              value={text}
              selection={forcedSelection}
              onChangeText={v => {
                setText(v)
                setPicked(0)
              }}
              // The web reports the caret with the input itself, before any selection event.
              onChange={e => {
                const at = (
                  e.target as unknown as {selectionStart?: number} | undefined
                )?.selectionStart
                if (IS_WEB && typeof at === 'number') setCaret(at)
              }}
              onSelectionChange={onSelectionChange}
              onKeyPress={onKeyPress}
              onContentSizeChange={e =>
                setHeight(
                  Math.max(
                    MIN_HEIGHT,
                    Math.min(
                      MAX_HEIGHT,
                      Math.ceil(e.nativeEvent.contentSize.height) + 20,
                    ),
                  ),
                )
              }
              style={[
                a.text_md,
                a.leading_snug,
                t.atoms.text,
                {
                  height,
                  paddingLeft: 16,
                  paddingTop: 10,
                  paddingBottom: 10,
                  paddingRight: 16 + (IS_WEB ? 20 : 0),
                },
                IS_WEB && ({outlineStyle: 'none'} as object),
              ]}
            />
          </View>
          <PressableScale
            testID="comment-send"
            accessibilityRole="button"
            accessibilityLabel={editing ? l`Save comment` : l`Send comment`}
            accessibilityHint=""
            hitSlop={HITSLOP_10}
            targetScale={0.95}
            onPress={submit}
            disabled={submitDisabled}
            style={[
              a.rounded_full,
              a.align_center,
              a.justify_center,
              {
                height: MIN_HEIGHT,
                width: MIN_HEIGHT,
                backgroundColor: submitDisabled
                  ? t.palette.contrast_100
                  : t.palette.primary_500,
              },
            ]}>
            <PaperPlaneIcon size="md" fill={t.palette.white} />
          </PressableScale>
        </View>
      </View>
    </Dock>
  )
}

/**
 * Keeps the bar above the phone's tab bar, and above the keyboard when it is up:
 * the keyboard covers the tab bar, so the room left for it closes as the keyboard
 * opens (Bluesky's `KeyboardStickyView`, plus the shell's `footerHeight`).
 */
function Dock({children}: {children: React.ReactNode}) {
  const {footerHeight} = useShellLayout()
  const {progress} = useReanimatedKeyboardAnimation()
  const style = useAnimatedStyle(() => ({
    marginBottom: footerHeight.get() * (1 - progress.get()),
  }))
  // The web page scrolls as a whole, so the bar sticks to the foot of the window (above the tab bar) instead of ending the page.
  const stuck = useAnimatedStyle(() => ({bottom: footerHeight.get()}))
  return (
    <Animated.View
      style={[
        style,
        IS_WEB && [{position: 'sticky', zIndex: 10} as object, stuck],
      ]}>
      <KeyboardStickyView>{children}</KeyboardStickyView>
    </Animated.View>
  )
}
