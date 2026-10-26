// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/Feeds.tsx (row + "More feeds" link styling)
import {useMemo} from 'react'
import {View} from 'react-native'
import {utils} from '@bsky.app/alf'
import {formatAmountCompact, magnitude, personNet, repaymentFlow, ZERO} from '@splito/domain'
import {type Expense, type Repayment} from '@splito/sync'
import {Trans, useLingui} from '@lingui/react/macro'

import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useMe} from '#/data/hooks'
import {Link} from '#/view/com/util/Link'
import {atoms as a, useTheme} from '#/alf'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {CategoryTile, useCategories} from '#/components/split/shared'
import {Text} from '#/components/Typography'

const RECENT = 5

type Row = {
  id: string
  href: string
  title: string
  category: string | null
  currency: string
  /** > 0 you lent / were paid, < 0 you borrowed / paid. */
  net: bigint
  date: string
  updatedAt: number
}

/** The sidebar's last transactions that involve me, newest first. */
export function RecentTransactions() {
  const t = useTheme()
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const me = useMe()
  const expenses = useEntities<Expense>('expense')
  const repayments = useEntities<Repayment>('repayment')
  const categories = useCategories()

  const rows = useMemo<Row[]>(() => {
    if (!me || !expenses) return []
    const out: Row[] = []
    for (const e of expenses) {
      const net = personNet(e.data, me.id)
      const involved = me.id in e.data.payers || me.id in e.data.shares
      if (!involved) continue
      out.push({id: e.id, href: `/expense/${e.id}`, title: e.data.title, category: e.data.category, currency: e.data.currency, net, date: e.data.date, updatedAt: e.updatedAt})
    }
    for (const r of repayments ?? []) {
      if (r.data.from !== me.id && r.data.to !== me.id) continue
      const net = repaymentFlow(r.data, me.id)
      out.push({id: r.id, href: '/activity', title: r.data.from === me.id ? l`You paid` : l`You got paid`, category: null, currency: r.data.currency, net, date: r.data.date, updatedAt: r.updatedAt})
    }
    return out
      .sort((x, y) => (x.date === y.date ? y.updatedAt - x.updatedAt : x.date < y.date ? 1 : -1))
      .slice(0, RECENT)
  }, [me, expenses, repayments, l])

  if (rows.length === 0) return null

  return (
    <View testID="sidebar-recent-transactions" style={[a.pt_2xl, {gap: 2}]}>
      <Text style={[a.px_md, a.pb_xs, a.text_sm, a.font_semi_bold, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>Recent transactions</Trans>
      </Text>
      {rows.map(row => {
        const category = row.category ? categories.find(c => c.id === row.category) : undefined
        const positive = row.net > ZERO
        const color = row.net === ZERO ? t.atoms.text_contrast_medium.color : positive ? t.palette.positive_600 : t.palette.negative_500
        return (
          <Link
            key={row.id}
            testID={`sidebar-transaction-${row.id}`}
            href={row.href}
            asAnchor
            anchorNoUnderline
            accessibilityLabel={row.title}
            accessibilityHint=""
            hoverStyle={t.atoms.bg_contrast_25}
            style={[a.flex_row, a.align_center, a.gap_sm, a.rounded_sm, a.transition_color, a.px_md, {paddingVertical: 6}]}>
            {category ? (
              <CategoryTile category={category} size={24} />
            ) : (
              <View style={[a.rounded_xs, t.atoms.bg_contrast_50, {width: 24, height: 24}]} />
            )}
            <Text emoji numberOfLines={1} style={[a.flex_1, a.text_md, a.leading_snug, t.atoms.text]}>
              {row.title}
            </Text>
            {row.net !== ZERO && (
              <Text
                numberOfLines={1}
                style={[
                  a.text_xs,
                  a.font_semi_bold,
                  a.rounded_full,
                  {color, backgroundColor: utils.alpha(color, t.scheme === 'light' ? 0.1 : 0.18), paddingHorizontal: 6, paddingVertical: 2, fontVariant: ['tabular-nums']},
                ]}>
                {(positive ? '+' : '−') + formatAmountCompact(magnitude(row.net), row.currency, locale)}
              </Text>
            )}
          </Link>
        )
      })}
      <Link
        testID="sidebar-transactions-all"
        href="/activity"
        navigationAction="navigate"
        accessibilityLabel={l`See all activity`}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[a.flex_row, a.align_center, a.gap_sm, a.self_start, a.rounded_sm, a.transition_color, a.px_md, {paddingVertical: 6}]}>
        <View style={[a.align_center, a.justify_center, a.rounded_xs, t.atoms.bg_contrast_50, {width: 24, height: 24}]}>
          <ChevronRightIcon style={{width: 16, height: 16}} fill={t.atoms.text_contrast_medium.color} />
        </View>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>See all</Trans>
        </Text>
      </Link>
    </View>
  )
}
