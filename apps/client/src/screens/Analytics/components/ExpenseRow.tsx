import {View} from 'react-native'
import Animated from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, type ReportExpense} from '@splito/domain'

import {Link} from '#/view/com/util/Link'
import {atoms as a, useTheme} from '#/alf'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'
import {usePressScale} from '#/motion/PressableScale'
import {CategoryIcon} from '#/screens/Analytics/components/CategoryIcon'
import {utcDate} from '#/screens/Analytics/useReport'

const tabular = {fontVariant: ['tabular-nums' as const]}

/**
 * One expense behind the numbers, in Bluesky's row shape: category glyph,
 * title, date and group, and on the right the share being counted (yours,
 * or the selected person's) over the expense total. Opens the expense.
 */
export function ExpenseRow({
  expense,
  shareOf,
  shareLabel,
  category,
  groupName,
  locale,
}: {
  expense: ReportExpense
  shareOf: string
  shareLabel: string
  category: {name: string; color: string; icon: string}
  groupName: string | null
  locale: string
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const listAnimations = useListAnimations()
  const press = usePressScale()
  const share = expense.shares[shareOf] ?? 0n
  const title = expense.title || l`Expense`
  const date = i18n.date(utcDate(expense.date), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const byline = [date, groupName, category.name].filter(Boolean).join(' · ')
  const shareText = formatAmount(share, expense.currency, locale)
  const totalText = formatAmount(expense.total, expense.currency, locale)

  return (
    <Animated.View {...listAnimations}>
      <Link
        testID={`analytics-expense-${title}`}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        href={`/expense/${expense.id}`}
        asAnchor
        anchorNoUnderline
        accessibilityLabel={l`${title}, ${byline}, ${shareLabel} ${shareText} of ${totalText}`}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.px_lg,
          a.py_md,
          a.border_t,
          t.atoms.border_contrast_low,
          a.transition_color,
        ]}>
        <Animated.View
          style={[a.flex_row, a.align_center, a.gap_md, press.style]}>
          <CategoryIcon icon={category.icon} color={category.color} />
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text
              numberOfLines={1}
              style={[a.text_md, a.font_semi_bold, a.leading_snug]}>
              {title}
            </Text>
            <Text
              numberOfLines={1}
              style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {byline}
            </Text>
          </View>
          <View style={[a.align_end, a.gap_2xs, a.flex_shrink_0]}>
            <Text
              testID="analytics-expense-share"
              style={[a.text_md, a.font_semi_bold, a.leading_snug, tabular]}>
              {shareText}
            </Text>
            <Text
              style={[
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_medium,
                tabular,
              ]}>
              <Trans>of {totalText}</Trans>
            </Text>
          </View>
        </Animated.View>
      </Link>
    </Animated.View>
  )
}

/** Loading shape of one row. */
export function ExpenseRowPlaceholder() {
  const t = useTheme()
  return (
    <View
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_lg,
        a.py_md,
        a.border_t,
        t.atoms.border_contrast_low,
      ]}>
      <Skeleton.Circle size={40} />
      <View style={[a.flex_1, a.gap_xs]}>
        <Skeleton.Text style={[a.text_md, {width: 160}]} />
        <Skeleton.Text style={[a.text_sm, {width: 220}]} />
      </View>
      <View style={[a.align_end, a.gap_xs, {width: 96}]}>
        <Skeleton.Text style={[a.text_md, {width: 80}]} />
        <Skeleton.Text style={[a.text_sm, {width: 64}]} />
      </View>
    </View>
  )
}
