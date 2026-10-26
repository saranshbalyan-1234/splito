import {View} from 'react-native'
import {msg, plural} from '@lingui/core/macro'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation, useRoute, type RouteProp} from '@react-navigation/native'
import {
  cashSplit,
  cashUnitWhole,
  expenseNet,
  formatAmount,
  magnitude,
  itemBreakdown,
  type SplitInput,
  ZERO,
} from '@splito/domain'
import {
  deleteExpense,
  type Entity,
  type Expense,
  type Group,
  restoreExpense,
} from '@splito/sync'

import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {useNumberLocale} from '#/locale/numberLocale'
import {useEntities, useMutationCtx, useStore} from '#/data/hooks'
import {Link} from '#/view/com/util/Link'
import {EmptyState} from '#/view/com/util/EmptyState'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {ArrowRotateCounterClockwise_Stroke2_Corner0_Rounded as UndoIcon} from '#/components/icons/ArrowRotate'
import {DotGrid3x1_Stroke2_Corner0_Rounded as DotsIcon} from '#/components/icons/DotGrid'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Layout from '#/components/Layout'
import * as Menu from '#/components/Menu'
import * as Skeleton from '#/components/Skeleton'
import {
  cashUnitText,
  CategoryTile,
  localToday,
  SectionLabel,
  useAvatarName,
  useCategory,
  useDisplayName,
  useErrorText,
  useExpenseTz,
} from '#/components/split/shared'
import {ReceiptIcon} from '#/components/split/icons'
import {useExpense} from '#/components/split/useExpense'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {MoneyArrow, useMoneyStyle} from '#/components/MoneyDirection'
import {Shimmer} from '#/motion/Shimmer'
import {History} from './components/History'
import {ItemsBreakdown} from './components/ItemsBreakdown'

/**
 * One expense: what it was, who paid, everyone's share, notes and its edit
 * history. Edit and Delete sit in the header menu, as Bluesky's post menu;
 * Delete leaves a tombstone and offers Undo.
 */
export function ExpenseScreen() {
  const {t: l} = useLingui()
  const {params} = useRoute<RouteProp<AllNavigatorParams, 'Expense'>>()
  const navigation = useNavigation<NavigationProp>()
  const {expense, history} = useExpense(params.expenseId)

  return (
    <Layout.Screen testID="screen-expense">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        {/* Balances Edit and the overflow on the right, so the title stays centred. */}
        <Layout.Header.Slot />
        <Layout.Header.Content>
          <Layout.Header.TitleText testID="expense-detail-title">
            {expense?.data.title ?? <Trans>Expense</Trans>}
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        {expense && !expense.deleted ? (
          <>
            <Layout.Header.ActionButton
              testID="expense-edit-button"
              icon={PencilIcon}
              label={l`Edit expense`}
              onPress={() =>
                navigation.navigate('EditExpense', {expenseId: expense.id})
              }
            />
            <ExpenseMenu expense={expense} />
          </>
        ) : (
          <>
            <Layout.Header.Slot />
            <Layout.Header.Slot />
          </>
        )}
      </Layout.Header.Outer>
      {expense === undefined ? (
        <DetailSkeleton />
      ) : expense === null ? (
        <EmptyState
          testID="expense-not-found"
          icon={ReceiptIcon}
          message={l`This expense doesn’t exist. The link may be wrong.`}
          button={{
            label: l`Go to People`,
            text: l`Go to People`,
            onPress: () => navigation.navigate('People'),
            size: 'small',
            color: 'secondary',
          }}
        />
      ) : (
        <Detail expense={expense} history={history} />
      )}
    </Layout.Screen>
  )
}

