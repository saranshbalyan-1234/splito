// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/view/shell/desktop/Feeds.tsx (row + "More feeds" link styling)
import {View} from 'react-native'
import {utils} from '@bsky.app/alf'
import {formatAmount, magnitude, ZERO} from '@splito/domain'
import {Trans, useLingui} from '@lingui/react/macro'

import {useNumberLocale} from '#/locale/numberLocale'
import {useRecentRows} from '#/data/recentTransactionRows'
import {seeAllTransactionsPath} from '#/lib/links/make'
import {ActivityLink} from '#/components/ActivityLink'
import {Link} from '#/view/com/util/Link'
import {atoms as a, useTheme} from '#/alf'
import {ChevronRight_Stroke2_Corner0_Rounded as ChevronRightIcon} from '#/components/icons/Chevron'
import {CategoryTile, useCategories} from '#/components/split/shared'
import {Text} from '#/components/Typography'
import {useMoneyStyle} from '#/components/MoneyDirection'
import {SyncToned} from '#/components/SyncTone'

const RECENT = 5

/** The sidebar's last transactions that involve me, newest first. */
export function RecentTransactions() {
  const t = useTheme()
  const money = useMoneyStyle()
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const rows = useRecentRows(RECENT)
  const categories = useCategories()

  if (rows.length === 0) return null

  return (
    <View testID="sidebar-recent-transactions" style={[a.pt_2xl, {gap: 2}]}>
      <ActivityLink testID="sidebar-transactions-title" href={seeAllTransactionsPath()} label={l`See all transactions`} style={[a.px_md]}>
        <Text style={[a.text_sm, a.font_semi_bold, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Recent transactions</Trans>
        </Text>
      </ActivityLink>
      {rows.map(row => {
        const category = row.category
          ? categories.find(c => c.id === row.category)
          : undefined
        const positive = row.net > ZERO
        const color =
          row.net === ZERO
            ? t.atoms.text_contrast_medium.color
            : money.color(row.net)
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
            style={[
              a.flex_row,
              a.align_center,
              a.gap_sm,
              a.rounded_sm,
              a.transition_color,
              a.px_md,
              {paddingVertical: 6},
            ]}>
            <SyncToned status={row.syncStatus} style={[a.flex_1, a.flex_row, a.align_center, a.gap_sm]}>
            {category ? (
              <CategoryTile category={category} size={24} />
            ) : (
              <View
                style={[
                  a.rounded_xs,
                  t.atoms.bg_contrast_50,
                  {width: 24, height: 24},
                ]}
              />
            )}
            <Text
              emoji
              numberOfLines={1}
              style={[a.flex_1, a.text_md, a.leading_snug, t.atoms.text]}>
              {row.title}
            </Text>
            {row.net !== ZERO && (
              <Text
                numberOfLines={1}
                style={[
                  a.text_xs,
                  a.font_semi_bold,
                  a.rounded_full,
                  {
                    color,
                    backgroundColor: utils.alpha(
                      color,
                      t.scheme === 'light' ? 0.1 : 0.18,
                    ),
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    fontVariant: ['tabular-nums'],
                  },
                ]}>
                {(positive ? '+' : '−') +
                  formatAmount(magnitude(row.net), row.currency, locale)}
              </Text>
            )}
            </SyncToned>
          </Link>
        )
      })}
      <Link
        testID="sidebar-transactions-all"
        href={seeAllTransactionsPath()}
        navigationAction="push"
        accessibilityLabel={l`See all transactions`}
        accessibilityHint=""
        hoverStyle={t.atoms.bg_contrast_25}
        style={[
          a.flex_row,
          a.align_center,
          a.gap_sm,
          a.self_start,
          a.rounded_sm,
          a.transition_color,
          a.px_md,
          {paddingVertical: 6},
        ]}>
        <View
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_xs,
            t.atoms.bg_contrast_50,
            {width: 24, height: 24},
          ]}>
          <ChevronRightIcon
            style={{width: 16, height: 16}}
            fill={t.atoms.text_contrast_medium.color}
          />
        </View>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>See all</Trans>
        </Text>
      </Link>
    </View>
  )
}
