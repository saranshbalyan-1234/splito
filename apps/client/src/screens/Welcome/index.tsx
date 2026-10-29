import {useEffect, useRef} from 'react'
import {type GestureResponderEvent, Pressable, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import Animated, {useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, tokens, useBreakpoints, useTheme} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {Button, ButtonText} from '#/components/Button'
import {ScreenTransition} from '#/components/ScreenTransition'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {Illustration} from '#/motion/Illustration'
import {type IllustrationName} from '#/motion/illustrations'

/** How many intro slides there are (up to five, ARCHITECTURE 26.2). */
const SLIDE_ART = ['welcome-split', 'welcome-bills', 'welcome-settle', 'welcome-ask', 'welcome-offline'] as const satisfies readonly IllustrationName[]
export const SLIDE_COUNT = SLIDE_ART.length
const SWIPE_PX = 48
/** The slide's animation (Lottie, original: `pnpm lottie`; a still frame under reduced motion). */
const ILLUSTRATION_SIZE = 240

/* Present for assistive tech, invisible and out of the layout. */
const VISUALLY_HIDDEN = {position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0} as const

/** The arrow keys must not page the intro while a field or list has them. */
const isTyping = (e: KeyboardEvent) => e.target instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)

/** Where a touch is, on a phone (`pageX`) and in the browser (the event's own touch list). */
function touchAt(e: GestureResponderEvent) {
  const n = e.nativeEvent as unknown as {pageX?: number; pageY?: number; changedTouches?: Array<{pageX: number; pageY: number}>}
  const touch = n.changedTouches?.[0]
  return {x: touch?.pageX ?? n.pageX ?? 0, y: touch?.pageY ?? n.pageY ?? 0}
}

/** A drag counts as a horizontal swipe only when it is clearly more sideways than up or down (a scroll or a diagonal flick is not). */
const isHorizontal = (dx: number, dy: number) => Math.abs(dx) > Math.abs(dy) * 1.5

/** The slide a path or param names, 0-based; anything else is the first. */
export function slideFrom(step: string | undefined) {
  const n = Number(step)
  return Number.isInteger(n) && n >= 1 && n <= SLIDE_COUNT ? n - 1 : 0
}

function useSlides() {
  const {t: l} = useLingui()
  /* No claim of a feature that is not built (§ 0 rule 6): no sync, no accounts to share with. */
  return [
    {title: l`Split anything with anyone`, body: l`Friends, groups and trips in any currency, each kept apart and never mixed.`},
    {title: l`Bills done right`, body: l`Split by item and portion, with different taxes per item, service charge and round-off.`},
    {title: l`Settle up in the fewest payments`, body: l`See who pays whom, record cash or UPI, and remind a friend gently.`},
    {title: l`Search or ask anything`, body: l`Try “How much did I spend on food in Goa?” and get the answer from your own expenses.`},
    {title: l`Yours, and works offline`, body: l`Everything is saved on this device first, so Splito works without a connection.`},
  ]
}

/**
 * The intro slides before sign-in (F-249, owners 123/142): up to five swipeable slides, each an original illustration, a
 * title and one sentence. Skip is top right on every slide, the primary is Next and then Get started, the dots are
 * tappable, and a language chip sits top left on the first. Controlled: the host owns `slide` (a URL on web).
 * Bluesky's direction-aware slide (`ScreenTransition`) moves between slides; its Pager is a native module this app
 * does not ship, and a touch swipe covers the same gesture on every platform.
 * Phone: full screen. Wider: a centred 560 px card (the host paints the dimmed ground).
 */
