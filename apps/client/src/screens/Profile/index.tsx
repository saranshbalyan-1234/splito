// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx, src/screens/Profile/Header
import {useState} from 'react'
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {
  balanceTotals,
  cellTotals,
  formatAmountCompact,
  personSummary,
} from '@splito/domain'
import {type Entity, type Group, type Person} from '@splito/sync'

import {activityPath} from '#/lib/links/make'
import {openLink} from '#/lib/links/open'
import {type NavigationProp} from '#/lib/routes/types'
import {
  useAllEntities,
  useAnalyticsCells,
  useAnalyticsOverview,
  useBalanceRows,
  useMyExpenseCount,
  useEntities,
  useMe,
  useSortedInviteLinks,
} from '#/data/hooks'
import {inviteUrl} from '#/data/friends'
import {useHiddenItems, useShowHidden} from '#/data/hiddenItems'
import {requestLogOut} from '#/features/account/LogOutPrompt'
import {useNumberLocale} from '#/locale/numberLocale'
import {useToday} from '#/locale/useDates'
import {useSession} from '#/state/session'
import {useDemoMode} from '#/state/demo'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Deferred} from '#/components/Deferred'
import {useDialogControl} from '#/components/Dialog'
import {SignOut_Stroke2_Corner0_Rounded as SignOutIcon} from '#/components/icons/Auth'
import {CircleCheck_Stroke2_Corner0_Rounded as VerifiedIcon} from '#/components/icons/CircleCheck'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {
  Envelope_Stroke2_Corner0_Rounded as MailIcon,
  Phone_Stroke2_Corner0_Rounded as PhoneIcon,
  QrCode_Stroke2_Corner0_Rounded as QrIcon,
} from '#/components/icons/Invite'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import {InviteShare} from '#/components/invites/InviteShare'
import * as Layout from '#/components/Layout'
import {ActivityItem} from '#/components/activity/ActivityItem'
import {useActivityActions} from '#/components/activity/useActivityActions'
import {useActivityFeed} from '#/components/activity/useActivityFeed'
import {EditFriendDialog} from '#/components/people/EditFriendDialog'
import {SectionLink} from '#/components/SectionLink'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {SummaryCard} from '#/components/overview/Overview'
import {overviewColumns} from '#/components/overview/overviewGrid'
import {analyticsHref} from '#/screens/Analytics/overviewScope'
import {SectionHeader} from '#/components/SectionHeader'
import {listedFriends} from '#/screens/People/sort'
import {SettingsRows} from '#/screens/Settings/components/SettingsRows'
import {countFriends, countGroups, yearRange} from './stats'

/** The widest the page grows: a column of sections, centred on wide screens (web adapts, phone unchanged). */
const PAGE_WIDTH = 640
const RECENT = 3

/*
 * Profile (owner 209), a full page about you in Bluesky's profile layout, top to bottom: the header, a stat row,
 * Your balance, Payment details, Add me, Your recent activity, then every Settings row (owner 220: Settings is part of
 * Profile, there is no Settings screen or tab), then Log out last (owner 202). Only the header paints at once; every
 * section below mounts after the first frame (owner 168) and hides when it has nothing to show.
 */
