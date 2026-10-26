// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Settings/Settings.tsx
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {type Entity, type Expense, type Group, type Person} from '@splito/sync'

import {useEntities, useMe} from '#/data/hooks'
import {Link} from '#/view/com/util/Link'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {CircleInfo_Stroke2_Corner0_Rounded as InfoIcon} from '#/components/icons/CircleInfo'
import {Cloud_Stroke2_Corner0_Rounded as CloudIcon} from '#/components/icons/Cloud'
import {SettingsGear2_Stroke2_Corner0_Rounded as SettingsIcon} from '#/components/icons/Settings'
import {Pencil_Stroke2_Corner0_Rounded as PencilIcon} from '#/components/icons/Pencil'
import * as Layout from '#/components/Layout'
import {EditFriendDialog} from '#/components/people/EditFriendDialog'
import * as Skeleton from '#/components/Skeleton'
import {Text} from '#/components/Typography'
import {Shimmer} from '#/motion/Shimmer'

/*
 * Bluesky's Settings index, as Splito's Profile page (opened from the header
 * avatar menu): the account block, what I have in Splito, then Settings
 * and About. Account switching, moderation, sign-out and
 * developer options are removed; sign-in arrives with sync, and a note says
 * so.
 */
export function ProfileScreen() {
  const {t: l} = useLingui()
  const t = useTheme()
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
      <Layout.Content>
        <SettingsList.Container>
          <View
            style={[
              a.px_xl,
              a.pt_md,
              a.pb_md,
              a.w_full,
              a.gap_2xs,
              a.align_center,
              {minHeight: 160},
            ]}>
            {me ? <ProfilePreview me={me} /> : <ProfilePreviewPlaceholder />}
          </View>
          {me ? <ProfileStats /> : null}
          <SettingsList.Divider />
          <SettingsList.LinkItem
            testID="profile-settings"
            to="/settings"
            label={l`Settings`}>
            <SettingsList.ItemIcon icon={SettingsIcon} />
            <SettingsList.ItemText>
              <Trans>Settings</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          <SettingsList.LinkItem
            testID="profile-about"
            to="/settings/about"
            label={l`About`}>
            <SettingsList.ItemIcon icon={InfoIcon} />
            <SettingsList.ItemText>
              <Trans>About</Trans>
            </SettingsList.ItemText>
          </SettingsList.LinkItem>
          {/* Sign-in is not built yet: say so plainly instead of a dead row. */}
          <View
            testID="profile-sync-note"
            style={[a.flex_row, a.align_start, a.gap_sm, a.px_xl, a.pt_lg]}>
            <CloudIcon
              size="sm"
              fill={t.atoms.text_contrast_medium.color}
              style={{marginTop: 2}}
            />
            <Text
              style={[
                a.flex_1,
                a.text_sm,
                a.leading_snug,
                t.atoms.text_contrast_medium,
              ]}>
              <Trans>
                Everything is saved on this device. Sign-in, and sync across
                your devices, are on the way.
              </Trans>
            </Text>
          </View>
        </SettingsList.Container>
      </Layout.Content>
    </Layout.Screen>
  )
}

/* Bluesky's profile header block: avatar, name, then its Edit profile button. */
function ProfilePreview({me}: {me: Entity<Person>}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const editControl = useDialogControl()
  const name = me.data.name
  /* "Me" is the name Splito starts with; until it is changed, ask for a real one. */
  const hasDefaultName = name.trim() === '' || name === 'Me'

  return (
    <>
      <UserAvatar size={80} name={name} type="user" />

      <View
        style={[
          a.flex_row,
          a.gap_xs,
          a.align_center,
          a.justify_center,
          a.w_full,
        ]}>
        <Text
          emoji
          testID="profileHeaderDisplayName"
          numberOfLines={1}
          style={[
            a.pt_sm,
            t.atoms.text,
            gtMobile ? a.text_4xl : a.text_3xl,
            a.font_bold,
          ]}>
          {name}
        </Text>
      </View>
      <Text
        style={[
          a.text_md,
          a.leading_snug,
          a.text_center,
          t.atoms.text_contrast_medium,
        ]}>
        {hasDefaultName ? (
          <Trans>Add your name so friends know it’s you.</Trans>
        ) : (
          <Trans>Saved on this device</Trans>
        )}
      </Text>
      <Button
        testID="profile-edit"
        label={hasDefaultName ? l`Add your name` : l`Edit profile`}
        size="small"
        color={hasDefaultName ? 'primary' : 'secondary'}
        style={[a.mt_md]}
        onPress={() => editControl.open()}>
        <ButtonIcon icon={PencilIcon} />
        <ButtonText>
          {hasDefaultName ? (
            <Trans>Add your name</Trans>
          ) : (
            <Trans>Edit profile</Trans>
          )}
        </ButtonText>
      </Button>
      <EditFriendDialog control={editControl} person={me} />
    </>
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

/** What I have in Splito, as a profile's counts: friends, groups, expenses. Each opens its page. */
function ProfileStats() {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const people = useEntities<Person>('person')
  const groups = useEntities<Group>('group')
  const expenses = useEntities<Expense>('expense')
  const stats = [
    {
      key: 'friends',
      to: '/',
      label: l`Friends`,
      value: (people ?? []).filter(p => !p.data.isMe).length,
    },
    {
      key: 'groups',
      to: '/groups',
      label: l`Groups`,
      value: (groups ?? []).filter(g => !g.data.archived).length,
    },
    {
      key: 'expenses',
      to: '/analytics',
      label: l`Expenses`,
      value: (expenses ?? []).filter(e => !e.deleted).length,
    },
  ]
  return (
    <View style={[a.px_xl, a.pt_sm, a.pb_md]}>
      <View
        style={[
          a.flex_row,
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
        ]}>
        {stats.map((stat, i) => (
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
              a.flex_1,
              a.align_center,
              a.py_md,
              a.gap_2xs,
              i > 0 && [a.border_l, t.atoms.border_contrast_low],
            ]}>
            <Text
              style={[
                a.text_xl,
                a.font_bold,
                a.leading_tight,
                {fontVariant: ['tabular-nums']},
              ]}>
              {i18n.number(stat.value)}
            </Text>
            <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
              {stat.label}
            </Text>
          </Link>
        ))}
      </View>
    </View>
  )
}
