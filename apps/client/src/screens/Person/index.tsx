import {useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {
  DomainError,
  isSettledBalance,
  personSummary,
  sumMinor,
  ZERO,
} from '@splito/domain'
import {
  deletePerson,
  type Entity,
  type Group,
  isGroupInactive,
  type Person,
  restorePerson,
  type Repayment,
  type WriteOff,
} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {goBack} from '#/navigation/goBack'
import {DeletedMeta} from '#/components/DeletedMeta'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as UndoIcon} from '#/components/icons/ArrowRotate'
import {useErrorText} from '#/components/split/shared'
import {useHideItem} from '#/features/hidden/HideItem'
import {historyRowHide, useVisibleEntries} from '#/features/hidden/ShowHidden'
import {
  useAllEntities,
  useBalanceRows,
  useEntities,
  useMe,
  useMutationCtx,
  usePairHistory,
  usePref,
  useStore,
} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {SectionHeader} from '#/screens/People/components/SectionHeader'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {
  Handshake_Stroke2_Corner0_Rounded as HandshakeIcon,
  IndianRupee_Stroke2_Corner0_Rounded as RupeeIcon,
} from '#/components/icons/Money'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as FilterIcon} from '#/components/icons/SettingsSlider'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import * as Menu from '#/components/Menu'
import {
  CallItEvenDialog,
  type EvenDraft,
} from '#/features/settlement/CallItEvenDialog'
import {EditFriendDialog} from '#/components/people/EditFriendDialog'
import {
  HistoryRow,
  HistoryRowPlaceholder,
  MonthHeader,
} from '#/components/people/HistoryRow'
import {
  balanceParts,
  effectWithPerson,
  type HistoryItem,
  partsOwedBy,
  paymentCurrencies,
  withMonths,
} from '#/components/people/ledger'
import {PaymentDetailsDialog} from '#/components/people/PaymentDetailsDialog'
import {
  type PaymentDraft,
  RecordPaymentDialog,
} from '#/components/people/RecordPaymentDialog'
import {UpiPayDialog} from '#/components/people/UpiPayDialog'
import * as Pills from '#/components/Pills'
import * as Prompt from '#/components/Prompt'
import * as Skeleton from '#/components/Skeleton'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {PersonReminders} from '#/features/remind/PersonReminders'
import {RemindMenuItems} from '#/features/remind/RemindMenuItems'
import {HistoryFilterDialog} from './components/HistoryFilterDialog'
import {
  PersonBalances,
  PersonBalancesPlaceholder,
} from './components/PersonBalances'

/**
 * A friend's page, laid out like Bluesky's profile: the header block with
 * actions, then balances per currency, then the shared history. The
 * "Include groups" filter (default from preferences, applied with Apply)
 * drives both the totals and the history.
 */
