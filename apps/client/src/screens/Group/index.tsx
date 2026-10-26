import {useEffect, useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
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
import {GroupBalanceCards} from '#/screens/Group/components/GroupBalanceCards'
import {SectionHeader} from '#/screens/People/components/SectionHeader'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {AddMembersDialog} from '#/components/groups/AddMembersDialog'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {memberNets} from '#/components/groups/net'
import {EditGroupDialog} from '#/components/groups/EditGroupDialog'
import {NO_RULES, RulesDialog} from '#/components/groups/RulesEditor'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
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
import {TabBar} from '#/components/TabBar'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {
  CurrencyHeader,
  MemberBalanceRow,
  MemberRow,
  OweRow,
} from './components/GroupRows'
import {planSettlement, ZERO} from '@splito/domain'

type Tab = 'expenses' | 'balances' | 'members'

type Item =
  | {type: 'month'; key: string; month: string}
  | {type: 'entry'; key: string; entry: HistoryEntry}
  | {type: 'currency'; key: string; currency: string}
  | {type: 'net'; key: string; currency: string; personId: string; net: bigint}
  | {type: 'membersHeader'; key: string; count: number}
  | {type: 'member'; key: string; personId: string; hasLeft: boolean}
  | {type: 'owesHeader'; key: string}
  | {
      type: 'owe'
      key: string
      currency: string
      from: string
      to: string
      amount: bigint
    }
  | {type: 'settleCta'; key: string}

const AVATAR_STACK = 3
/* Payment rules open from the overflow menu, so they are not a tab (owner: Expenses / Balances / Members). */
const TABS = ['expenses', 'balances', 'members'] as const
/* The page header's height: the tab bar pins right under it. */
const STICKY_TOP = 52

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
  /* `?tab=rules` (Settle up's "Edit rules") opens the Payment rules sheet over Expenses. */
  const [tab, setTab] = useState<Tab>(
    route.params.tab === 'rules'
      ? 'expenses'
      : (route.params.tab ?? 'expenses'),
  )
  const me = useMe()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const expenses = useEntities<Expense>('expense')
  const repayments = useEntities<Repayment>('repayment')
  const ledger = useLedger()
  const detailsControl = useDialogControl()
  const addMembersControl = useDialogControl()
  const editControl = useDialogControl()
  const rulesControl = useDialogControl()
  const [openRepayment, setOpenRepayment] = useState<Entity<Repayment> | null>(
    null,
  )

  const isLoading =
    !me || !people || !groups || !expenses || !repayments || !ledger
  const wantsRules = route.params.tab === 'rules'
  useEffect(() => {
    if (!wantsRules || isLoading) return
    rulesControl.open()
    navigation.setParams({tab: undefined})
  }, [wantsRules, isLoading, rulesControl, navigation])
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
  // My balance here is my group net, as on the Balances tab and in Settle up.
  const mine: Record<string, bigint> = Object.fromEntries(
    Object.entries(nets).map(([c, net]) => [
      c,
      me ? (net[me.id] ?? ZERO) : ZERO,
    ]),
  )
  const openCurrencies = Object.keys(mine)
    .filter(c => mine[c] !== ZERO)
    .sort()
  const isSettled = Object.values(nets).every(net =>
    Object.values(net).every(v => v === ZERO),
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
    else if (tab === 'balances') {
      /* Who owes whom: the direct settle-up plan under the group's rules, as Settle up shows it. */
      const rules = group.data.rules ?? NO_RULES
      const owes = Object.entries(nets).flatMap(([currency, net]) => {
        if (!Object.values(net).some(v => v !== ZERO)) return []
        const plan = planSettlement(net, rules, 'direct')
        if (plan.status === 'infeasible') return []
        // As Settle up: biggest payments first, then by payer, so the order never depends on member ids.
        return [...plan.transfers]
          .sort(
            (x, y) =>
              Number(y.amount > x.amount) - Number(x.amount > y.amount) ||
              (names.get(x.from) ?? '').localeCompare(names.get(y.from) ?? ''),
          )
          .map(x => ({
            type: 'owe' as const,
            key: `owe-${currency}-${x.from}-${x.to}`,
            currency,
            from: x.from,
            to: x.to,
            amount: x.amount,
          }))
      })
      items = [
        ...Object.entries(nets).flatMap(([currency, net]) => [
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
        ]),
        ...(owes.length > 0
          ? [
              {type: 'owesHeader' as const, key: 'owes-header'},
              ...owes,
              {type: 'settleCta' as const, key: 'settle-cta'},
            ]
          : []),
      ]
    } else
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
  const byline = [kindLabel, memberText].join(' · ')
  const current = members.filter(m => m.leftAt === null)
  /* Bluesky's "followed by" stack: three faces, then +N. */
  const stack = current.slice(0, AVATAR_STACK)
  const moreCount = current.length - stack.length
  const memberNames = current.map(m => names.get(m.personId) ?? '')
  /* The faces' names; the +N chip beside them already counts the rest. */
  const memberSummary = memberNames.slice(0, AVATAR_STACK).join(', ')

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
        {/* The name and kind are the header's title and subtitle; the hero shows who is in it, the dates, then my balance. */}
        <View style={[a.px_lg, a.pt_lg, a.pb_lg, a.gap_lg]}>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <GroupAvatar
              kind={group.data.kind}
              name={group.data.name}
              size={gtMobile ? 64 : 56}
            />
            <View style={[a.flex_1, a.gap_xs]}>
              <View style={[a.flex_row, a.align_center, a.gap_sm]}>
                <View style={[a.flex_row, a.align_center]}>
                  {stack.map((m, i) => (
                    <View
                      key={m.personId}
                      style={[
                        a.rounded_full,
                        {
                          marginLeft: i === 0 ? 0 : -6,
                          borderWidth: 2,
                          borderColor: t.atoms.bg.backgroundColor,
                          zIndex: AVATAR_STACK - i,
                        },
                      ]}>
                      <UserAvatar
                        size={32}
                        name={
                          m.personId === me?.id
                            ? me.data.name
                            : names.get(m.personId)
                        }
                        type="user"
                        noBorder
                      />
                    </View>
                  ))}
                  {moreCount > 0 && (
                    <View
                      style={[
                        a.rounded_full,
                        a.align_center,
                        a.justify_center,
                        t.atoms.bg_contrast_50,
                        {
                          marginLeft: -6,
                          height: 36,
                          minWidth: 36,
                          paddingHorizontal: 6,
                          borderWidth: 2,
                          borderColor: t.atoms.bg.backgroundColor,
                        },
                      ]}>
                      <Text
                        style={[
                          a.text_xs,
                          a.font_semi_bold,
                          t.atoms.text_contrast_medium,
                        ]}>
                        +{moreCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text
                  emoji
                  numberOfLines={1}
                  style={[a.flex_1, a.text_sm, t.atoms.text_contrast_medium]}>
                  {memberSummary}
                </Text>
              </View>
              {dates && (
                <Text
                  testID="group-dates"
                  numberOfLines={1}
                  style={[
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  {dates}
                </Text>
              )}
            </View>
          </View>

          <GroupBalanceCards
            openCurrencies={openCurrencies}
            mine={mine}
            locale={locale}
          />
          {/* Pushed pages have no FAB (owner rule 17); adding here pre-selects the group. */}
          <Button
            testID="group-add-expense"
            label={l({message: 'Add expense', context: 'action'})}
            size="small"
            color="primary"
            style={[a.self_start]}
            onPress={() => navigation.navigate('AddExpense', {groupId})}>
            <ButtonIcon icon={PlusIcon} />
            <ButtonText>
              <Trans context="action">Add expense</Trans>
            </ButtonText>
          </Button>
        </View>

        {/* Bluesky's pager tab bar, pinned under the header while the list scrolls (web). */}
        <View style={[a.z_10, web([a.sticky, {top: STICKY_TOP}])]}>
          <TabBar
            testID="group-tabs"
            selectedPage={TABS.indexOf(tab as (typeof TABS)[number])}
            items={[l`Expenses`, l`Balances`, l`Members`]}
            itemTestIDs={TABS.map(value => `group-tab-${value}`)}
            onSelect={i => setTab(TABS[i]!)}
          />
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
        {/* Balances Settle up and the overflow on the right, so the title stays centred. */}
        <Layout.Header.Slot />
        <Layout.Header.Content>
          <Layout.Header.TitleText testID="group-name">
            {group?.data.name ?? <Trans>Group</Trans>}
          </Layout.Header.TitleText>
          {group ? (
            <Layout.Header.SubtitleText testID="group-byline">
              {byline}
            </Layout.Header.SubtitleText>
          ) : null}
        </Layout.Header.Content>
        {/* Header rule set: Settle up, then the overflow (Edit group, Members, Add members, Payment rules). */}
        <Layout.Header.ActionButton
          testID="group-settle"
          label={l`Settle up`}
          icon={HandCoinsIcon}
          disabled={!group || isSettled}
          hint={isSettled ? l`Everyone is settled up.` : undefined}
          onPress={() => navigation.navigate('Settle', {groupId})}
        />
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
                testID="group-menu-edit"
                label={l`Edit group`}
                onPress={() => editControl.open()}>
                <Menu.ItemText>
                  <Trans>Edit group</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={PencilIcon} position="right" />
              </Menu.Item>
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
                onPress={() => rulesControl.open()}>
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
          renderItem={({item, index}: {item: Item; index: number}) => {
            switch (item.type) {
              case 'month':
                return <MonthHeader month={item.month} />
              case 'entry':
                return (
                  <HistoryRow
                    hideTopBorder={items[index - 1]?.type === 'month'}
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
                    avatarName={
                      item.personId === me?.id ? me.data.name : undefined
                    }
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
                    avatarName={
                      item.personId === me?.id ? me.data.name : undefined
                    }
                    isMe={item.personId === me?.id}
                    hasLeft={item.hasLeft}
                  />
                )
              case 'owesHeader':
                return (
                  <SectionHeader
                    testID="group-owes-title"
                    title={l`Who owes whom`}
                  />
                )
              case 'owe': {
                const from = names.get(item.from) ?? l`Someone`
                const to = names.get(item.to) ?? l`Someone`
                return (
                  <OweRow
                    testID={`group-owe-${from}-${to}`}
                    sentence={
                      item.from === me?.id
                        ? l`You owe ${to}`
                        : item.to === me?.id
                          ? l`${from} owes you`
                          : l`${from} owes ${to}`
                    }
                    avatarName={
                      item.from === me?.id ? (me?.data.name ?? from) : from
                    }
                    amount={item.amount}
                    currency={item.currency}
                    locale={locale}
                  />
                )
              }
              case 'settleCta':
                return (
                  <View
                    style={[
                      a.px_lg,
                      a.py_lg,
                      a.border_t,
                      t.atoms.border_contrast_low,
                    ]}>
                    <Button
                      testID="group-balances-settle"
                      label={l`Settle up`}
                      size="large"
                      color="primary"
                      style={[a.self_start]}
                      onPress={() => navigation.navigate('Settle', {groupId})}>
                      <ButtonIcon icon={HandCoinsIcon} />
                      <ButtonText>
                        <Trans>Settle up</Trans>
                      </ButtonText>
                    </Button>
                  </View>
                )
            }
          }}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
        />
      </LayoutAnimationConfig>
      {group && <AddMembersDialog control={addMembersControl} group={group} />}
      {group && <EditGroupDialog control={editControl} group={group} />}
      {group && me && (
        <RulesDialog
          control={rulesControl}
          group={group}
          names={names}
          me={me.id}
        />
      )}
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