export function Welcome({
  slide,
  previous,
  onSlide,
  onDone,
  isLanguageFromDevice,
}: {
  slide: number
  /** The slide shown before this one, for the direction of the slide. */
  previous: number
  onSlide: (index: number) => void
  /** Skip and Get started: on to the Continue screen, or back to where the replay began. */
  onDone: () => void
  /** Signed out, the language chip edits the device's language; the replay edits the account's. */
  isLanguageFromDevice: boolean
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const insets = useSafeAreaInsets()
  const slides = useSlides()
  const touchStart = useRef<{x: number; y: number} | null>(null)
  /* The slide follows the finger while it is down. */
  const drag = useSharedValue(0)
  const dragStyle = useAnimatedStyle(() => ({transform: [{translateX: drag.value}]}))
  const last = slide === SLIDE_COUNT - 1
  const art = SLIDE_ART[slide]!
  const {title, body} = slides[slide]!
  const move = (to: number) => to >= 0 && to < SLIDE_COUNT && onSlide(to)

  /* Escape is Skip, unless it is closing the language list (checked on the way down, before the list handles it); the arrow keys page (web). */
  useEffect(() => {
    if (!IS_WEB) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!document.querySelector('[role="listbox"]')) onDone()
      } else if (e.key === 'ArrowRight' && !isTyping(e)) move(slide + 1)
      else if (e.key === 'ArrowLeft' && !isTyping(e)) move(slide - 1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  })

  const onTouchStart = (e: GestureResponderEvent) => {
    touchStart.current = touchAt(e)
  }
  const onTouchMove = (e: GestureResponderEvent) => {
    const from = touchStart.current
    if (!from) return
    const {x, y} = touchAt(e)
    const [dx, dy] = [x - from.x, y - from.y]
    if (!isHorizontal(dx, dy)) return
    /* Resists at the ends, where there is no slide to go to. */
    const hasNext = dx < 0 ? slide < SLIDE_COUNT - 1 : slide > 0
    drag.value = hasNext ? dx : dx / 4
  }
  const onTouchEnd = (e: GestureResponderEvent) => {
    const from = touchStart.current
    touchStart.current = null
    drag.value = withTiming(0, {duration: 120})
    if (!from) return
    const {x, y} = touchAt(e)
    const [dx, dy] = [x - from.x, y - from.y]
    if (isHorizontal(dx, dy) && Math.abs(dx) >= SWIPE_PX) move(slide + (dx < 0 ? 1 : -1))
  }
  const onTouchCancel = () => {
    touchStart.current = null
    drag.value = withTiming(0, {duration: 120})
  }

  const card = (
    <View
      testID="welcome"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      style={[
        a.flex_1,
        a.w_full,
        t.atoms.bg,
        gtMobile
          ? [a.rounded_xl, a.border, t.atoms.border_contrast_low, a.overflow_hidden, {maxWidth: 560, maxHeight: 680, minHeight: 600}]
          : {paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, tokens.space.lg)},
      ]}>
      <View style={[a.flex_row, a.align_center, a.justify_between, a.px_lg, a.pt_md, {minHeight: 52}]}>
        <View style={a.flex_1}>{slide === 0 ? <AppLanguageDropdown isDevice={isLanguageFromDevice} /> : null}</View>
        <Button testID="welcome-skip" label={l`Skip the intro`} size="small" variant="ghost" color="secondary" onPress={onDone}>
          <ButtonText>
            <Trans>Skip</Trans>
          </ButtonText>
        </Button>
      </View>

      <ScreenTransition key={slide} direction={slide >= previous ? 'Forward' : 'Backward'} style={[a.flex_1, a.align_center, a.justify_center, a.px_xl, a.gap_xl]}>
        <Animated.View testID="welcome-slide" style={[a.w_full, a.align_center, a.gap_xl, dragStyle]}>
        <Illustration key={art} name={art} size={ILLUSTRATION_SIZE} testID="welcome-art" />
        <View style={[a.gap_sm, a.align_center, {maxWidth: 420}]}>
          {/* Heard by screen readers, not drawn: the dots already show where the person is. */}
          <Text testID="welcome-step" style={VISUALLY_HIDDEN}>
            <Trans>
              Step {slide + 1} of {SLIDE_COUNT}
            </Trans>
          </Text>
          <Text testID="welcome-title" role="heading" aria-level={1} style={[a.text_3xl, a.font_bold, a.text_center, a.leading_tight]}>
            {title}
          </Text>
          <Text testID="welcome-body" style={[a.text_lg, a.text_center, a.leading_snug, t.atoms.text_contrast_medium]}>
            {body}
          </Text>
        </View>
        </Animated.View>
      </ScreenTransition>

      <View style={[a.align_center, a.gap_lg, a.px_xl, a.pb_xl]}>
        <View role="tablist" style={[a.flex_row, a.align_center]}>
          {slides.map((s, i) => (
            <Pressable
              key={i}
              testID={`welcome-dot-${i + 1}`}
              role="tab"
              aria-selected={i === slide}
              accessibilityLabel={l`Slide ${i + 1} of ${SLIDE_COUNT}: ${s.title}`}
              onPress={() => move(i)}
              style={[a.align_center, a.justify_center, {width: 44, height: 44}]}>
              <View
                style={{
                  height: 8,
                  width: i === slide ? 24 : 8,
                  borderRadius: 4,
                  backgroundColor: i === slide ? t.palette.primary_500 : t.palette.contrast_200,
                }}
              />
            </Pressable>
          ))}
        </View>
        <Button
          testID="welcome-next"
          label={last ? l`Get started` : l`Next`}
          size="large"
          variant="solid"
          color="primary"
          style={[a.w_full, {maxWidth: 420}]}
          onPress={() => (last ? onDone() : move(slide + 1))}>
          <ButtonText>{last ? <Trans>Get started</Trans> : <Trans>Next</Trans>}</ButtonText>
        </Button>
      </View>
    </View>
  )

  return gtMobile ? <View style={[a.flex_1, a.align_center, a.justify_center, a.p_xl]}>{card}</View> : card
}
