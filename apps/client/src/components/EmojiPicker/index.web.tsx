// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/EmojiPicker/index.web.tsx
import {
  createContext,
  lazy,
  Suspense,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'

import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, flatten} from '#/alf'
import * as Menu from '../Menu'
import {useWebPreloadEmoji} from './preload'
import {
  type Emoji,
  type PickerProps,
  type RootProps,
  type TriggerProps,
} from './types'

export * from './types'

// The picker UI is its own chunk too (emoji-mart core stays out of the main bundle).
const EmojiPicker = lazy(() => import('@emoji-mart/react'))

const EmojiPickerContext = createContext<{
  onEmojiSelect: (emoji: Emoji) => void
  nextFocusRef: RootProps['nextFocusRef']
} | null>(null)

/**
 * Provides emoji picker context and wraps children in a {@link Menu.Root}.
 *
 * Forwards the chosen emoji to `onEmojiSelect`.
 *
 * @platform web
 */
export function Root({
  children,
  control,
  onEmojiSelect,
  preloadOnMount = false,
  nextFocusRef,
}: RootProps) {
  useWebPreloadEmoji({immediate: preloadOnMount})

  const value = useMemo(
    () => ({
      onEmojiSelect: (emoji: Emoji) => {
        if (onEmojiSelect) onEmojiSelect(emoji)
      },
      nextFocusRef,
    }),
    [onEmojiSelect, nextFocusRef],
  )

  return (
    <EmojiPickerContext value={value}>
      <Menu.Root control={control}>{children}</Menu.Root>
    </EmojiPickerContext>
  )
}

/**
 * Passthrough to {@link Menu.Trigger}. Accepts the same render-prop children
 * pattern.
 *
 * @platform web
 */
export function Trigger(props: TriggerProps) {
  return <Menu.Trigger {...props} />
}

/**
 * Renders the emoji picker inside a Radix `DropdownMenu.Portal`.
 *
 * Holding Shift while selecting an emoji keeps the picker open for
 * multi-select. Otherwise the menu closes after each selection.
 *
 * Must be rendered inside a {@link Root}.
 *
 * @platform web
 */
export function Picker({keepOpenWhenShiftHeld = true}: PickerProps) {
  const {onEmojiSelect, nextFocusRef} = useEmojiPickerContext()
  const {control} = Menu.useMenuContext()
  const reduceMotionEnabled = useShouldReduceMotion()
  // The data is its own chunk: wait for it, so an early open never shows an empty picker.
  const load = useWebPreloadEmoji()
  const [isReady, setIsReady] = useState(false)
  useEffect(() => {
    void load().then(() => setIsReady(true))
  }, [load])
  const isShiftDown = useRef(false)

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftDown.current = true
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        isShiftDown.current = false
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('keyup', onKeyUp, true)

    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('keyup', onKeyUp, true)
    }
  }, [])

  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={5}
        collisionPadding={{left: 5, right: 5, bottom: 5}}
        className="dropdown-menu-transform-origin dropdown-menu-constrain-size"
        onCloseAutoFocus={evt => {
          if (!nextFocusRef) return
          let element =
            nextFocusRef instanceof Function
              ? nextFocusRef()
              : nextFocusRef.current
          if (element) {
            evt.preventDefault()
            element.focus()
          }
        }}>
        <div
          onWheel={evt => evt.stopPropagation()}
          style={flatten([!reduceMotionEnabled && a.zoom_fade_in])}>
          {isReady ? (
            <Suspense fallback={null}>
              <EmojiPicker
                autoFocus
                onEmojiSelect={(emoji: Emoji) => {
                  onEmojiSelect(emoji)

                  if (!keepOpenWhenShiftHeld || !isShiftDown.current) {
                    control.close()
                  }
                }}
              />
            </Suspense>
          ) : null}
        </div>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  )
}

function useEmojiPickerContext() {
  const ctx = useContext(EmojiPickerContext)
  if (!ctx)
    throw new Error(
      'EmojiPicker.Picker must be used within an EmojiPicker.Root component',
    )
  return ctx
}
