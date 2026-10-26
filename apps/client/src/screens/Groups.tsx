import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {formatAmount, groupNet} from '@splito/domain'
import {type Entity, type Group} from '@splito/sync'

import {useEntities, useLedger, useMe} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import * as FeedCard from '#/components/FeedCard'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import * as Layout from '#/components/Layout'
import {Text} from '#/components/Typography'

type Row = {group: Entity<Group>; net: ReturnType<typeof groupNet>}

/** Display magnitude of a signed balance; the sign is shown in words. */
function magnitude(v: bigint) {
  return v < 0n ? -v : v
}

/** Groups list: Bluesky's feed/list card rows (square avatar, title, byline). */
export function GroupsScreen() {
  const {t: l, i18n} = useLingui()
  const me = useMe()
  const groups = useEntities<Group>('group')
  const ledger = useLedger()

  const isLoading = !me || !groups || !ledger
  const rows: Row[] = (groups ?? [])
    .filter(g => !g.data.archived)
    .sort((x, y) => x.data.name.localeCompare(y.data.name))
    .map(g => ({group: g, net: ledger ? groupNet(ledger, g.id) : {}}))

  return (
    <Layout.Screen testID="screen-groups">
      <Layout.Header.Outer>
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Groups</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      {isLoading ? null : (
        <List
          data={rows}
          keyExtractor={(row: Row) => row.group.id}
          renderItem={({item, index}: {item: Row; index: number}) => (
            <GroupRow
              row={item}
              meId={me.id}
              index={index}
              locale={i18n.locale}
            />
          )}
          ListEmptyComponent={
            <EmptyState
              icon={GroupIcon}
              message={l`No groups yet. A group keeps a trip's or a flat's balances in one place.`}
            />
          }
        />
      )}
    </Layout.Screen>
  )
}

/* Bluesky's MyLists row wrapper around a ListCard (FeedCard layout). */
function GroupRow({
  row,
  meId,
  index,
  locale,
}: {
  row: Row
  meId: string
  index: number
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {group, net} = row
  const kind = {
    trip: l`Trip`,
    home: l`Home`,
    couple: l`Couple`,
    other: l`Group`,
  }[group.data.kind]
  const memberCount = group.data.members.filter(m => m.leftAt === null).length
  const members =
    memberCount === 1 ? l`1 member` : l`${memberCount} members`
  const currencies = Object.keys(net).sort()

  return (
    <View
      testID={`group-${group.data.name}`}
      style={[
        index !== 0 && a.border_t,
        t.atoms.border_contrast_low,
        a.px_lg,
        a.py_lg,
      ]}>
      <FeedCard.Outer>
        <FeedCard.Header>
          <FeedCard.Avatar name={group.data.name} />
          <FeedCard.TitleAndByline
            title={group.data.name}
            byline={`${kind} · ${members}`}
          />
        </FeedCard.Header>
        <View>
          {currencies.map(currency => {
            const mine = net[currency]?.[meId] ?? 0n
            const amount = formatAmount(magnitude(mine), currency, locale)
            return (
              <Text
                key={currency}
                testID={`group-balance-${currency}`}
                style={[
                  a.leading_snug,
                  mine === 0n
                    ? t.atoms.text_contrast_medium
                    : {
                        color:
                          mine > 0n
                            ? t.palette.positive_600
                            : t.palette.negative_500,
                      },
                ]}>
                {mine > 0n
                  ? l`you are owed ${amount}`
                  : mine < 0n
                    ? l`you owe ${amount}`
                    : l`settled up in ${currency}`}
              </Text>
            )
          })}
        </View>
      </FeedCard.Outer>
    </View>
  )
}
