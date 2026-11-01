// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx, src/screens/Profile/Header
import {Pressable, View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {cellTotals, formatAmountCompact} from '@splito/domain'
import {type Entity, type Group, type Person} from '@splito/sync'

import {activityPath} from '#/lib/links/make'
import {
  useAnalyticsCells,
  useAnalyticsOverview,
  useMyExpenseCount,
  useEntities,
  useMe,
} from '#/data/hooks'
import {requestLogOut} from '#/features/account/LogOutPrompt'
import {useNumberLocale} from '#/locale/numberLocale'
import {useToday} from '#/locale/useDates'
import {useSession} from '#/state/session'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {Deferred} from '#/components/Deferred'
import {useDialogControl} from '#/components/Dialog'
import {SignOut_Stroke2_Corner0_Rounded as SignOutIcon} from '#/components/icons/Auth'
import {CircleCheck_Stroke2_Corner0_Rounded as VerifiedIcon} from '#/components/icons/CircleCheck'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {
  Envelope_Stroke2_Corner0_Rounded as MailIcon,
  Phone_Stroke2_Corner0_Rounded as PhoneIcon,
} from '#/components/icons/Invite'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import * as Layout from '#/components/Layout'
import {EditFriendDialog} from '#/components/people/EditFriendDialog'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'
import {SettingsRows} from '#/screens/Settings/components/SettingsRows'
import {countFriends, countGroups, yearRange} from './stats'

/** The widest the page grows: a column of sections, centred on wide screens (web adapts, phone unchanged). */
const PAGE_WIDTH = 640

/*
 * Profile (owners 209, 228), a page about you that fits one phone screen, top to bottom: one compact header row, one
 * stat row, then the Settings rows straight away (owner 229: your UPI ID is edited with the pencil, no row; owner 220:
 * Settings is part of Profile, there is no Settings screen or tab; owner 225: no balance or recent activity; owner 228: no Add me, Friends
 * and invites holds the friend link and QR), then Log out last (owner 202) with the sync note under it. Only the header
 * paints at once; everything below mounts after the first frame (owner 168).
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
          <View style={[a.px_lg, a.pt_sm, a.pb_md, a.w_full]}>
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
      {/* The Settings list, as it was on its own tab (owner 220); `/settings` opens this page. */}
      <View testID="profile-settings">
        <SettingsRows />
      </View>
      {/* The last row (owner 202): the same prompt and erase as everywhere (owner 186). */}
      <View style={[a.px_lg, a.pt_md]}>
        <Button testID="profile-log-out" label={l`Log out`} size="large" color="negative_subtle" onPress={requestLogOut}>
          <ButtonIcon icon={SignOutIcon} />
          <ButtonText>
            <Trans>Log out</Trans>
          </ButtonText>
        </Button>
      </View>
      {/* Sign-in is not built yet: say so plainly instead of a dead row. */}
      <View testID="profile-sync-note" style={[a.flex_row, a.align_start, a.gap_xs, a.px_xl, a.pt_md, a.pb_lg]}>
        <CloudIcon size="xs" fill={t.atoms.text_contrast_medium.color} style={{marginTop: 2}} />
        <Text style={[a.flex_1, a.text_xs, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Everything is saved on this device. It will sync across your devices once sync arrives.</Trans>
        </Text>
      </View>
    </>
  )
}

function ProfileBodyPlaceholder() {
  return (
    <Shimmer testID="profile-body-loading" style={[a.px_lg, a.gap_lg]}>
      <View style={[a.flex_row, a.gap_sm]}>
        {[0, 1, 2, 3].map(i => (
          <Skeleton.Text key={i} style={[a.text_3xl, {flexGrow: 1, flexBasis: 0}]} />
        ))}
      </View>
      <Skeleton.Text style={[a.text_3xl, {width: '100%'}]} />
      <Skeleton.Text style={[a.text_3xl, {width: '100%'}]} />
    </Shimmer>
  )
}

