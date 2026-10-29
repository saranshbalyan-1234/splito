import {useEffect, useRef} from 'react'
import {type GestureResponderEvent, Pressable, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import {Trans, useLingui} from '@lingui/react/macro'

import {atoms as a, tokens, useBreakpoints, useTheme} from '#/alf'
import {AppLanguageDropdown} from '#/components/AppLanguageDropdown'
import {Button, ButtonText} from '#/components/Button'
import {ScreenTransition} from '#/components/ScreenTransition'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {SLIDE_ART} from './art'

/** How many intro slides there are (up to five, ARCHITECTURE 26.2). */
export const SLIDE_COUNT = SLIDE_ART.length
const SWIPE_PX = 48

/** Where a touch is, on a phone (`pageX`) and in the browser (the event's own touch list). */
function touchX(e: GestureResponderEvent) {
  const n = e.nativeEvent as unknown as {pageX?: number; changedTouches?: Array<{pageX: number}>}
  return n.changedTouches?.[0]?.pageX ?? n.pageX ?? 0
}

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
  const touchStartX = useRef<number | null>(null)
  const last = slide === SLIDE_COUNT - 1
  const Art = SLIDE_ART[slide]!
  const {title, body} = slides[slide]!
  const move = (to: number) => to >= 0 && to < SLIDE_COUNT && onSlide(to)

  /* Escape is Skip; the arrow keys page (web). */
  useEffect(() => {
    if (!IS_WEB) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDone()
      else if (e.key === 'ArrowRight') move(slide + 1)
      else if (e.key === 'ArrowLeft') move(slide - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const onTouchStart = (e: GestureResponderEvent) => {
    touchStartX.current = touchX(e)
  }
  const onTouchEnd = (e: GestureResponderEvent) => {
    const from = touchStartX.current
    touchStartX.current = null
    if (from === null) return
    const dx = touchX(e) - from
    if (Math.abs(dx) >= SWIPE_PX) move(slide + (dx < 0 ? 1 : -1))
  }

  const card = (
    <View
      testID="welcome"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
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
        <View style={{width: '100%', maxWidth: 320, aspectRatio: 240 / 160}}>
          <Art />
        </View>
        <View style={[a.gap_sm, a.align_center, {maxWidth: 420}]}>
          <Text testID="welcome-step" style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
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
