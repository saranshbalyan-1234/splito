import {useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {groupBalances, pairwiseBalances} from '@splito/domain'
import {
  type Entity,
  type Expense,
  type Group,
  type Person,
  type Repayment,
} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {useEntities, useLedger, useMe} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {SectionHeader} from '#/screens/People/components/SectionHeader'
import {atoms as a, tokens, useBreakpoints, useTheme} from '#/alf'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'
import {BalanceText} from '#/components/BalanceText'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {AddMembersDialog} from '#/components/groups/AddMembersDialog'
import {memberNets} from '#/components/groups/net'
import {RulesEditor} from '#/components/groups/RulesEditor'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {HandCoins_Stroke2_Corner0_Rounded as HandCoinsIcon} from '#/components/icons/Money'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Layout from '#/components/Layout'
import * as Menu from '#/components/Menu'
import {
  HistoryRow,
  HistoryRowPlaceholder,
  MonthHeader,
} from '#/components/people/HistoryRow'
import {
  effectInGroup,
  type HistoryEntry,
  toHistory,
  utcDate,
  withMonths,
} from '#/components/people/ledger'
import {PaymentDetailsDialog} from '#/components/people/PaymentDetailsDialog'
import {Route_Stroke2_Corner0_Rounded as RouteIcon} from '#/components/icons/Route'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {
  CurrencyHeader,
  MemberBalanceRow,
  MemberRow,
} from './components/GroupRows'

type Tab = 'expenses' | 'balances' | 'members' | 'rules'

type Item =
  | {type: 'month'; key: string; month: string}
  | {type: 'entry'; key: string; entry: HistoryEntry}
  | {type: 'currency'; key: string; currency: string}
  | {type: 'net'; key: string; currency: string; personId: string; net: bigint}
  | {type: 'membersHeader'; key: string; count: number}
  | {type: 'member'; key: string; personId: string; hasLeft: boolean}
  | {type: 'rules'; key: string}

const AVATAR_STACK = 5

/**
 * A group, laid out like Bluesky's list page: the header block (avatar,
 * name, kind, dates, members, my balance, actions), then a segmented
 * control over expenses, member balances per currency, members and the
 * "Who you settle with" rules.
 */
export function GroupScreen() {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProp<AllNavigatorParams, 'Group'>>()
  const {groupId} = route.params
  const [tab, setTab] = useState<Tab>(route.params.tab ?? 'expenses')
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const expenses = useEntities<Expense>('expense')
  const repayments = useEntities<Repayment>('repayment')
  const ledger = useLedger()
  const detailsControl = useDialogControl()
  const addMembersControl = useDialogControl()
  const [openRepayment, setOpenRepayment] = useState<Entity<Repayment> | null>(
    null,
  )

  const isLoading =
    !me || !people || !groups || !expenses || !repayments || !ledger
  const group = groups?.find(g => g.id === groupId)

  if (!isLoading && !group) {
    return (
      <Layout.Screen testID="screen-group">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Group</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <EmptyState
          testID="group-not-found"
          message={l`This group isn’t on this device. It may have been removed.`}
          button={{
            label: l`Back to Groups`,
            text: l`Back to Groups`,
            onPress: () => navigation.navigate('Groups'),
            size: 'small',
            color: 'secondary',
          }}
        />
      </Layout.Screen>
    )
  }

  const names = new Map(
    (people ?? []).map(p => [p.id, p.id === me?.id ? l`You` : p.data.name]),
  )
  const history =
    expenses && repayments
      ? toHistory(
          expenses.filter(e => e.data.groupId === groupId),
          repayments.filter(r => r.data.groupId === groupId),
        )
      : []
  const nets = group && ledger ? memberNets(ledger, groupId, group.data) : {}
  const myBalances =
    me && ledger
      ? (groupBalances(pairwiseBalances(ledger, me.id))[groupId] ?? {})
      : {}
  const openCurrencies = Object.keys(myBalances)
    .filter(c => myBalances[c] !== 0n)
    .sort()
  const isSettled = Object.values(nets).every(net =>
    Object.values(net).every(v => v === 0n),
  )
  const members = (group?.data.members ?? [])
    .slice()
    .sort((x, y) =>
      x.personId === me?.id
        ? -1
        : y.personId === me?.id
          ? 1
          : (names.get(x.personId) ?? '').localeCompare(
              names.get(y.personId) ?? '',
            ),
    )

  let items: Item[] = []
  if (!isLoading && group) {
    if (tab === 'expenses') items = withMonths(history)
    else if (tab === 'balances')
      items = Object.entries(nets).flatMap(([currency, net]) => [
        {type: 'currency' as const, key: `cur-${currency}`, currency},
        ...Object.entries(net)
          .sort(([, x], [, y]) => (x === y ? 0 : x > y ? -1 : 1))
          .map(([personId, v]) => ({
            type: 'net' as const,
            key: `net-${currency}-${personId}`,
            currency,
            personId,
            net: v,
          })),
      ])
    else if (tab === 'members')
      items = [
        {
          type: 'membersHeader' as const,
          key: 'members-header',
          count: members.filter(m => m.leftAt === null).length,
        },
        ...members.map(m => ({
          type: 'member' as const,
          key: `member-${m.personId}`,
          personId: m.personId,
          hasLeft: m.leftAt !== null,
        })),
      ]
    else items = [{type: 'rules', key: 'rules'}]
  }

  const kindLabel = group
    ? {trip: l`Trip`, home: l`Home`, couple: l`Couple`, other: l`Group`}[
        group.data.kind
      ]
    : ''
  const {startDate, endDate} = group?.data ?? {}
  const dates =
    startDate && endDate
      ? `${i18n.date(utcDate(startDate), {day: 'numeric', month: 'short', timeZone: 'UTC'})} – ${i18n.date(utcDate(endDate), {day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'})}`
      : null
  const memberCount = members.filter(m => m.leftAt === null).length
  const memberText = memberCount === 1 ? l`1 member` : l`${memberCount} members`
  const byline = [kindLabel, dates, memberText].filter(Boolean).join(' · ')
  const stack = members.filter(m => m.leftAt === null).slice(0, AVATAR_STACK)
  const memberNames = members
    .filter(m => m.leftAt === null)
    .map(m => names.get(m.personId) ?? '')

  const header =
    isLoading || !group ? (
      <Shimmer testID="group-loading">
        <View style={[a.px_lg, a.pt_lg, a.pb_lg, a.gap_md]}>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <Skeleton.Block style={{width: 64, height: 64, borderRadius: 8}} />
            <View style={[a.flex_1, a.gap_xs]}>
              <Skeleton.Text style={[a.text_2xl, {width: 180}]} />
              <Skeleton.Text style={[a.text_md, {width: 240}]} />
            </View>
          </View>
        </View>
      </Shimmer>
    ) : (
      <>
        <View style={[a.px_lg, a.pt_lg, a.pb_md, a.gap_md]}>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <UserAvatar
              size={gtMobile ? 72 : 64}
              name={group.data.name}
              type="list"
            />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text
                emoji
                testID="group-name"
                numberOfLines={2}
                style={[
                  gtMobile ? a.text_3xl : a.text_2xl,
                  a.font_bold,
                  a.leading_tight,
                ]}>
                {group.data.name}
              </Text>
              <Text
                testID="group-byline"
                numberOfLines={2}
                style={[
                  a.text_md,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                {byline}
              </Text>
            </View>
          </View>

          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            <View style={[a.flex_row]}>
              {stack.map((m, i) => (
                <View
                  key={m.personId}
                  style={[
                    a.rounded_full,
                    {
                      marginLeft: i === 0 ? 0 : -6,
                      borderWidth: 2,
                      borderColor: t.atoms.bg.backgroundColor,
                    },
                  ]}>
                  <UserAvatar
                    size={28}
                    name={names.get(m.personId)}
                    type="user"
                    noBorder
                  />
                </View>
              ))}
            </View>
            <Text
              emoji
              numberOfLines={1}
              style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
              {memberNames.join(', ')}
            </Text>
          </View>

          <View style={[a.gap_2xs]}>
            {openCurrencies.length === 0 ? (
              <Text
                testID="group-my-balance"
                style={[
                  a.text_md,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                <Trans>You’re settled up in this group.</Trans>
              </Text>
            ) : (
              openCurrencies.map(currency => (
                <BalanceText
                  key={currency}
                  testID={`group-my-balance-${currency}`}
                  amount={myBalances[currency]!}
                  currency={currency}
                  locale={locale}
                  subject="group"
                  style={[a.text_md]}
                />
              ))
            )}
          </View>

          <View style={[a.flex_row, a.flex_wrap, a.gap_xs]}>
            {gtMobile && (
              <Button
                testID="group-add-expense"
                label={l`Add expense to ${group.data.name}`}
                size="small"
                color="primary"
                onPress={() => navigation.navigate('AddExpense', {groupId})}>
                <ButtonIcon icon={PlusIcon} />
                <ButtonText>
                  <Trans context="action">Add expense</Trans>
                </ButtonText>
              </Button>
            )}
            <Button
              testID="group-settle"
              label={l`Settle up`}
              size="small"
              color={gtMobile ? 'secondary' : 'primary'}
              disabled={isSettled}
              onPress={() => navigation.navigate('Settle', {groupId})}>
              <ButtonIcon icon={HandCoinsIcon} />
              <ButtonText>
                {isSettled ? (
                  <Trans>All settled up</Trans>
                ) : (
                  <Trans>Settle up</Trans>
                )}
              </ButtonText>
            </Button>
          </View>
        </View>

        <View style={[a.px_lg, a.pb_md, {maxWidth: 640 + tokens.space.lg * 2}]}>
          <SegmentedControl.Root
            label={l`Group sections`}
            type="tabs"
            size="small"
            value={tab}
            onChange={setTab}>
            {(
              [
                ['expenses', l`Expenses`],
                ['balances', l`Balances`],
                ['members', l`Members`],
                ['rules', l`Rules`],
              ] as const
            ).map(([value, label]) => (
              <SegmentedControl.Item
                key={value}
                value={value}
                label={label}
                testID={`group-tab-${value}`}>
                <SegmentedControl.ItemText style={[a.text_sm]}>
                  {label}
                </SegmentedControl.ItemText>
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
        </View>
      </>
    )

  const empty = isLoading ? (
    <Shimmer>
      {Array.from({length: 5}, (_, i) => (
        <HistoryRowPlaceholder key={i} />
      ))}
    </Shimmer>
  ) : tab === 'balances' ? (
    <EmptyState
      testID="group-balances-empty"
      icon={null}
      message={l`No balances yet. They appear once the group has an expense.`}
    />
  ) : (
    <EmptyState
      testID="group-expenses-empty"
      illustration="empty-groups"
      message={l`No expenses in this group yet. Add the first one and everyone’s share is worked out for you.`}
      button={
        gtMobile
          ? {
              label: l`Add expense`,
              text: l`Add expense`,
              icon: PlusIcon,
              onPress: () => navigation.navigate('AddExpense', {groupId}),
              size: 'small',
              color: 'secondary',
            }
          : undefined
      }
    />
  )

  return (
    <Layout.Screen testID="screen-group">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            {group?.data.name ?? <Trans>Group</Trans>}
          </Layout.Header.TitleText>
          {group && (
            <Layout.Header.SubtitleText>
              {[kindLabel, memberText].join(' · ')}
            </Layout.Header.SubtitleText>
          )}
        </Layout.Header.Content>
        {/* Settle up and Add expense are the page's own buttons, so the header keeps only the overflow (owner header rule). */}
        {group ? (
          <Menu.Root>
            <Menu.Trigger label={l`More options`}>
              {({props}) => (
                <Layout.Header.Slot>
                  <Button
                    {...props}
                    testID="group-more"
                    label={props.accessibilityLabel}
                    size="small"
                    color="secondary"
                    variant="ghost"
                    shape="round">
                    <ButtonIcon icon={DotsIcon} size="lg" />
                  </Button>
                </Layout.Header.Slot>
              )}
            </Menu.Trigger>
            <Menu.Outer>
              <Menu.Item
                testID="group-menu-members"
                label={l`Members`}
                onPress={() => setTab('members')}>
                <Menu.ItemText>
                  <Trans>Members</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={GroupIcon} position="right" />
              </Menu.Item>
              <Menu.Item
                testID="group-menu-add-members"
                label={l`Add members`}
                onPress={() => addMembersControl.open()}>
                <Menu.ItemText>
                  <Trans>Add members</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={PersonPlusIcon} position="right" />
              </Menu.Item>
              <Menu.Item
                testID="group-menu-rules"
                label={l`Payment rules`}
                onPress={() => setTab('rules')}>
                <Menu.ItemText>
                  <Trans>Payment rules</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={RouteIcon} position="right" />
              </Menu.Item>
            </Menu.Outer>
          </Menu.Root>
        ) : (
          <Layout.Header.Slot />
        )}
      </Layout.Header.Outer>
      <LayoutAnimationConfig skipEntering skipExiting>
        <List
          data={items}
          keyExtractor={(item: Item) => item.key}
          renderItem={({item}: {item: Item}) => {
            switch (item.type) {
              case 'month':
                return <MonthHeader month={item.month} />
              case 'entry':
                return (
                  <HistoryRow
                    entry={item.entry}
                    context="group"
                    effect={effectInGroup(item.entry, me!.id, groupId)}
                    me={me!.id}
                    names={names}
                    locale={locale}
                    onRepaymentPress={r => {
                      setOpenRepayment(r)
                      detailsControl.open()
                    }}
                  />
                )
              case 'currency':
                return <CurrencyHeader currency={item.currency} />
              case 'net':
                return (
                  <MemberBalanceRow
                    name={names.get(item.personId) ?? l`Someone`}
                    isMe={item.personId === me?.id}
                    net={item.net}
                    currency={item.currency}
                    locale={locale}
                  />
                )
              case 'membersHeader':
                return (
                  <SectionHeader
                    title={l`Members`}
                    count={item.count}
                    action={
                      <Button
                        testID="group-add-members"
                        label={l`Add members`}
                        size="small"
                        color="secondary"
                        onPress={() => addMembersControl.open()}>
                        <ButtonIcon icon={PersonPlusIcon} />
                        <ButtonText>
                          <Trans>Add members</Trans>
                        </ButtonText>
                      </Button>
                    }
                  />
                )
              case 'member':
                return (
                  <MemberRow
                    personId={item.personId}
                    name={names.get(item.personId) ?? l`Someone`}
                    isMe={item.personId === me?.id}
                    hasLeft={item.hasLeft}
                  />
                )
              case 'rules':
                return <RulesEditor group={group!} names={names} me={me!.id} />
            }
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={
            !gtMobile ? <View style={{height: 100}} /> : undefined
          }
        />
      </LayoutAnimationConfig>
      <AddExpenseFAB groupId={groupId} />
      {group && <AddMembersDialog control={addMembersControl} group={group} />}
      {me && (
        <PaymentDetailsDialog
          control={detailsControl}
          repayment={openRepayment}
          me={me.id}
          names={names}
          groupName={group?.data.name ?? null}
        />
      )}
    </Layout.Screen>
  )
}