export function ProfileScreen() {
  const me = useMe()

  return (
    <Layout.Screen testID="screen-profile">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Profile</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content contentContainerStyle={[a.pb_5xl]}>
        <View style={[a.w_full, a.self_center, {maxWidth: PAGE_WIDTH}]}>
          <View style={[a.px_xl, a.pt_md, a.pb_md, a.w_full, a.gap_2xs, a.align_center, {minHeight: 160}]}>
            {me ? <ProfilePreview me={me} /> : <ProfilePreviewPlaceholder />}
          </View>
          {me ? (
            <Deferred fallback={<ProfileBodyPlaceholder />}>
              <ProfileBody me={me} />
            </Deferred>
          ) : null}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

/** Everything under the header; mounts after the first frame. */
function ProfileBody({me}: {me: Entity<Person>}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <>
      <ProfileStats me={me} />
      <ProfileCards />
      <PaymentDetails me={me} />
      <AddMe />
      <RecentActivity />
      {/* The Settings list, as it was on its own tab (owner 220); `/settings` opens this page. */}
      <View testID="profile-settings">
        <SectionHeader title={l`Settings`} />
        <SettingsRows />
      </View>
      {/* Sign-in is not built yet: say so plainly instead of a dead row. */}
      <View testID="profile-sync-note" style={[a.flex_row, a.align_start, a.gap_sm, a.px_xl, a.pt_xl, a.pb_lg]}>
        <CloudIcon size="sm" fill={t.atoms.text_contrast_medium.color} style={{marginTop: 2}} />
        <Text style={[a.flex_1, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Everything is saved on this device. It will sync across your devices once sync arrives.</Trans>
        </Text>
      </View>
      {/* The last row (owner 202): the same prompt and erase as everywhere (owner 186). */}
      <View style={[a.px_lg, a.pb_2xl]}>
        <Button testID="profile-log-out" label={l`Log out`} size="large" color="negative_subtle" onPress={requestLogOut}>
          <ButtonIcon icon={SignOutIcon} />
          <ButtonText>
            <Trans>Log out</Trans>
          </ButtonText>
        </Button>
      </View>
    </>
  )
}

function ProfileBodyPlaceholder() {
  return (
    <Shimmer testID="profile-body-loading" style={[a.px_xl, a.gap_lg]}>
      <Skeleton.Text style={[a.text_3xl, {width: '100%'}]} />
      <Skeleton.Text style={[a.text_3xl, {width: '100%'}]} />
    </Shimmer>
  )
}

/* Bluesky's profile header: a large avatar, the name, verified contacts, how long on Splito, Edit profile. */
function ProfilePreview({me}: {me: Entity<Person>}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const {currentAccount} = useSession()
  const editControl = useDialogControl({url: 'edit'})
  const name = me.data.name
  /* "Me" is the name Splito starts with; until it is changed, ask for a real one. */
  const hasDefaultName = name.trim() === '' || name === 'Me'
  const since = me.createdAt > 0 ? i18n.date(new Date(me.createdAt), {month: 'long', year: 'numeric'}) : null

  return (
    <>
      {/* The avatar with Bluesky's edit badge on its corner; both open Edit profile. */}
      <Pressable
        testID="profile-avatar"
        accessibilityRole="button"
        accessibilityLabel={l`Edit profile`}
        accessibilityHint=""
        onPress={() => editControl.open()}>
        <UserAvatar size={96} name={name} type="user" />
        <View
          style={[
            a.absolute,
            a.rounded_full,
            a.align_center,
            a.justify_center,
            t.atoms.bg_contrast_25,
            {
              right: -2,
              bottom: -2,
              width: 32,
              height: 32,
              borderWidth: 2,
              borderColor: t.atoms.bg.backgroundColor,
            },
          ]}>
          <PencilIcon size="xs" fill={t.atoms.text.color} />
        </View>
      </Pressable>

      {hasDefaultName ? (
        /* Until a real name is set, the name's place is a tappable prompt rather than "Me". */
        <Button
          testID="profile-edit"
          label={l`Add your name`}
          size="small"
          variant="ghost"
          color="secondary"
          style={[a.mt_xs, a.bg_transparent]}
          onPress={() => editControl.open()}>
          <Text
            testID="profileHeaderDisplayName"
            style={[gtMobile ? a.text_3xl : a.text_2xl, a.font_bold, t.atoms.text_contrast_medium]}>
            <Trans>Add your name</Trans>
          </Text>
          <ButtonIcon icon={PencilIcon} size="md" />
        </Button>
      ) : (
        <Text
          emoji
          testID="profileHeaderDisplayName"
          numberOfLines={1}
          style={[a.pt_sm, t.atoms.text, gtMobile ? a.text_3xl : a.text_2xl, a.font_bold]}>
          {name}
        </Text>
      )}
      {hasDefaultName && (
        <Text style={[a.text_md, a.leading_snug, a.text_center, t.atoms.text_contrast_medium]}>
          <Trans>So friends know it’s you.</Trans>
        </Text>
      )}
      {/* Every account has both, verified (owner 139); shown as the session holds them. */}
      {currentAccount?.email ? <Contact testID="profile-email" icon={MailIcon} value={currentAccount.email} /> : null}
      {currentAccount?.phone ? <Contact testID="profile-phone" icon={PhoneIcon} value={currentAccount.phone} /> : null}
      {since ? (
        <Text testID="profile-since" style={[a.text_sm, a.pt_2xs, t.atoms.text_contrast_medium]}>
          <Trans>On Splito since {since}</Trans>
        </Text>
      ) : null}
      {!hasDefaultName && (
        <Button
          testID="profile-edit"
          label={l`Edit profile`}
          size="small"
          color="secondary"
          style={[a.mt_md]}
          onPress={() => editControl.open()}>
          <ButtonIcon icon={PencilIcon} />
          <ButtonText>
            <Trans>Edit profile</Trans>
          </ButtonText>
        </Button>
      )}
      <EditFriendDialog control={editControl} person={me} />
    </>
  )
}

/** One contact line with its verified tick. */
function Contact({testID, icon: Icon, value}: {testID: string; icon: typeof MailIcon; value: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View testID={testID} style={[a.flex_row, a.align_center, a.gap_xs, a.pt_2xs]}>
      <Icon size="sm" fill={t.atoms.text_contrast_medium.color} />
      <Text style={[a.text_md, t.atoms.text]}>{value}</Text>
      <View testID={`${testID}-verified`} role="img" accessibilityLabel={l`Verified`}>
        <VerifiedIcon size="sm" fill={t.palette.positive_600} />
      </View>
    </View>
  )
}

function ProfilePreviewPlaceholder() {
  return (
    <Shimmer
      testID="profile-loading"
      style={[a.w_full, a.gap_2xs, a.align_center]}>
      <Skeleton.Circle size={80} />
      <Skeleton.Text style={[a.text_3xl, a.mt_sm, {width: 160}]} />
      <Skeleton.Text style={[a.text_md, {width: 140}]} />
    </Shimmer>
  )
}

/** The tiles of the stat row, 2 x 2 on phones and one row of four on wide screens. */
function ProfileStats({me}: {me: Entity<Person>}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {gtMobile} = useBreakpoints()
  const locale = useNumberLocale()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  /* Expenses I am part of (my share), from the stored per-person sums: not every expense on the device. */
  const expenseCount = useMyExpenseCount(me.id)
  /* This year's paying, in the currency I use most: stored month sums, no ledger read. `...` while loading, `-` when unknown (§ 7). */
  const overview = useAnalyticsOverview()
  const currency = overview?.currencies[0]
  const year = yearRange(useToday())
  const cells = useAnalyticsCells(currency ? {currency, ...year, exact: false} : null)
  const paid = currency && cells ? formatAmountCompact(cellTotals(cells.period, me.id).paid, currency, locale) : overview ? '-' : '...'
  const count = (n: number | undefined) => (n === undefined ? '...' : i18n.number(n))
  const stats = [
    {key: 'friends', to: '/people', label: l`Friends`, value: count(people && countFriends(people))},
    {key: 'groups', to: '/groups', label: l`Groups`, value: count(groups && countGroups(groups))},
    {
      key: 'expenses',
      to: activityPath({tab: 'me', types: ['expenses', 'payments']}),
      label: l`Expenses`,
      value: count(expenseCount),
    },
    {
      key: 'paid',
      to: `/analytics?period=year${currency ? `&currency=${currency}` : ''}`,
      label: l`You paid this year`,
      value: paid,
    },
  ]
  return (
    <View testID="profile-stats" style={[a.px_lg, a.pb_md, a.flex_row, a.flex_wrap, a.gap_sm]}>
      {stats.map(stat => (
        <Link
          key={stat.key}
          testID={`profile-stat-${stat.key}`}
          href={stat.to}
          asAnchor
          anchorNoUnderline
          accessibilityLabel={`${stat.label}: ${stat.value}`}
          accessibilityHint=""
          hoverStyle={t.atoms.bg_contrast_25}
          style={[
            a.align_center,
            a.justify_center,
            a.py_md,
            a.px_xs,
            a.gap_2xs,
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_low,
            {flexGrow: 1, flexBasis: gtMobile ? 0 : '45%', minWidth: 0},
          ]}>
          <Text numberOfLines={1} style={[a.text_xl, a.font_bold, a.leading_tight, {fontVariant: ['tabular-nums']}]}>
            {stat.value}
          </Text>
          <Text numberOfLines={1} style={[a.text_sm, t.atoms.text_contrast_medium]}>
            {stat.label}
          </Text>
        </Link>
      ))}
    </View>
  )
}

/** Your balance: what everyone owes you or you owe, per currency, in the Overview's card style (owner 161). */
function ProfileCards() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const [width, setWidth] = useState(0)
  /* Tombstones too: a removed friend with an open balance stays counted until it is settled (decision 103). */
  const people = useAllEntities<Person>('person')
  const balanceRows = useBalanceRows()
  const [showHidden] = useShowHidden()
  const hiddenIds = useHiddenItems()
  if (!people || !balanceRows) return null
  const byPerson = new Map(personSummary(balanceRows, {includeGroups: true}).map(s => [s.person, s]))
  const live = listedFriends(people, byPerson, hiddenIds).filter(f => (showHidden || !f.isHidden) && f.deletedAt === undefined)
  const totals = balanceTotals(live.flatMap(f => byPerson.get(f.id) ?? []))
  if (totals.length === 0) return null
  const columns = overviewColumns(width, totals.length)
  const cardWidth = width > 0 ? Math.floor((width - 8 * (columns - 1)) / columns) : undefined
  return (
    <View testID="profile-cards">
      <SectionHeader
        title={l`Your balance`}
        action={
          <SectionLink testID="profile-cards-analytics" href={analyticsHref('all')} label={l`Open Analytics`}>
            <Trans>Analytics</Trans>
          </SectionLink>
        }
      />
      <View style={[a.px_lg, a.pb_md]}>
        {/* Measured inside the padding, as the Overview does: the column count follows the width the cards have. */}
        <View
          onLayout={e => e.nativeEvent.layout.width > 0 && setWidth(e.nativeEvent.layout.width)}
          style={[a.flex_row, a.flex_wrap, {gap: 8}]}>
          {totals.map(total => (
            <SummaryCard
              key={total.currency}
              total={total}
              locale={locale}
              caption={undefined}
              width={cardWidth}
              onPress={() => openLink(analyticsHref('all', total.currency))}
            />
          ))}
        </View>
      </View>
    </View>
  )
}

/** Payment details: the UPI ID friends pay me on, edited in the same sheet as the name. */
function PaymentDetails({me}: {me: Entity<Person>}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = useDialogControl({url: 'payment'})
  const upiId = me.data.upiId
  return (
    <View testID="profile-payment">
      <SectionHeader title={l`Payment details`} />
      <View style={[a.px_lg, a.pb_md]}>
        <View style={[a.flex_row, a.align_center, a.gap_md, a.px_md, a.py_sm, a.rounded_md, a.border, t.atoms.border_contrast_low]}>
          <View style={[a.flex_1, a.gap_2xs]}>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              <Trans>UPI ID</Trans>
            </Text>
            <Text testID="profile-upi" selectable style={[a.text_md, a.font_semi_bold, !upiId && t.atoms.text_contrast_medium]}>
              {upiId ?? l`Not set`}
            </Text>
            <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>Friends use this to pay you in rupees.</Trans>
            </Text>
          </View>
          <Button
            testID="profile-upi-edit"
            label={upiId ? l`Edit UPI ID` : l`Add UPI ID`}
            size="small"
            color="secondary"
            onPress={() => control.open()}>
            <ButtonIcon icon={PencilIcon} />
            <ButtonText>{upiId ? <Trans>Edit</Trans> : <Trans>Add</Trans>}</ButtonText>
          </Button>
        </View>
      </View>
      <EditFriendDialog control={control} person={me} />
    </View>
  )
}

/** Add me: my friend QR code and link, to scan or share. Needs a link made while online; with none, one button makes it. */
function AddMe() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const {hasDirectory} = useDemoMode()
  const {active} = useSortedInviteLinks()
  const link = active.find(x => x.data.kind === 'friend')?.data
  if (!link && !hasDirectory) return null
  return (
    <View testID="profile-add-me">
      <SectionHeader title={l`Add me`} />
      <View style={[a.px_lg, a.pb_md, a.gap_md]}>
        <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Anyone who scans this code or opens the link becomes your friend on Splito.</Trans>
        </Text>
        {link ? (
          <InviteShare
            url={inviteUrl(link.code)}
            subject={l`Join me on Splito`}
            message={l`Join me on Splito so we can split expenses:`}
          />
        ) : (
          <Button
            testID="profile-add-me-create"
            label={l`Make my QR code`}
            size="large"
            color="primary_subtle"
            onPress={() => navigation.navigate('CreateInvite', {kind: 'friend'})}>
            <ButtonIcon icon={QrIcon} />
            <ButtonText>
              <Trans>Make my QR code</Trans>
            </ButtonText>
          </Button>
        )}
      </View>
    </View>
  )
}

/** Your recent activity: my last changes, then the whole of it in Activity on Me. */
function RecentActivity() {
  const {t: l} = useLingui()
  const locale = useNumberLocale()
  const feed = useActivityFeed('me')
  const actions = useActivityActions(feed)
  const {snapshot, rows, me} = feed
  const events = rows.flatMap(r => (r.type === 'event' ? [r] : [])).slice(0, RECENT)
  if (!snapshot || events.length === 0) return null
  return (
    <View testID="profile-recent">
      <SectionHeader
        title={l`Your recent activity`}
        action={
          <SectionLink testID="profile-recent-all" href={activityPath({tab: 'me'})} label={l`See all your activity`}>
            <Trans>See all</Trans>
          </SectionLink>
        }
      />
      {events.map(row => (
        <ActivityItem
          key={row.key}
          event={row.event}
          isRead={row.isRead}
          snapshot={snapshot}
          me={me}
          locale={locale}
          actions={actions}
        />
      ))}
    </View>
  )
}