function ExpenseMenu({expense}: {expense: Entity<Expense>}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const errorText = useErrorText()

  const remove = async () => {
    try {
      await deleteExpense(store, ctx, expense.id)
    } catch (e) {
      Toast.show(errorText((e as {code?: string}).code ?? ''), {type: 'error'})
      return
    }
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('People')
    Toast.show(
      <Toast.Outer>
        <Toast.Icon icon={TrashIcon} />
        <Toast.Text>
          <Trans>Expense deleted</Trans>
        </Toast.Text>
        <Toast.Action
          label={l`Undo`}
          onPress={() =>
            void restoreExpense(store, ctx, expense.id).catch(e =>
              Toast.show(errorText((e as {code?: string}).code ?? ''), {
                type: 'error',
              }),
            )
          }>
          <Trans>Undo</Trans>
        </Toast.Action>
      </Toast.Outer>,
    )
  }

  return (
    <Menu.Root>
      <Menu.Trigger label={l`Expense options`}>
        {({props}) => (
          <Layout.Header.Slot>
            <Button
              testID="expense-menu"
              label={props.accessibilityLabel}
              {...props}
              size="small"
              variant="ghost"
              color="secondary"
              shape="round">
              <ButtonIcon icon={DotsIcon} size="lg" />
            </Button>
          </Layout.Header.Slot>
        )}
      </Menu.Trigger>
      <Menu.Outer>
        <Menu.Group>
          <Menu.Item
            testID="expense-delete"
            label={l`Delete expense`}
            onPress={() => void remove()}>
            <Menu.ItemText>
              <Trans>Delete expense</Trans>
            </Menu.ItemText>
            <Menu.ItemIcon icon={TrashIcon} position="right" />
          </Menu.Item>
        </Menu.Group>
      </Menu.Outer>
    </Menu.Root>
  )
}