export function PersonScreen() {
  const {t: l} = useLingui()
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const locale = useNumberLocale()
  const navigation = useNavigation<NavigationProp>()
  const {personId} = useRoute<RouteProp<AllNavigatorParams, 'Person'>>().params
  const store = useStore()
  const ctx = useMutationCtx()
  const me = useMe()
  /* Tombstones too: a deleted friend still opens, read-only, and still names the records they are on (decision 103). */
  const people = useAllEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const balanceRows = useBalanceRows()
  const [includeDefault] = usePref('includeGroupsDefault')
  const [defaultCurrency] = usePref('defaultCurrency')
  const [applied, setApplied] = useState<boolean | null>(null)
  const errorText = useErrorText()
  const includeGroups = applied ?? includeDefault ?? true
  /* The expenses and payments between us, newest first, a page at a time (by index). */
  const pairHistory = usePairHistory(personId, includeGroups)

  const filterControl = useDialogControl()
  const paymentControl = useDialogControl()
  const upiControl = useDialogControl()
  const detailsControl = useDialogControl()
  const editControl = useDialogControl()
  const deleteControl = Prompt.usePromptControl()
  const evenControl = useDialogControl()
  const [evenDraft, setEvenDraft] = useState<EvenDraft | null>(null)
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null)
  const [openRepayment, setOpenRepayment] = useState<Entity<
    Repayment | WriteOff
  > | null>(null)
  const [openKind, setOpenKind] = useState<'repayment' | 'writeoff'>(
    'repayment',
  )

  const isLoading = !me || !people || !groups || !balanceRows || !pairHistory
  const person = people?.find(p => p.id === personId)
  const isDeleted = !!person?.deleted
  const {visible, hidden, showHidden} = useVisibleEntries(pairHistory?.entries ?? [])
  const hideFriend = useHideItem({type: 'person', id: personId})
  const openHide = useHideItem({type: openKind, id: openRepayment?.id ?? ''})

  if (!isLoading && (!person || person.data.isMe)) {
    return (
      <Layout.Screen testID="screen-person">
        <Layout.Header.Outer>
          <Layout.Header.BackButton />
          <Layout.Header.Content>
            <Layout.Header.TitleText>
              <Trans>Friend</Trans>
            </Layout.Header.TitleText>
          </Layout.Header.Content>
          <Layout.Header.Slot />
        </Layout.Header.Outer>
        <EmptyState
          testID="person-not-found"
          message={l`This friend isn’t on this device. They may have been removed.`}
          button={{
            label: l`Back to People`,
            text: l`Back to People`,
            onPress: () => navigation.navigate('People'),
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
  const groupNames = new Map((groups ?? []).map(g => [g.id, g.data.name]))
  const summary = balanceRows
    ? personSummary(balanceRows, {includeGroups}).find(
        s => s.person === personId,
      )
    : undefined
  const history = visible
  const items = withMonths(history)
  const sharedGroups = (groups ?? []).filter(
    g =>
      !isGroupInactive(g.data) &&
      g.data.members.some(m => m.personId === personId && m.leftAt === null),
  )

  const totals = summary?.byCurrency ?? {}
  // Open while any part is (audit M10): owed directly and owing in a group is not settled.
  const openCurrencies = Object.keys(totals)
    .filter(c => !isSettledBalance(totals[c]!))
    .sort()
  const hasOpenBalance = openCurrencies.length > 0
  /* What the hero can say that the balance card does not: shared groups and a UPI id. */
  const byline = [
    person?.data.upiId ? l`UPI ${person.data.upiId}` : null,
    sharedGroups.length === 0
      ? l`No shared groups`
      : plural(sharedGroups.length, {
          one: '# shared group',
          other: '# shared groups',
        }),
  ]
    .filter(Boolean)
    .join(' · ')
  // Each currency's balance by part; a payment settles these (RecordPaymentDialog).
  const balance = Object.fromEntries(
    openCurrencies.map(c => [c, balanceParts(totals[c]!)]),
  )
  /* What whoever owes overall still owes, part by part in their direction (never netted across groups). */
  const owedFor = (c: string) => {
    const isPayerMe = (totals[c]?.total ?? ZERO) < ZERO
    return sumMinor(partsOwedBy(balance[c] ?? [], isPayerMe).map(p => p.amount))
  }
  // What I owe them in rupees, if anything: the only case a UPI link helps.
  const owedInr = totals.INR && totals.INR.total < ZERO ? owedFor('INR') : null

  /* Any currency can be recorded (§ 26.13); the open ones lead, the default when settled (audit M8). */
  const payment = paymentCurrencies(openCurrencies, defaultCurrency)
  const recordPayment = (draft?: Partial<PaymentDraft>) => {
    if (!me) return
    const currency = draft?.currency ?? payment.initial
    const total = totals[currency]?.total ?? ZERO
    // Default direction follows the balance: whoever owes pays.
    const theyPay = total >= ZERO
    setPaymentDraft({
      from: theyPay ? personId : me.id,
      to: theyPay ? me.id : personId,
      currency,
      amount: total === ZERO ? null : owedFor(currency),
      groupId: null,
      ...draft,
    })
    paymentControl.open()
  }

  /* "Call it even": every open currency, part by part (> 0: they owe me). */
  const callItEven = () => {
    if (!me || !hasOpenBalance) return
    setEvenDraft({
      a: me.id,
      b: personId,
      balance,
      // The default currency first when it is open, else the first open one.
      currency: openCurrencies.includes(defaultCurrency ?? '')
        ? defaultCurrency!
        : openCurrencies[0]!,
    })
    evenControl.open()
  }

  const removeFriend = async () => {
    try {
      await deletePerson(store, ctx, personId)
      goBack(navigation, {name: 'People'})
      Toast.show(l`Friend removed`)
    } catch (e) {
      Toast.show(
        e instanceof DomainError && e.code === 'PERSON_IN_USE'
          ? l`${person?.data.name ?? ''} has expenses, payments or groups, so they can’t be removed.`
          : l`Couldn’t remove this friend. Please try again.`,
        {type: 'error'},
      )
    }
  }

  const header = isLoading ? (
    <Shimmer testID="person-loading">
      <PersonHeroPlaceholder />
      <View style={[a.px_lg, a.pb_lg]}>
        <PersonBalancesPlaceholder />
      </View>
    </Shimmer>
  ) : (
    <>
      {/*
       * Bluesky's profile header block: the avatar, then my balance with
       * them. The name and byline are the page header's title and subtitle,
       * and Settle up is its action (owner header rule).
       */}
      <View style={[a.gap_lg, a.px_lg, a.pt_lg, a.pb_lg]}>
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <UserAvatar
            size={gtMobile ? 64 : 56}
            name={person!.data.name}
            type="user"
          />
          <View style={a.flex_1} />
          {/* Bluesky's profile action row; pushed pages have no FAB (owner rule 17). */}
          {isDeleted ? null : (
          <Button
            testID="person-add-expense"
            label={l({message: 'Add expense', context: 'action'})}
            size="small"
            color="primary"
            onPress={() => navigation.navigate('AddExpense', {personId})}>
            <ButtonIcon icon={PlusIcon} />
            <ButtonText>
              <Trans context="action">Add expense</Trans>
            </ButtonText>
          </Button>
          )}
          {owedInr !== null && !isDeleted && (
            <Button
              testID="person-upi"
              label={l`Pay with UPI`}
              size="small"
              color="secondary"
              onPress={() => upiControl.open()}>
              <ButtonIcon icon={RupeeIcon} />
              <ButtonText>
                <Trans>Pay with UPI</Trans>
              </ButtonText>
            </Button>
          )}
        </View>
        {isDeleted ? (
          <View
            testID="person-deleted"
            style={[a.p_md, a.rounded_md, a.flex_row, a.align_center, a.gap_md, {backgroundColor: t.palette.negative_25}]}>
            <TrashIcon size="md" fill={t.palette.negative_500} />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text style={[a.text_md, a.leading_snug]}>
                <Trans>This friend was removed. Their expenses and payments stay here, struck through.</Trans>
              </Text>
              <DeletedMeta testID="person-deleted-at" at={person!.updatedAt} />
            </View>
            <View style={[a.gap_xs]}>
              <Button
                testID="person-restore"
                label={l`Restore friend`}
                size="small"
                color="secondary"
                onPress={() =>
                  void restorePerson(store, ctx, personId).catch(e =>
                    Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'}),
                  )
                }>
                <ButtonIcon icon={UndoIcon} />
                <ButtonText>
                  <Trans>Restore</Trans>
                </ButtonText>
              </Button>
              <Button
                testID="person-hide"
                label={hidden.has(personId) ? l`Unhide` : l`Hide`}
                size="small"
                color="secondary"
                onPress={() => void hideFriend.toggle(!hidden.has(personId))}>
                <ButtonText>{hidden.has(personId) ? <Trans>Unhide</Trans> : <Trans>Hide</Trans>}</ButtonText>
              </Button>
            </View>
          </View>
        ) : null}
        <View>
          <PersonBalances
            name={person!.data.name}
            summary={summary}
            groupNames={groupNames}
            locale={locale}
          />
          <PersonReminders personId={personId} />
        </View>
      </View>
      <SectionHeader
        title={l`History`}
        testID="person-history-title"
        count={pairHistory?.isDone ? history.length : undefined}
        action={
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            {!includeGroups && (
              <Pills.Tag>
                <Trans>Direct only</Trans>
              </Pills.Tag>
            )}
            {showHidden && (
              <Pills.Tag>
                <Trans>Hidden shown</Trans>
              </Pills.Tag>
            )}
            <Button
              testID="person-filter"
              label={l`Filter`}
              size="small"
              color="secondary"
              onPress={() => filterControl.open()}>
              <ButtonIcon icon={FilterIcon} />
              <ButtonText>
                <Trans>Filter</Trans>
              </ButtonText>
            </Button>
          </View>
        }
      />
    </>
  )

  /* The next page of history is read when the end comes near (Bluesky's feed paging). */
  const onEndReached = () => {
    if (pairHistory && !pairHistory.isDone) pairHistory.loadMore()
  }

  return (
    <Layout.Screen testID="screen-person">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        {/* Balances Settle up and the overflow on the right, so the title stays centred. */}
        <Layout.Header.Slot />
        <Layout.Header.Content>
          <Layout.Header.TitleText testID="person-name">
            {person?.data.name ?? <Trans>Friend</Trans>}
          </Layout.Header.TitleText>
          {person ? (
            <Layout.Header.SubtitleText testID="person-byline">
              {byline}
            </Layout.Header.SubtitleText>
          ) : null}
        </Layout.Header.Content>
        {/* Header rule set: Settle up (Record payment once settled), then the overflow (Edit, Remove). */}
        <Layout.Header.ActionButton
          testID="person-record-payment"
          label={hasOpenBalance ? l`Settle up` : l`Record payment`}
          icon={HandshakeIcon}
          disabled={!person || isDeleted}
          onPress={() => recordPayment()}
        />
        {person && !isDeleted ? (
          <Menu.Root>
            <Menu.Trigger label={l`More options`}>
              {({props}) => (
                <Layout.Header.Slot>
                  <Button
                    {...props}
                    testID="person-more"
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
              {hasOpenBalance && (
                <Menu.Item
                  testID="person-call-even"
                  label={l`Call it even`}
                  onPress={callItEven}>
                  <Menu.ItemText>
                    <Trans>Call it even</Trans>
                  </Menu.ItemText>
                  <Menu.ItemIcon icon={HandshakeIcon} position="right" />
                </Menu.Item>
              )}
              <RemindMenuItems personId={personId} />
              <Menu.Item
                testID="person-edit"
                label={l`Edit friend`}
                onPress={() => editControl.open()}>
                <Menu.ItemText>
                  <Trans>Edit friend</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={PencilIcon} position="right" />
              </Menu.Item>
              <Menu.Item
                testID="person-delete"
                label={l`Remove friend`}
                destructive
                onPress={() => deleteControl.open()}>
                <Menu.ItemText>
                  <Trans>Remove friend</Trans>
                </Menu.ItemText>
                <Menu.ItemIcon icon={TrashIcon} position="right" />
              </Menu.Item>
            </Menu.Outer>
          </Menu.Root>
        ) : (
          <Layout.Header.Slot />
        )}
      </Layout.Header.Outer>
      <LayoutAnimationConfig skipEntering skipExiting>
        <List
          data={isLoading ? [] : items}
          onEndReached={onEndReached}
          keyExtractor={(item: HistoryItem) => item.key}
          renderItem={({item, index}: {item: HistoryItem; index: number}) =>
            item.type === 'month' ? (
              <MonthHeader month={item.month} />
            ) : (
              <HistoryRow
                hideTopBorder={items[index - 1]?.type === 'month'}
                entry={item.entry}
                context="person"
                effect={effectWithPerson(item.entry, me!.id, personId)}
                me={me!.id}
                names={names}
                groupName={
                  item.entry.entity.data.groupId
                    ? groupNames.get(item.entry.entity.data.groupId)
                    : null
                }
                locale={locale}
                hide={historyRowHide(item.entry, hidden, l`this record`)}
                onRepaymentPress={(r, kind) => {
                  setOpenRepayment(r)
                  setOpenKind(kind)
                  detailsControl.open()
                }}
              />
            )
          }
          ListHeaderComponent={header}
          ListEmptyComponent={
            isLoading ? (
              <Shimmer>
                {Array.from({length: 4}, (_, i) => (
                  <HistoryRowPlaceholder key={i} />
                ))}
              </Shimmer>
            ) : (
              <EmptyState
                testID="person-history-empty"
                icon={null}
                message={
                  includeGroups
                    ? l`Nothing with ${person!.data.name} yet. Add an expense you shared and it shows up here.`
                    : l`No direct expenses with ${person!.data.name}. Group expenses are hidden by the filter.`
                }
                button={
                  gtMobile
                    ? {
                        label: l`Add expense`,
                        text: l`Add expense`,
                        icon: PlusIcon,
                        onPress: () =>
                          navigation.navigate('AddExpense', {personId}),
                        size: 'small',
                        color: 'secondary',
                      }
                    : undefined
                }
              />
            )
          }
        />
      </LayoutAnimationConfig>

      {person && me && (
        <>
          <HistoryFilterDialog
            control={filterControl}
            name={person.data.name}
            includeGroups={includeGroups}
            onFilterApplied={setApplied}
          />
          {
            <RecordPaymentDialog
              control={paymentControl}
              draft={
                paymentDraft ?? {
                  from: personId,
                  to: me.id,
                  currency: payment.initial,
                  amount: null,
                  groupId: null,
                }
              }
              currencies={payment.currencies}
              canPickAnyCurrency
              suggestions={Object.fromEntries(
                openCurrencies.map(c => [c, owedFor(c)]),
              )}
              me={me.id}
              names={names}
              balance={balance}
              groupNames={groupNames}
              canSwap
            />
          }
          {owedInr !== null && (
            <UpiPayDialog
              control={upiControl}
              person={person}
              amount={owedInr}
              onPaidConfirmed={amount =>
                recordPayment({
                  from: me.id,
                  to: personId,
                  currency: 'INR',
                  amount,
                })
              }
            />
          )}
          <PaymentDetailsDialog
            control={detailsControl}
            repayment={openRepayment}
            kind={openKind}
            me={me.id}
            names={names}
            groupName={
              openRepayment?.data.groupId
                ? (groupNames.get(openRepayment.data.groupId) ?? null)
                : null
            }
            hide={
              openRepayment?.deleted
                ? {isHidden: hidden.has(openRepayment.id), onToggle: () => void openHide.toggle(!hidden.has(openRepayment.id))}
                : undefined
            }
          />
          <EditFriendDialog control={editControl} person={person} />
          <CallItEvenDialog
            control={evenControl}
            draft={evenDraft}
            names={names}
            groupNames={groupNames}
          />
          <Prompt.Basic
            control={deleteControl}
            title={l`Remove ${person.data.name}?`}
            description={l`Only friends with no expenses, payments or groups can be removed.`}
            confirmButtonCta={l`Remove`}
            confirmButtonColor="negative"
            onConfirm={() => void removeFriend()}
          />
        </>
      )}
    </Layout.Screen>
  )
}

function PersonHeroPlaceholder() {
  return (
    <View style={[a.px_lg, a.pt_lg, a.pb_md, a.gap_md]}>
      <Skeleton.Circle size={72} />
      <View style={[a.gap_xs]}>
        <Skeleton.Text style={[a.text_3xl, {width: 200}]} />
        <Skeleton.Text style={[a.text_md, {width: 140}]} />
      </View>
    </View>
  )
}
