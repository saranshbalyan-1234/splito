import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {
  type BalanceRow,
  formatAmount,
  pairwiseBalances,
  type PersonSummary,
  personSummary,
} from '@splito/domain'
import {type Group, type Person} from '@splito/sync'

import {type NavigationProp} from '#/lib/routes/types'
import {useEntities, useLedger, useMe} from '#/data/hooks'
import {HomeHeaderLayout} from '#/view/com/home/HomeHeaderLayout'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Person_Stroke2_Corner2_Rounded as PersonIcon} from '#/components/icons/Person'
import * as Layout from '#/components/Layout'
import * as Pills from '#/components/Pills'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'

type Row = {id: string; name: string; summary: PersonSummary | undefined}

/** Display magnitude of a signed balance; the sign is shown in words ("owes you" / "you owe"). */
function magnitude(v: bigint) {
  return v < 0n ? -v : v
}

/**
 * Overall totals per currency: what friends owe you and what you owe them.
 * ponytail: sums via `personSummary` by re-keying each friend's total as
 * "owed"/"owe", because the domain has no totals helper yet; add one there
 * when another screen needs it.
 */
function overallTotals(people: PersonSummary[]) {
  const rows: BalanceRow[] = people.flatMap(p =>
    Object.entries(p.byCurrency).map(([currency, c]) => ({
      person: c.total > 0n ? 'owed' : 'owe',
      groupId: null,
      currency,
      amount: c.total,
    })),
  )
  const byKey = new Map(
    personSummary(rows, {includeGroups: true}).map(s => [s.person, s]),
  )
  const currencies = [...new Set(rows.map(r => r.currency))].sort()
  return currencies.map(currency => ({
    currency,
    owed: byKey.get('owed')?.byCurrency[currency]?.total,
    owe: byKey.get('owe')?.byCurrency[currency]?.total,
  }))
}

/** Home: one row per friend with their balance per currency. No page title, by spec. */
export function PeopleScreen() {
  const {t: l, i18n} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const ledger = useLedger()

  const isLoading = !me || !people || !groups || !ledger
  const summaries =
    me && ledger
      ? personSummary(pairwiseBalances(ledger, me.id), {includeGroups: true})
      : []
  const byPerson = new Map(summaries.map(s => [s.person, s]))
  const groupNames = new Map((groups ?? []).map(g => [g.id, g.data.name]))
  const rows: Row[] = (people ?? [])
    .filter(p => !p.data.isMe)
    .map(p => ({id: p.id, name: p.data.name, summary: byPerson.get(p.id)}))
    .sort((x, y) => x.name.localeCompare(y.name))

  return (
    <Layout.Screen testID="screen-people">
      <HomeHeaderLayout tabBarAnchor={null}>{null}</HomeHeaderLayout>
      {isLoading ? null : (
        <List
          data={rows}
          keyExtractor={(row: Row) => row.id}
          renderItem={({item}: {item: Row}) => (
            <PersonRow row={item} groupNames={groupNames} locale={i18n.locale} />
          )}
          ListHeaderComponent={
            summaries.length > 0 ? (
              <Summary totals={overallTotals(summaries)} locale={i18n.locale} />
            ) : undefined
          }
          ListEmptyComponent={
            <EmptyState
              icon={PersonIcon}
              message={l`Split anything with anyone. Add an expense to start - friends don't need the app.`}
              button={{
                label: l`Add expense`,
                text: l`Add expense`,
                onPress: () => navigation.navigate('AddExpense', {}),
                size: 'large',
                color: 'primary',
              }}
            />
          }
        />
      )}
    </Layout.Screen>
  )
}

/* Bluesky's profile-header metrics typography (bold figure, medium-contrast label). */
function Summary({
  totals,
  locale,
}: {
  totals: ReturnType<typeof overallTotals>
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View testID="people-summary" style={[a.px_xl, a.pt_md, a.pb_lg, a.gap_xs]}>
      {totals.map(({currency, owed, owe}) => (
        <View
          key={currency}
          testID={`summary-${currency}`}
          style={[a.flex_row, a.flex_wrap, a.gap_sm, a.align_center]}>
          {owed !== undefined && (
            <Text style={[a.text_md]}>
              <Text
                style={[
                  a.font_semi_bold,
                  a.text_md,
                  {color: t.palette.positive_600},
                ]}>
                {formatAmount(owed, currency, locale)}{' '}
              </Text>
              <Text style={[t.atoms.text_contrast_medium, a.text_md]}>
                {l`owed to you`}
              </Text>
            </Text>
          )}
          {owe !== undefined && (
            <Text style={[a.text_md]}>
              <Text
                style={[
                  a.font_semi_bold,
                  a.text_md,
                  {color: t.palette.negative_500},
                ]}>
                {formatAmount(magnitude(owe), currency, locale)}{' '}
              </Text>
              <Text style={[t.atoms.text_contrast_medium, a.text_md]}>
                {l`you owe`}
              </Text>
            </Text>
          )}
        </View>
      ))}
    </View>
  )
}

/* Bluesky's ProfileCardWithFollowBtn row: avatar, name, secondary line, then pills. */
function PersonRow({
  row,
  groupNames,
  locale,
}: {
  row: Row
  groupNames: Map<string, string>
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const currencies = Object.keys(row.summary?.byCurrency ?? {}).sort()
  const chips = currencies.flatMap(currency => {
    const c = row.summary!.byCurrency[currency]!
    const groupEntries = Object.entries(c.groups)
      .map(([groupId, v]) => ({groupId, name: groupNames.get(groupId) ?? l`Group`, v}))
      .sort((x, y) => x.name.localeCompare(y.name))
    if (groupEntries.length === 0) return []
    return [
      ...(c.direct !== 0n
        ? [{key: `${currency}-direct`, text: l`Direct: ${formatAmount(c.direct, currency, locale)}`}]
        : []),
      ...groupEntries.map(({groupId, name, v}) => ({
        key: `${currency}-${groupId}`,
        text: `${name}: ${formatAmount(v, currency, locale)}`,
      })),
    ]
  })

  return (
    <View
      testID={`person-${row.name}`}
      style={[a.py_md, a.px_xl, a.border_t, t.atoms.border_contrast_low]}>
      <ProfileCard.Outer>
        <ProfileCard.Header>
          <ProfileCard.Avatar profile={row} />
          <ProfileCard.NameAndHandle
            profile={row}
            handle={
              currencies.length === 0 ? (
                <ProfileCard.Handle text={l`settled up`} />
              ) : (
                currencies.map(currency => {
                  const total = row.summary!.byCurrency[currency]!.total
                  const amount = formatAmount(magnitude(total), currency, locale)
                  return (
                    <View key={currency} testID={`balance-${currency}`}>
                      <ProfileCard.Handle
                        text={total > 0n ? l`owes you ${amount}` : l`you owe ${amount}`}
                        textStyle={{
                          color:
                            total > 0n
                              ? t.palette.positive_600
                              : t.palette.negative_500,
                        }}
                      />
                    </View>
                  )
                })
              )
            }
          />
        </ProfileCard.Header>
        {chips.length > 0 && (
          <Pills.Row style={[a.pt_xs]}>
            {chips.map(chip => (
              <Pills.Tag key={chip.key}>{chip.text}</Pills.Tag>
            ))}
          </Pills.Row>
        )}
      </ProfileCard.Outer>
    </View>
  )
}
