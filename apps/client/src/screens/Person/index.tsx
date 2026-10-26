import {useState} from 'react'
import {View} from 'react-native'
import {LayoutAnimationConfig} from 'react-native-reanimated'
import {plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {DomainError, personSummary, sumMinor, ZERO} from '@splito/domain'
import {
  deletePerson,
  type Entity,
  type Expense,
  type Group,
  type Person,
  type Repayment,
} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {
  useEntities,
  useLedger,
  useMe,
  useMutationCtx,
  usePref,
  useStore,
} from '#/data/hooks'
import {useNumberLocale} from '#/locale/numberLocale'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {SectionHeader} from '#/screens/People/components/SectionHeader'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {AddExpenseFAB} from '#/components/AddExpenseFAB'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {myBalances} from '#/components/groups/net'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {
  HandCoins_Stroke2_Corner0_Rounded as HandCoinsIcon,
  IndianRupee_Stroke2_Corner0_Rounded as RupeeIcon,
} from '#/components/icons/Money'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {SettingsSliderVertical_Stroke2_Corner0_Rounded as FilterIcon} from '#/components/icons/SettingsSlider'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import {ScrollTitle, useScrollTitle} from '#/components/Layout/ScrollTitle'
import * as Menu from '#/components/Menu'
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
  involvesPair,
  partsOwedBy,
  toHistory,
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
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const expenses = useEntities<Expense>('expense')
  const repayments = useEntities<Repayment>('repayment')
  const ledger = useLedger()
  const [includeDefault] = usePref('includeGroupsDefault')
  const [applied, setApplied] = useState<boolean | null>(null)
  const includeGroups = applied ?? includeDefault ?? true

  const scrollTitle = useScrollTitle()
  const filterControl = useDialogControl()
  const paymentControl = useDialogControl()
  const upiControl = useDialogControl()
  const detailsControl = useDialogControl()
  const editControl = useDialogControl()
  const deleteControl = Prompt.usePromptControl()
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft | null>(null)
  const [openRepayment, setOpenRepayment] = useState<Entity<Repayment> | null>(
    null,
  )

  const isLoading =
    !me || !people || !groups || !expenses || !repayments || !ledger
  const person = people?.find(p => p.id === personId)

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
  const summary =
    me && ledger
      ? personSummary(myBalances(ledger, me.id, groups ?? []), {
          includeGroups,
        }).find(s => s.person === personId)
      : undefined
  const history =
    me && expenses && repayments
      ? toHistory(expenses, repayments).filter(
          e =>
            involvesPair(e, me.id, personId) &&
            effectWithPerson(e, me.id, personId) !== ZERO &&
            (includeGroups || e.entity.data.groupId === null),
        )
      : []
  const items = withMonths(history)
  const sharedGroups = (groups ?? []).filter(
    g =>
      !g.data.archived &&
      g.data.members.some(m => m.personId === personId && m.leftAt === null),
  )

  const totals = summary?.byCurrency ?? {}
  const openCurrencies = Object.keys(totals)
    .filter(c => totals[c]!.total !== ZERO)
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

  const recordPayment = (draft?: Partial<PaymentDraft>) => {
    if (!me) return
    const currency = draft?.currency ?? openCurrencies[0] ?? 'INR'
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

  const removeFriend = async () => {
    try {
      await deletePerson(store, ctx, personId)
      navigation.goBack()
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
       * Bluesky's profile header: avatar, name, a byline, then the page's
       * one primary action; the balance cards follow in the same column, so
       * every label sits beside its amount.
       */}
      <View style={[a.gap_lg, a.px_lg, a.pt_lg, a.pb_lg]}>
        <View style={[a.gap_md]}>
          <UserAvatar
            size={gtMobile ? 88 : 72}
            name={person!.data.name}
            type="user"
          />
          <View style={[a.gap_2xs]}>
            <Text
              emoji
              testID="person-name"
              style={[
                gtMobile ? a.text_4xl : a.text_3xl,
                a.font_bold,
                a.leading_tight,
                t.atoms.text,
              ]}>
              {person!.data.name}
            </Text>
            <Text
              testID="person-byline"
              numberOfLines={1}
              style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
              {byline}
            </Text>
          </View>
          <View style={[a.flex_row, a.flex_wrap, a.gap_sm, a.pt_xs]}>
            <Button
              testID="person-record-payment"
              label={hasOpenBalance ? l`Settle up` : l`Record a payment`}
              size="large"
              color={hasOpenBalance ? 'primary' : 'secondary'}
              onPress={() => recordPayment()}>
              <ButtonIcon icon={HandCoinsIcon} />
              <ButtonText>
                {hasOpenBalance ? (
                  <Trans>Settle up</Trans>
                ) : (
                  <Trans>Record payment</Trans>
                )}
              </ButtonText>
            </Button>
            {owedInr !== null && (
              <Button
                testID="person-upi"
                label={l`Pay with UPI`}
                size="large"
                color="secondary"
                onPress={() => upiControl.open()}>
                <ButtonIcon icon={RupeeIcon} />
                <ButtonText>
                  <Trans>Pay with UPI</Trans>
                </ButtonText>
              </Button>
            )}
          </View>
        </View>
        <View>
          <PersonBalances
            name={person!.data.name}
            summary={summary}
            groupNames={groupNames}
            locale={locale}
          />
        </View>
      </View>
      <SectionHeader
        title={l`History`}
        testID="person-history-title"
        count={history.length}
        action={
          <View style={[a.flex_row, a.align_center, a.gap_sm]}>
            {!includeGroups && (
              <Pills.Tag>
                <Trans>Direct only</Trans>
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

  return (
    <Layout.Screen testID="screen-person">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <ScrollTitle isShown={scrollTitle.isShown}>
            <Layout.Header.TitleText>
              {person?.data.name ?? <Trans>Friend</Trans>}
            </Layout.Header.TitleText>
          </ScrollTitle>
        </Layout.Header.Content>
        {person ? (
          <Menu.Root>
            <Menu.Trigger label={l`More options`}>
              {({props}) => (
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
              )}
            </Menu.Trigger>
            <Menu.Outer>
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
          onScrolledDownChange={scrollTitle.onScrolledDownChange}
          data={isLoading ? [] : items}
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
                onRepaymentPress={r => {
                  setOpenRepayment(r)
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
          ListFooterComponent={
            !gtMobile ? <View style={{height: 100}} /> : undefined
          }
        />
      </LayoutAnimationConfig>
      <AddExpenseFAB personId={personId} />

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
                  currency: 'INR',
                  amount: null,
                  groupId: null,
                }
              }
              currencies={
                openCurrencies.length > 1 ? openCurrencies : undefined
              }
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
            me={me.id}
            names={names}
            groupName={
              openRepayment?.data.groupId
                ? (groupNames.get(openRepayment.data.groupId) ?? null)
                : null
            }
          />
          <EditFriendDialog control={editControl} person={person} />
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
