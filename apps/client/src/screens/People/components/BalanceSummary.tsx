import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type CurrencyTotal,
  formatAmount,
  getCurrency,
  magnitude,
  ZERO,
} from '@splito/domain'

import {Link} from '#/view/com/util/Link'
import {atoms as a, tokens, useTheme} from '#/alf'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {AnimatedAmount} from '#/motion/AnimatedAmount'
import {usePressScale} from '#/motion/PressableScale'
import {SectionHeader} from './SectionHeader'

const tabular = {fontVariant: ['tabular-nums' as const]}
const CARD_GAP = tokens.space.md

/**
 * The top of People: one card per currency with the net balance, and what
 * friends owe you and what you owe when both are open. Currencies are never
 * added together. Cards open Analytics. They share the row on wide screens
 * and stack on phones, so every card is whole on screen.
 */
export function BalanceSummary({
  totals,
  locale,
}: {
  totals: CurrencyTotal[]
  locale: string
}) {
  const {t: l} = useLingui()

  return (
    <View testID="people-summary">
      <SectionHeader testID="people-balances-title" title={l`Balances`} />
      <View
        style={[a.px_lg, a.pb_md, a.flex_row, a.flex_wrap, {gap: CARD_GAP}]}>
        {totals.map(total => (
          <SummaryCard key={total.currency} total={total} locale={locale} />
        ))}
      </View>
    </View>
  )
}

function SummaryCard({total, locale}: {total: CurrencyTotal; locale: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {currency, owed, owe, net} = total
  const press = usePressScale()
  const netColor =
    net > ZERO
      ? t.palette.positive_600
      : net < ZERO
        ? t.palette.negative_500
        : t.atoms.text.color

  /* The wrapper takes the card's place in the row so the whole card, border included, shrinks on press. */
  return (
    <Animated.View style={[{flexBasis: 280, flexGrow: 1}, press.style]}>
      <Link
        testID={`summary-${currency}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        href="/analytics"
        asAnchor
        anchorNoUnderline
        accessibilityLabel={l`${currency} balance – open analytics`}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
          a.px_lg,
          a.py_md,
          a.transition_color,
        ]}>
        <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_sm]}>
          <Text
            style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
            {net > ZERO ? (
              <Trans>You are owed</Trans>
            ) : net < ZERO ? (
              <Trans>You owe</Trans>
            ) : (
              <Trans>All settled up</Trans>
            )}
          </Text>
          <View
            style={[
              a.rounded_xs,
              a.px_xs,
              {paddingVertical: 1},
              t.atoms.bg_contrast_50,
            ]}>
            <Text
              accessibilityLabel={getCurrency(currency).name}
              style={[
                a.text_xs,
                a.font_semi_bold,
                t.atoms.text_contrast_medium,
              ]}>
              {currency}
            </Text>
          </View>
        </View>
        <View style={a.pt_xs}>
          <AnimatedAmount
            testID={`summary-${currency}-net`}
            minor={magnitude(net)}
            currency={currency}
            locale={locale}
            style={[
              a.text_3xl,
              a.font_bold,
              a.leading_tight,
              {color: netColor},
            ]}
          />
        </View>
        {/* Both sides only when both are open; otherwise they repeat the headline. */}
        {owed !== ZERO && owe !== ZERO && (
          <View style={[a.flex_row, a.flex_wrap, a.pt_sm, a.gap_md]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                Owed to you{' '}
                <Text
                  style={[a.text_sm, a.font_semi_bold, t.atoms.text, tabular]}>
                  {formatAmount(owed, currency, locale)}
                </Text>
              </Trans>
            </Text>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>
                You owe{' '}
                <Text
                  style={[a.text_sm, a.font_semi_bold, t.atoms.text, tabular]}>
                  {formatAmount(owe, currency, locale)}
                </Text>
              </Trans>
            </Text>
          </View>
        )}
      </Link>
    </Animated.View>
  )
}

/** Loading shape of the summary. */
export function BalanceSummaryPlaceholder() {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View>
      <SectionHeader title={l`Balances`} />
      <View style={[a.px_lg, a.pb_md]}>
        <View
          style={[
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_low,
            a.px_lg,
            a.py_md,
            a.gap_sm,
          ]}>
          <Skeleton.Text style={[a.text_sm, {width: 90}]} />
          <Skeleton.Text style={[a.text_3xl, {width: 180}]} />
          <Skeleton.Text style={[a.text_sm, {width: 220}]} />
        </View>
      </View>
    </View>
  )
}