function Detail({
  expense,
  history,
}: {
  expense: Entity<Expense>
  history: Parameters<typeof History>[0]['history']
}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtTablet} = useBreakpoints()
  const store = useStore()
  const ctx = useMutationCtx()
  const locale = useNumberLocale()
  const tz = useExpenseTz()
  const name = useDisplayName()
  const avatarName = useAvatarName()
  const errorText = useErrorText()
  const groups = useEntities<Group>('group')
  const e = expense.data
  const category = useCategory(e.category)
  const group = e.groupId ? groups?.find(g => g.id === e.groupId) : undefined
  const fmt = (v: bigint) => formatAmount(v, e.currency, locale)
  const myNet =
    ctx.actor in e.payers || ctx.actor in e.shares
      ? expenseNet(e, ctx.actor)
      : undefined
  const isUpcoming = e.date > localToday(tz)
  const money = useMoneyStyle()
  const splitLabel = {
    equal: l`Split equally`,
    exact: l`Split by exact amounts`,
    percent: l`Split by percentages`,
    shares: l`Split by shares`,
    adjusted: l`Split equally, with adjustments`,
    items: l`Split by items`,
  }[e.split.mode]
  const people = Object.keys(e.shares).sort((x, y) =>
    x === ctx.actor ? -1 : y === ctx.actor ? 1 : name(x).localeCompare(name(y)),
  )
  const payers = Object.keys(e.payers).sort((x, y) =>
    x === ctx.actor ? -1 : y === ctx.actor ? 1 : name(x).localeCompare(name(y)),
  )

  const hero = (
    <View style={[a.px_lg, a.pt_xl, a.pb_lg, a.gap_lg]}>
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <CategoryTile category={category} size={52} />
        {/* The title is the page header's (owner header rule). */}
        <View style={[a.flex_1, a.gap_2xs]}>
          <View style={[a.flex_row, a.align_center, a.flex_wrap, a.gap_xs]}>
            <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
              {category.name}
            </Text>
            {group ? (
              <>
                <Text style={[a.text_md, t.atoms.text_contrast_medium]}>·</Text>
                <Link
                  testID="expense-group-link"
                  href={`/groups/${group.id}`}
                  title={group.data.name}
                  asAnchor
                  anchorNoUnderline>
                  <Text style={[a.text_md, {color: t.palette.primary_500}]}>
                    {group.data.name}
                  </Text>
                </Link>
              </>
            ) : null}
          </View>
        </View>
      </View>

      <View style={[a.gap_xs]}>
        <Text
          testID="expense-detail-amount"
          style={[
            a.text_5xl,
            a.font_bold,
            a.leading_tight,
            {fontVariant: ['tabular-nums']},
          ]}>
          {fmt(e.total)}
        </Text>
        <View style={[a.flex_row, a.align_center, a.gap_sm, a.flex_wrap]}>
          <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
            {i18n.date(new Date(`${e.date}T00:00:00Z`), {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
              timeZone: 'UTC',
            })}
          </Text>
          {isUpcoming ? (
            <View
              testID="expense-upcoming"
              style={[
                a.px_sm,
                a.py_2xs,
                a.rounded_full,
                {backgroundColor: t.palette.primary_50},
              ]}>
              <Text
                style={[
                  a.text_xs,
                  a.font_semi_bold,
                  {color: t.palette.primary_600},
                ]}>
                <Trans>Upcoming</Trans>
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {myNet !== undefined ? (
        /* A chip tinted by direction (green lent, red borrowed), with an arrow and words so colour is never alone. */
        <View
          testID="expense-my-net"
          style={[
            a.flex_row,
            a.align_center,
            a.self_start,
            a.gap_sm,
            a.px_md,
            a.py_sm,
            a.rounded_full,
            /* Dark themes invert the palette, so _25 is the deep tint there. */
            myNet > ZERO
              ? {backgroundColor: t.palette.positive_25}
              : myNet < ZERO
                ? {backgroundColor: t.palette.negative_25}
                : t.atoms.bg_contrast_25,
          ]}>
          <MoneyArrow amount={myNet} />
          <Text
            style={[
              a.text_md,
              a.font_semi_bold,
              {fontVariant: ['tabular-nums']},
              money.style(myNet),
            ]}>
            {myNet > ZERO ? (
              <Trans>You lent {fmt(myNet)}</Trans>
            ) : myNet < ZERO ? (
              <Trans>You borrowed {fmt(magnitude(myNet))}</Trans>
            ) : (
              <Trans>You paid your own share</Trans>
            )}
          </Text>
        </View>
      ) : (
        <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
          <Trans>You’re not part of this expense</Trans>
        </Text>
      )}
    </View>
  )

  const breakdown = (
    <View>
      <SectionLabel>
        <Trans>Paid by</Trans>
      </SectionLabel>
      {payers.map(id => (
        <PersonAmount
          key={id}
          avatar={avatarName(id)}
          name={name(id)}
          amount={fmt(e.payers[id]!)}
          testID={`paid-row-${name(id)}`}
        />
      ))}

      <SectionLabel>{splitLabel}</SectionLabel>
      {people.map(id => (
        <PersonAmount
          key={id}
          avatar={avatarName(id)}
          name={name(id)}
          amount={fmt(e.shares[id]!)}
          detail={shareDetail(e, id, fmt, i18n)}
          isMe={id === ctx.actor}
          testID={`share-row-${name(id)}`}
        />
      ))}

      <CashRoundingNote
        total={e.total}
        split={e.split}
        currency={e.currency}
        fmt={fmt}
        name={name}
        me={ctx.actor}
      />

      {e.split.mode === 'items' ? (
        <ItemsBreakdown
          split={e.split}
          fmt={fmt}
          name={name}
          avatarName={avatarName}
        />
      ) : null}

      {e.notes ? (
        <>
          <SectionLabel>
            <Trans>Notes</Trans>
          </SectionLabel>
          <Text
            testID="expense-notes"
            style={[a.px_lg, a.text_md, a.leading_relaxed]}>
            {e.notes}
          </Text>
        </>
      ) : null}
    </View>
  )

  const deletedBanner = expense.deleted ? (
    <View
      testID="expense-deleted"
      style={[
        a.mx_lg,
        a.mt_lg,
        a.p_md,
        a.rounded_md,
        a.flex_row,
        a.align_center,
        a.gap_md,
        {backgroundColor: t.palette.negative_25},
      ]}>
      <TrashIcon size="md" fill={t.palette.negative_500} />
      <Text style={[a.flex_1, a.text_md, a.leading_snug]}>
        <Trans>
          This expense was deleted. It no longer counts towards any balance.
        </Trans>
      </Text>
      <Button
        testID="expense-restore"
        label={l`Restore expense`}
        size="small"
        color="secondary"
        onPress={() =>
          void restoreExpense(store, ctx, expense.id).catch(err =>
            Toast.show(errorText((err as {code?: string}).code ?? ''), {
              type: 'error',
            }),
          )
        }>
        <ButtonIcon icon={UndoIcon} />
        <ButtonText>
          <Trans>Restore</Trans>
        </ButtonText>
      </Button>
    </View>
  ) : null

  return (
    <Layout.Content contentContainerStyle={[a.pb_5xl]}>
      {deletedBanner}
      {gtTablet ? (
        /* Two columns filling the page, tops aligned: the expense, then its history as a rail. */
        <View style={[a.flex_row, a.align_start]}>
          <View style={[a.flex_1, {flexGrow: 3}]}>
            {hero}
            {breakdown}
          </View>
          <View
            style={[
              a.flex_1,
              {flexGrow: 2},
              a.border_l,
              t.atoms.border_contrast_low,
            ]}>
            <History history={history} />
          </View>
        </View>
      ) : (
        <>
          {hero}
          {breakdown}
          <History history={history} />
        </>
      )}
    </Layout.Content>
  )
}

/** What a person's share is made of, in the expense's split mode. */
function shareDetail(
  e: Expense,
  id: string,
  fmt: (v: bigint) => string,
  i18n: ReturnType<typeof useLingui>['i18n'],
) {
  const s = e.split
  switch (s.mode) {
    case 'percent':
      return s.basisPoints[id]
        ? `${i18n.number(s.basisPoints[id] / 100, {maximumFractionDigits: 2})}%`
        : undefined
    case 'shares':
      return s.shares[id]
        ? plural(s.shares[id], {one: '# share', other: '# shares'})
        : undefined
    case 'adjusted': {
      const adj = s.adjustments[id]
      return adj ? (adj > ZERO ? `+${fmt(adj)}` : `−${fmt(-adj)}`) : undefined
    }
    case 'items': {
      // Their items, then their part of tax, tip, service and discount.
      const {subtotals, extras} = itemBreakdown(s)
      const items = subtotals[id] ?? ZERO
      const extra = extras[id] ?? ZERO
      return extra > ZERO
        ? i18n._(msg`${fmt(items)} + ${fmt(extra)} charges`)
        : extra < ZERO
          ? i18n._(msg`${fmt(items)} − ${fmt(magnitude(extra))} discount`)
          : i18n._(msg`${fmt(items)} of items`)
    }
    default:
      return undefined
  }
}

function PersonAmount({
  avatar,
  name,
  amount,
  detail,
  isMe = false,
  testID,
}: {
  avatar: string
  name: string
  amount: string
  detail?: string
  /** My own share: tinted and bold, so it stands out. */
  isMe?: boolean
  testID?: string
}) {
  const t = useTheme()
  return (
    <View
      testID={testID}
      style={[
        a.flex_row,
        a.align_center,
        a.gap_md,
        a.px_lg,
        a.py_sm,
        {minHeight: 56},
        isMe && t.atoms.bg_contrast_25,
      ]}>
      <UserAvatar size={36} name={avatar} type="user" />
      <View style={[a.flex_1]}>
        <Text style={[a.text_md, a.font_medium]} numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text
        style={[
          a.text_md,
          isMe ? a.font_bold : a.font_semi_bold,
          {fontVariant: ['tabular-nums']},
        ]}>
        {amount}
      </Text>
    </View>
  )
}

function DetailSkeleton() {
  return (
    <Shimmer testID="expense-loading" style={[a.px_lg, a.pt_xl, a.gap_lg]}>
      <Skeleton.Row style={[a.gap_md, a.align_center]}>
        <Skeleton.Block style={[a.rounded_md, {width: 52, height: 52}]} />
        <Skeleton.Col style={[a.flex_1, a.gap_xs]}>
          <Skeleton.Text style={[a.text_2xl, {width: '55%'}]} />
          <Skeleton.Text style={[a.text_md, {width: '30%'}]} />
        </Skeleton.Col>
      </Skeleton.Row>
      <Skeleton.Text style={[a.text_5xl, {width: 200}]} />
      {[0, 1, 2].map(i => (
        <Skeleton.Row key={i} style={[a.gap_md, a.align_center]}>
          <Skeleton.Circle size={36} />
          <Skeleton.Text style={[a.flex_1, a.text_md]} />
          <Skeleton.Text style={[a.text_md, {width: 80}]} />
        </Skeleton.Row>
      ))}
    </Shimmer>
  )
}

/** F-402: a cash-rounded split says so, with the remainder and whose share carries it. */
function CashRoundingNote({
  total,
  split,
  currency,
  fmt,
  name,
  me,
}: {
  total: bigint
  split: SplitInput
  me: string
  currency: string
  fmt: (v: bigint) => string
  name: (id: string) => string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const cash = cashSplit(total, split)
  if (!cash || !('roundTo' in split) || split.roundTo === undefined) return null
  const unit = cashUnitText(currency, cashUnitWhole(currency, split.roundTo))
  return (
    <Text
      testID="expense-cash-rounding"
      style={[
        a.px_lg,
        a.pt_sm,
        a.text_sm,
        a.leading_snug,
        t.atoms.text_contrast_medium,
        {fontVariant: ['tabular-nums']},
      ]}>
      {cash.remainderTo === me
        ? l`Rounded to ${unit} for cash. ${fmt(cash.remainder)} left over is on your share.`
        : cash.remainderTo
          ? l`Rounded to ${unit} for cash. ${fmt(cash.remainder)} left over is on ${name(cash.remainderTo)}’s share.`
          : l`Rounded to ${unit} for cash.`}
    </Text>
  )
}
