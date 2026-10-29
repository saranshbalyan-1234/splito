import {useDeferredValue, useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {
  type Entity,
  type Group,
  groupAdmins,
  isGroupInactive,
  type Person,
  type Repayment,
  type WriteOff,
} from '@splito/sync'

import {useDeferredReady} from '#/lib/hooks/useAfterTransition'
import {usePagedRows} from '#/lib/hooks/usePagedRows'
import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {
  useAllEntities,
  useGroupHistory,
  useGroupNets,
  useMe,
} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {useFormatDay} from '#/locale/useDates'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {GroupBalanceCards} from '#/screens/Group/components/GroupBalanceCards'
import {SectionHeader} from '#/screens/People/components/SectionHeader'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useBreakpoints, useTheme, web} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {ExportMenuItem, useExportSheet} from '#/features/export/ExportSheet'
import {AddMembersDialog} from '#/components/groups/AddMembersDialog'
import {GroupAvatar} from '#/components/groups/GroupAvatar'
import {EditGroupDialog} from '#/components/groups/EditGroupDialog'
import {NO_RULES, RulesDialog} from '#/components/groups/RulesEditor'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as FilterIcon} from '#/components/icons/SettingsSlider'
import {historyRowHide, ShowHiddenSheet, useVisibleEntries} from '#/features/hidden/ShowHidden'
import {historyRowMenu} from '#/features/disputes/RowMenu'
import {markOf, useDisputedBalances, useOpenDisputes} from '#/state/disputes'
import {useHideItem} from '#/features/hidden/HideItem'
import {Group3_Stroke2_Corner0_Rounded as GroupIcon} from '#/components/icons/Group'
import {Handshake_Stroke2_Corner0_Rounded as HandCoinsIcon} from '#/components/icons/Money'
import {PersonPlus_Filled_Stroke2_Corner0_Rounded as PersonPlusIcon} from '#/components/icons/Person'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Admonition from '#/components/Admonition'
import {QrCode_Stroke2_Corner0_Rounded as QrIcon} from '#/components/icons/Invite'
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
  withMonths,
} from '#/components/people/ledger'
import {
  CallItEvenDialog,
  type EvenDraft,
} from '#/features/settlement/CallItEvenDialog'
import {PaymentDetailsDialog} from '#/components/people/PaymentDetailsDialog'
import {Route_Stroke2_Corner0_Rounded as RouteIcon} from '#/components/icons/Route'
import * as Skeleton from '#/components/Skeleton'
import {TabBar} from '#/components/TabBar'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {
  DeletedGroupItems,
  GroupDeletedBanner,
  GroupLifecycleDialogs,
  GroupLifecycleItems,
  GroupNotices,
  useGroupLifecycle,
} from './components/GroupLifecycle'
import {
  CurrencyHeader,
  MemberBalanceRow,
  MemberRow,
  OweRow,
} from './components/GroupRows'
import {
  compareMinor,
  directPlan,
  magnitude,
  zeroFillNets,
  ZERO,
  disputedInGroup,
} from '@splito/domain'

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
  | {type: 'settleCta'; key: string; payments: number}
  | {type: 'outsideRules'; key: string; currencies: string[]}

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
  const {t: l} = useLingui()
  const formatDay = useFormatDay()
  const {gtMobile} = useBreakpoints()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<RouteProp<AllNavigatorParams, 'Group'>>()
  const {groupId} = route.params
  /*
   * The tab is the address (`/groups/:id/balances`, F-241): written on a tap, read from the route. The old
   * `?tab=rules` link is the Payment rules sheet now (the resolver maps it).
   */
  const tab: Tab = route.params.tab && TABS.includes(route.params.tab as Tab) ? (route.params.tab as Tab) : 'expenses'
  const setTab = (next: Tab) => navigation.setParams({tab: next === 'expenses' ? undefined : next})
  /* The tab bar follows the tap at once; the list behind it re-renders as a transition (owner 151). */
  const bodyTab = useDeferredValue(tab)
  const me = useMe()
  /* Removed friends too: the records still name them. */
  const people = useAllEntities<Person>('person')
  /* Tombstones too: a deleted group still opens, read-only (decision 103). */
  const groups = useAllEntities<Group>('group')
  /* The group's net per currency and person (stored sums) and its expenses and payments, a page at a time (by index). */
  const storedNets = useGroupNets(groupId)
  const groupHistory = useGroupHistory(groupId)
  const detailsControl = useDialogControl()
  const filterControl = useDialogControl({url: 'filters'})
  /* "Disputed only" (F-1210): this page's own choice, not remembered. ponytail: not in the address yet. */
  const [onlyDisputed, setOnlyDisputed] = useState(false)
  const openDisputes = useOpenDisputes()
  const disputedRows = useDisputedBalances({groupId})
  const addMembersControl = useDialogControl({url: 'add-members'})
  const editControl = useDialogControl({url: 'edit'})
  const rulesControl = useDialogControl({url: 'rules'})
  const lifecycle = useGroupLifecycle()
  const exportSheet = useExportSheet({groupId})
  const [openRepayment, setOpenRepayment] = useState<Entity<
    Repayment | WriteOff
  > | null>(null)
  const [openKind, setOpenKind] = useState<'repayment' | 'writeoff'>(
    'repayment',
  )
  const evenControl = useDialogControl()
  const [evenDraft, setEvenDraft] = useState<EvenDraft | null>(null)
  const openHide = useHideItem({type: openKind, id: openRepayment?.id ?? ''})

  /* The header paints at once; the rows mount a frame later as a transition, and only missing data shows a skeleton (owners 151/152). */
  const isLoading = !me || !people || !groups || !storedNets || !groupHistory
  const rowsReady = useDeferredReady(!isLoading)
  const group = groups?.find(g => g.id === groupId)
  const isDeleted = !!group?.deleted
  const isMeAdmin = !!group && !!me && groupAdmins(group.data).includes(me.id)
  /* Deleted records stay in their date place, struck; the ones I hid are out unless "Show hidden" is on. */
  const {visible, hidden, showHidden} = useVisibleEntries(groupHistory?.entries ?? [])

  const pageOf = usePagedRows(bodyTab)
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
          illustration="empty-groups"
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
  const history = onlyDisputed ? visible.filter(e => markOf(openDisputes, e.kind, e.entity.id) !== undefined) : visible
  /* Every member listed, zero when they have no records yet, so a settlement plan can route through them. */
  const nets =
    group && storedNets
      ? zeroFillNets(
          storedNets,
          group.data.members.map(m => m.personId),
        )
      : {}
  // My balance here is my group net, as on the Balances tab and in Settle up.
  const mine: Record<string, bigint> = Object.fromEntries(
    Object.entries(nets).map(([c, net]) => [
      c,
      me ? (net[me.id] ?? ZERO) : ZERO,
    ]),
  )
  const groupDisputed = disputedInGroup(disputedRows, me?.id ?? '', mine)
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
    if (bodyTab === 'expenses') items = withMonths(history)
    else if (bodyTab === 'balances') {
      /*
       * Who owes whom: the group's settle-up plan (`directPlan`), as Settle
       * up and People show it. When the rules leave no plan it goes outside
       * them, and the tab says so (audit M11).
       */
      const rules = group.data.rules ?? NO_RULES
      const outside: string[] = []
      const owes = Object.entries(nets).flatMap(([currency, net]) => {
        if (!Object.values(net).some(v => v !== ZERO)) return []
        const plan = directPlan(net, rules)
        if (plan.stuck.length > 0) outside.push(currency)
        // As Settle up: biggest payments first, then by payer, so the order never depends on member ids.
        return [...plan.transfers]
          .sort(
            (x, y) =>
              compareMinor(y.amount, x.amount) ||
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
        /* Settle up leads the tab, so its one action is never below the fold. */
        ...(owes.length > 0
          ? [
              {
                type: 'settleCta' as const,
                key: 'settle-cta',
                payments: owes.length,
              },
            ]
          : []),
        ...(outside.length > 0
          ? [
              {
                type: 'outsideRules' as const,
                key: 'outside-rules',
                currencies: outside,
              },
            ]
          : []),
        ...Object.entries(nets).flatMap(([currency, net]) => [
          {type: 'currency' as const, key: `cur-${currency}`, currency},
          ...Object.entries(net)
            /* Who is owed first, then who owes; each largest first. */
            .sort(
              ([, x], [, y]) =>
                Number(y > ZERO) - Number(x > ZERO) ||
                Number(magnitude(y) > magnitude(x)) -
                  Number(magnitude(x) > magnitude(y)),
            )
            .map(([personId, v]) => ({
              type: 'net' as const,
              key: `net-${currency}-${personId}`,
              currency,
              personId,
              net: v,
            })),
        ]),
        ...(owes.length > 0
          ? [{type: 'owesHeader' as const, key: 'owes-header'}, ...owes]
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
      ? `${formatDay(startDate, {intl: {day: 'numeric', month: 'short'}})} – ${formatDay(endDate, {intl: {day: 'numeric', month: 'short', year: 'numeric'}})}`
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
          {/* Bluesky's profile header: the avatar on the left, the page's action on the right. */}
          <View
            style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
            <GroupAvatar
              kind={group.data.kind}
              name={group.data.name}
              size={gtMobile ? 64 : 56}
            />
            {/* Pushed pages have no FAB (owner rule); adding here pre-selects the group. */}
            {/* An inactive group takes no new expenses: its notice below says how to reopen it (decision 89). */}
            {isGroupInactive(group.data) || isDeleted ? null : (
              <Button
                testID="group-add-expense"
                label={l({message: 'Add expense', context: 'action'})}
                size="small"
                color="primary"
                onPress={() => navigation.navigate('AddExpense', {groupId})}>
                <ButtonIcon icon={PlusIcon} />
                <ButtonText>
                  <Trans context="action">Add expense</Trans>
                </ButtonText>
              </Button>
            )}
          </View>
          <View style={[a.gap_xs]}>
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
          {isDeleted && me ? <GroupDeletedBanner group={group} me={me.id} /> : me ? <GroupNotices group={group} me={me.id} /> : null}
          <GroupBalanceCards
            openCurrencies={openCurrencies}
            mine={mine}
            locale={locale}
            disputed={groupDisputed.mine}
          />
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
        {bodyTab === 'expenses' ? (
          <SectionHeader
            title={l`Expenses`}
            testID="group-expenses-title"
            action={
              <Button
                testID="group-filter"
                label={l`Filter`}
                size="small"
                color="secondary"
                onPress={() => filterControl.open()}>
                <ButtonIcon icon={FilterIcon} />
                <ButtonText>
                  <Trans>Filter</Trans>
                </ButtonText>
                {onlyDisputed ? (
                  <Text testID="group-filter-disputed" style={[a.text_sm, a.font_semi_bold]}>
                    {' · '}
                    <Trans>Disputed only</Trans>
                  </Text>
                ) : null}
                {showHidden ? (
                  <Text testID="group-filter-active" style={[a.text_sm, a.font_semi_bold]}>
                    {' · '}
                    <Trans>Hidden shown</Trans>
                  </Text>
                ) : null}
              </Button>
            }
          />
        ) : null}
      </>
    )

  const empty = isLoading ? (
    <Shimmer testID="group-history-loading">
      {Array.from({length: 5}, (_, i) => (
        <HistoryRowPlaceholder key={i} />
      ))}
    </Shimmer>
  ) : !rowsReady ? <></> : bodyTab === 'balances' ? (
    <EmptyState
      testID="group-balances-empty"
      illustration="empty-groups"
      message={l`No balances yet. They appear once the group has an expense.`}
    />
  ) : (
    <EmptyState
      testID="group-expenses-empty"
      illustration="empty-groups"
      message={l`No expenses in this group yet. Add the first one and everyone’s share is worked out for you.`}
      button={
        gtMobile && !(group && isGroupInactive(group.data))
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

  const {shown, onEndReached: showMore} = pageOf(items)
  /* Expenses page by index (the next page is read as the end comes near); the other tabs hold few rows. */
  const onEndReached = () => {
    if (bodyTab !== 'expenses') showMore()
    else if (groupHistory && !groupHistory.isDone) groupHistory.loadMore()
  }

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
          disabled={!group || isSettled || isDeleted}
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
              {isDeleted ? (
                me ? <DeletedGroupItems group={group} me={me.id} /> : null
              ) : (
                <>
              <Menu.Item
                testID="group-menu-edit"
                label={l`Edit group`}
                onPress={() => editControl.open()}>
                <Menu.ItemText>
                  <Trans>Edit group</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={PencilIcon} position="right" />
              </Menu.Item>
              <ExportMenuItem testID="group-menu-export" label={l`Export`} onPress={exportSheet.open} />
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
              {me && <GroupLifecycleItems lifecycle={lifecycle} group={group} me={me.id} nets={nets} />}
                </>
              )}
            </Menu.Outer>
          </Menu.Root>
        ) : (
          <Layout.Header.Slot />
        )}
      </Layout.Header.Outer>
      <LayoutAnimationConfig skipEntering skipExiting>
        <List
          data={rowsReady ? (bodyTab === 'expenses' ? items : shown) : []}
          onEndReached={onEndReached}
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
                    hide={historyRowHide(item.entry, hidden, l`this record`)}
                    rowMenu={historyRowMenu(item.entry, l`this record`)}
                    mark={markOf(openDisputes, item.entry.kind, item.entry.entity.id)}
                    onRepaymentPress={(r, kind) => {
                      setOpenRepayment(r)
                      setOpenKind(kind)
                      detailsControl.open()
                    }}
                  />
                )
              case 'currency':
                return <CurrencyHeader currency={item.currency} disputed={groupDisputed.total[item.currency]} />
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
                      isDeleted ? undefined : (
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
                      )
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
                    isAdmin={!!group && groupAdmins(group.data).includes(item.personId)}
                    /* Anyone may leave; only an admin removes somebody else. */
                    onExitPressed={
                      !isDeleted && (item.personId === me?.id || isMeAdmin)
                        ? () => lifecycle.openExit(item.personId)
                        : undefined
                    }
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
                    direction={
                      item.to === me?.id
                        ? 'toMe'
                        : item.from === me?.id
                          ? 'fromMe'
                          : null
                    }
                    amount={item.amount}
                    currency={item.currency}
                    locale={locale}
                    remind={me && (item.to === me.id || item.from === me.id) ? {personId: item.to === me.id ? item.from : item.to, groupId} : undefined}
                    onCallItEven={() => {
                      // One part: this group's transfer, `from` owes `to`.
                      setEvenDraft({
                        a: item.to,
                        b: item.from,
                        balance: {
                          [item.currency]: [{groupId, amount: item.amount}],
                        },
                        currency: item.currency,
                      })
                      evenControl.open()
                    }}
                  />
                )
              }
              case 'outsideRules':
                return (
                  <View testID="group-outside-rules" style={[a.px_lg, a.pb_md]}>
                    <Admonition.Outer type="warning">
                      <Admonition.Row>
                        <Admonition.Icon />
                        <Admonition.Content>
                          <Admonition.Text>
                            {item.currencies.length === Object.keys(nets).length
                              ? l`Your payment rules leave no way to settle up, so this plan goes outside them.`
                              : l`Your payment rules leave no way to settle up in ${item.currencies.join(', ')}, so that plan goes outside them.`}
                          </Admonition.Text>
                        </Admonition.Content>
                        <Admonition.Button
                          testID="group-outside-rules-edit"
                          label={l`Edit who you settle with`}
                          color="secondary"
                          onPress={() => rulesControl.open()}>
                          <ButtonText>
                            <Trans>Edit rules</Trans>
                          </ButtonText>
                        </Admonition.Button>
                      </Admonition.Row>
                    </Admonition.Outer>
                  </View>
                )
              case 'settleCta':
                return (
                  <View
                    style={[
                      a.flex_row,
                      a.align_center,
                      a.gap_md,
                      a.px_lg,
                      a.py_md,
                    ]}>
                    <Text
                      style={[
                        a.flex_1,
                        a.text_sm,
                        a.leading_snug,
                        t.atoms.text_contrast_medium,
                      ]}>
                      {item.payments === 1
                        ? l`1 payment settles everyone up.`
                        : l`${item.payments} payments settle everyone up.`}
                    </Text>
                    <Button
                      testID="group-balances-settle"
                      label={l`Settle up`}
                      size="small"
                      color="primary"
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
      {group && (
        <AddMembersDialog
          control={addMembersControl}
          group={group}
          inviteRow={
            <SettingsList.Container>
              <SettingsList.PressableItem
                testID="add-members-invite-link"
                label={l`Invite with a link or QR code`}
                contentContainerStyle={[a.px_0]}
                onPress={() =>
                  addMembersControl.close(() =>
                    navigation.navigate('CreateInvite', {
                      kind: 'group',
                      groupId,
                    }),
                  )
                }>
                <SettingsList.ItemIcon icon={QrIcon} />
                <SettingsList.ItemText>
                  <Trans>Invite link or QR code</Trans>
                </SettingsList.ItemText>
                <SettingsList.Chevron />
              </SettingsList.PressableItem>
            </SettingsList.Container>
          }
        />
      )}
      {exportSheet.element}
      <CallItEvenDialog control={evenControl} draft={evenDraft} names={names} />
      {group && <EditGroupDialog control={editControl} group={group} />}
      {group && me && <GroupLifecycleDialogs lifecycle={lifecycle} group={group} me={me.id} names={names} nets={nets} locale={locale} />}
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
          kind={openKind}
          me={me.id}
          names={names}
          groupName={group?.data.name ?? null}
          hide={
            openRepayment?.deleted
              ? {isHidden: hidden.has(openRepayment.id), onToggle: () => void openHide.toggle(!hidden.has(openRepayment.id))}
              : undefined
          }
        />
      )}
      <ShowHiddenSheet control={filterControl} testID="group-filter-sheet" disputed={{value: onlyDisputed, onApply: setOnlyDisputed}} />
    </Layout.Screen>
  )
}
