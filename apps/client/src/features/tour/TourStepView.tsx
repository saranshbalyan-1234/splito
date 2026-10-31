import {useEffect, useRef, useState} from 'react'
import {AccessibilityInfo, useWindowDimensions, View} from 'react-native'
import Animated, {FadeIn} from 'react-native-reanimated'
import {useLingui} from '@lingui/react/macro'

import {useNonReactiveCallback} from '#/lib/hooks/useNonReactiveCallback'
import {cardWidth, placeCard, spotlightOf} from '#/lib/tour/layout'
import {measureTarget, type Rect} from '#/lib/tour/registry'
import {type TourStep, TARGET_SHAPE} from '#/lib/tour/steps'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'
import {atoms as a, useTheme, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import {Portal} from '#/components/Portal'
import {Text} from '#/components/Typography'
import {IS_NATIVE, IS_WEB} from '#/env'
import {TourBackdrop} from './TourBackdrop'

/** How long a control may take to show (a list mounting after the transition) before its step is given up. */
const TARGET_WAIT_MS = 1500
const RETRY_MS = 100
/* A second look after a spring or a layout shift (the FAB settles, the list finishes mounting). */
const SETTLE_MS = 350
/* The card's height before it has been laid out; it is invisible until then. */
const CARD_HEIGHT_GUESS = 190

/** The words of one step; the sentence follows what the step points at and whether there is anything to show yet. */
function useStepCopy(step: TourStep): {title: string; body: string} {
  const {t: l} = useLingui()
  const isEmpty = step.variant === 'empty'
  switch (step.id) {
    case 'add-expense':
      return {
        title: l`Add an expense`,
        body: isEmpty ? l`Add a friend here first, then split your first bill with them.` : l`Start here: enter what you paid and who shares it.`,
      }
    case 'balances':
      return {
        title: l`See who owes whom`,
        body: isEmpty ? l`Your friends will show up here, with what you owe each other.` : l`Each friend shows what you owe each other, in every currency.`,
      }
    case 'settle-up':
      return {
        title: l`Settle up`,
        body: step.target === 'tab-groups' ? l`Groups keep shared balances. Open one and choose Settle up.` : l`Open a friend to see the balance and record a payment.`,
      }
  }
}

/**
 * One step of the guided tour (F-253): the dim with the blurred screen and a sharp, rounded cut-out around the control,
 * and the caption card beside it with Skip and Next (Done on the last step). It measures its own control, so a step is a
 * mount: the parent keys it by step. Focus moves to the card on web and the step is announced on phones; Escape skips.
 */
export function TourStepView({
  step,
  position,
  count,
  onNext,
  onSkip: onSkipProp,
  onUnavailable: onUnavailableProp,
}: {
  step: TourStep
  /** 1-based. */
  position: number
  count: number
  onNext: () => void
  onSkip: () => void
  /** The control never showed: go on to the next step. */
  onUnavailable: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const screen = useWindowDimensions()
  const shouldReduceMotion = useShouldReduceMotion()
  const {title, body} = useStepCopy(step)
  const stepLabel = l`Step ${position} of ${count}`
  const isLast = position === count
  const [target, setTarget] = useState<Rect | null>(null)
  const [cardHeight, setCardHeight] = useState<number | null>(null)
  const card = useRef<React.ComponentRef<typeof View>>(null)
  /* The parent's closures change every render; the effects below must not restart for that. */
  const onSkip = useNonReactiveCallback(onSkipProp)
  const onUnavailable = useNonReactiveCallback(onUnavailableProp)

  /* Find the control (it may still be mounting), then look once more when it has settled; again on a resize. */
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const startedAt = Date.now()
    const find = async () => {
      const rect = await measureTarget(step.target)
      if (cancelled) return
      if (rect) {
        setTarget(prev => (prev && sameRect(prev, rect) ? prev : rect))
        timer = setTimeout(async () => {
          const settled = await measureTarget(step.target)
          if (!cancelled && settled) setTarget(prev => (prev && sameRect(prev, settled) ? prev : settled))
        }, SETTLE_MS)
      } else if (Date.now() - startedAt >= TARGET_WAIT_MS) onUnavailable()
      else timer = setTimeout(find, RETRY_MS)
    }
    void find()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [step.target, screen.width, screen.height, onUnavailable])

  /* Escape is Skip; focus goes to the card so a keyboard or screen reader starts on the step. */
  useEffect(() => {
    if (!IS_WEB) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onSkip])
  /* The card sits in a portal, so it exists once it has been laid out, not when the target was found. */
  const isCardReady = cardHeight !== null
  useEffect(() => {
    if (!isCardReady) return
    if (IS_WEB) (card.current as unknown as HTMLElement | null)?.focus({preventScroll: true})
    else if (IS_NATIVE) AccessibilityInfo.announceForAccessibility(`${stepLabel}. ${title}. ${body}`)
  }, [isCardReady, stepLabel, title, body])

  if (!target) return null
  const spot = spotlightOf(target, TARGET_SHAPE[step.target])
  const width = cardWidth(screen.width)
  const place = placeCard(spot.rect, screen, {width, height: cardHeight ?? CARD_HEIGHT_GUESS})

  return (
    <Portal>
      <View
        testID="tour"
        role="dialog"
        aria-modal
        aria-label={`${title}. ${stepLabel}`}
        accessibilityViewIsModal
        style={[a.absolute, a.inset_0, web({position: 'fixed', inset: 0}), {zIndex: 1000}]}>
        <TourBackdrop screen={screen} spot={spot} />
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeIn.duration(180)}
          style={[a.absolute, {left: place.x, top: place.y, width}, cardHeight === null && {opacity: 0}]}>
          <View
            ref={card}
            testID="tour-card"
            /* Focusable by script only (web): the caption takes focus when the step appears. */
            {...(IS_WEB ? ({tabIndex: -1} as object) : null)}
            onLayout={e => setCardHeight(e.nativeEvent.layout.height)}
            style={[a.p_lg, a.gap_md, a.rounded_md, a.border, t.atoms.bg, t.atoms.border_contrast_medium, web({outlineStyle: 'none'})]}>
            <View style={a.gap_xs}>
              <Text testID="tour-step" style={[a.text_sm, t.atoms.text_contrast_medium]}>
                {stepLabel}
              </Text>
              <Text testID="tour-title" accessibilityRole="header" style={[a.text_lg, a.font_bold, a.leading_snug]}>
                {title}
              </Text>
              <Text testID="tour-body" style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
                {body}
              </Text>
            </View>
            <View style={[a.flex_row, a.align_center, a.justify_end, a.gap_sm]}>
              {!isLast && (
                <Button testID="tour-skip" label={l`Skip the tour`} size="large" color="secondary" variant="ghost" onPress={onSkip}>
                  <ButtonText>{l`Skip`}</ButtonText>
                </Button>
              )}
              <Button testID="tour-next" label={isLast ? l`Done` : l`Next`} size="large" color="primary" onPress={onNext}>
                <ButtonText>{isLast ? l`Done` : l`Next`}</ButtonText>
              </Button>
            </View>
          </View>
        </Animated.View>
      </View>
    </Portal>
  )
}

const sameRect = (x: Rect, y: Rect) => x.x === y.x && x.y === y.y && x.width === y.width && x.height === y.height