/* Bluesky's profile header as one compact row (owner 228): the avatar, the name, verified contacts and how long on Splito, Edit. */
function ProfilePreview({me}: {me: Entity<Person>}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const {currentAccount} = useSession()
  const editControl = useDialogControl({url: 'edit'})
  const name = me.data.name
  /* "Me" is the name Splito starts with; until it is changed, ask for a real one. */
  const hasDefaultName = name.trim() === '' || name === 'Me'
  const since = me.createdAt > 0 ? i18n.date(new Date(me.createdAt), {month: 'long', year: 'numeric'}) : null

  return (
    <View style={[a.flex_row, a.align_center, a.gap_md, a.w_full]}>
      {/* The avatar opens Edit profile, as the Edit button does. */}
      <Pressable
        testID="profile-avatar"
        accessibilityRole="button"
        accessibilityLabel={l`Edit profile`}
        accessibilityHint=""
        onPress={() => editControl.open()}>
        <UserAvatar size={64} name={name} type="user" />
      </Pressable>
      <View style={[a.flex_grow, a.flex_shrink, a.gap_2xs, {minWidth: 0}]}>
        {hasDefaultName ? (
          /* Until a real name is set, the name's place is a prompt rather than "Me". */
          <Text
            testID="profileHeaderDisplayName"
            numberOfLines={1}
            style={[a.text_xl, a.font_bold, t.atoms.text_contrast_medium]}>
            <Trans>Add your name</Trans>
          </Text>
        ) : (
          <Text emoji testID="profileHeaderDisplayName" numberOfLines={1} style={[t.atoms.text, a.text_xl, a.font_bold]}>
            {name}
          </Text>
        )}
        {/* Every account has both, verified (owner 139); shown as the session holds them. */}
        {currentAccount?.email ? <Contact testID="profile-email" icon={MailIcon} value={currentAccount.email} /> : null}
        {currentAccount?.phone ? <Contact testID="profile-phone" icon={PhoneIcon} value={currentAccount.phone} /> : null}
        {since ? (
          <Text testID="profile-since" numberOfLines={1} style={[a.text_xs, t.atoms.text_contrast_medium]}>
            <Trans>On Splito since {since}</Trans>
          </Text>
        ) : null}
      </View>
      <Button
        testID="profile-edit"
        label={hasDefaultName ? l`Add your name` : l`Edit profile`}
        size="small"
        shape="round"
        color="secondary"
        onPress={() => editControl.open()}>
        <ButtonIcon icon={PencilIcon} />
      </Button>
      <EditFriendDialog control={editControl} person={me} />
    </View>
  )
}

/** One contact line with its verified tick. */
function Contact({testID, icon: Icon, value}: {testID: string; icon: typeof MailIcon; value: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View testID={testID} style={[a.flex_row, a.align_center, a.gap_xs, {minWidth: 0}]}>
      <Icon size="sm" fill={t.atoms.text_contrast_medium.color} />
      <Text numberOfLines={1} style={[a.flex_shrink, a.text_sm, t.atoms.text, {minWidth: 0}]}>
        {value}
      </Text>
      <View testID={`${testID}-verified`} role="img" accessibilityLabel={l`Verified`}>
        <VerifiedIcon size="sm" fill={t.palette.positive_600} />
      </View>
    </View>
  )
}

function ProfilePreviewPlaceholder() {
  return (
    <Shimmer testID="profile-loading" style={[a.w_full, a.flex_row, a.align_center, a.gap_md]}>
      <Skeleton.Circle size={64} />
      <View style={[a.flex_1, a.gap_xs]}>
        <Skeleton.Text style={[a.text_xl, {width: 160}]} />
        <Skeleton.Text style={[a.text_sm, {width: 190}]} />
        <Skeleton.Text style={[a.text_sm, {width: 140}]} />
      </View>
    </Shimmer>
  )
}

/** The tiles of the stat row: one compact row of four on every width (owner 228). */
function ProfileStats({me}: {me: Entity<Person>}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
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
    <View testID="profile-stats" style={[a.px_lg, a.pb_sm, a.flex_row, a.gap_xs]}>
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
            a.py_sm,
            a.px_xs,
            a.gap_2xs,
            a.rounded_md,
            a.border,
            t.atoms.border_contrast_low,
            {flexGrow: 1, flexBasis: 0, minWidth: 0},
          ]}>
          <Text numberOfLines={1} style={[a.text_lg, a.font_bold, a.leading_tight, {fontVariant: ['tabular-nums']}]}>
            {stat.value}
          </Text>
          <Text numberOfLines={2} style={[a.text_xs, a.leading_tight, a.text_center, t.atoms.text_contrast_medium]}>
            {stat.label}
          </Text>
        </Link>
      ))}
    </View>
  )
}
