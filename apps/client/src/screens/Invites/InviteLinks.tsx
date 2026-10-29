// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/JoinRequests.tsx (list of rows with inline actions) and src/screens/Messages/components/InviteLinkDialog.tsx (Step.CONFIRM_DISABLE copy)
import {useState} from 'react'
import {View} from 'react-native'
import Animated, {LayoutAnimationConfig} from 'react-native-reanimated'
import {Plural, Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {
  type Entity,
  type Group,
  type InviteLink,
  requestName,
  revokeInviteLink,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {copyText} from '#/lib/sharing'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {directory, inviteUrl} from '#/data/friends'
import {useEntities, useFriendRequests, useMutationCtx, useSortedInviteLinks, useStore} from '#/data/hooks'
import {EmptyState} from '#/view/com/util/EmptyState'
import {List} from '#/view/com/util/List'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import {
  ChainLink_Stroke2_Corner0_Rounded as LinkIcon,
  PeopleGroup_Stroke2_Corner0_Rounded as GroupIcon,
  QrCode_Stroke2_Corner0_Rounded as QrIcon,
  SquareBehindSquare_Stroke2_Corner2_Rounded as CopyIcon,
} from '#/components/icons/Invite'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import {useDescribeLink} from '#/components/invites/describe'
import * as Layout from '#/components/Layout'
import * as Prompt from '#/components/Prompt'
import {SyncToned} from '#/components/SyncTone'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useListAnimations} from '#/motion/listAnimations'

/**
 * The invite-link rows and their Revoke prompt, shared by this screen and the
 * Friends and invites hub (Settings, F-621): `renderLink` draws one link
 * (uses left, expiry, QR and share, Copy, Revoke) and `prompt` is the
 * confirmation to render once beside the list.
 */
export function useInviteLinkRows(now: number) {
  const {t: l} = useLingui()
  const t = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const describe = useDescribeLink()
  const listAnimations = useListAnimations()
  const groups = useEntities<Group>('group')
  const groupName = new Map((groups ?? []).map(g => [g.id, g.data.name]))
  /* A personal link sent with an invite is named after who it is for. */
  const requests = useFriendRequests()
  const invitedName = new Map(
    (requests ?? []).flatMap(r =>
      r.data.inviteCode ? [[r.data.inviteCode, requestName(r.data)] as const] : [],
    ),
  )
  const revokePrompt = Prompt.usePromptControl()
  const [revoking, setRevoking] = useState<Entity<InviteLink> | null>(null)

  const revoke = async (link: Entity<InviteLink>) => {
    try {
      await revokeInviteLink(store, ctx, link.id)
      const delivery = await directory.revoke(link.id)
      haptics.success()
      Toast.show(
        delivery === 'sent'
          ? l`Link revoked. It no longer works.`
          : l`Link revoked here. It stops working everywhere once you’re online.`,
        {type: 'success'},
      )
    } catch (e) {
      logger.error(e, {where: 'InviteLinks.revoke'})
      Toast.show(l`Couldn’t revoke the link. Please try again.`, {type: 'error'})
    }
  }

  const renderLink = (link: Entity<InviteLink>) => {
    const name =
      link.data.kind === 'group'
        ? (groupName.get(link.data.groupId ?? '') ?? l`Group invite`)
        : invitedName.has(link.id)
          ? l`Invite for ${invitedName.get(link.id)}`
          : l`Friend invite`
    return (
      <Animated.View
        {...listAnimations}
        key={link.id}
        testID={`invite-link-${link.id}`}
        style={[
          a.flex_row,
          a.gap_md,
          a.px_lg,
          a.py_md,
          a.border_b,
          t.atoms.border_contrast_low,
        ]}>
        <View
          style={[
            a.align_center,
            a.justify_center,
            a.rounded_full,
            {width: 44, height: 44, backgroundColor: t.palette.primary_50},
          ]}>
          {link.data.kind === 'group' ? (
            <GroupIcon size="md" fill={t.palette.primary_500} />
          ) : (
            <LinkIcon size="md" fill={t.palette.primary_500} />
          )}
        </View>
        <SyncToned status={link.syncStatus} style={[a.flex_1, a.gap_2xs]}>
          <Text emoji numberOfLines={1} style={[a.text_md, a.font_semi_bold]}>
            {name}
          </Text>
          <Text
            testID="invite-link-details"
            style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            {describe(link.data, now)}
            {link.data.approveJoins ? ` · ${l`You approve each join`}` : ''}
          </Text>
          <Text
            numberOfLines={1}
            style={[a.text_sm, t.atoms.text_contrast_low, {fontVariant: ['tabular-nums']}]}>
            {inviteUrl(link.id).replace('https://', '')}
          </Text>
          <View style={[a.flex_row, a.gap_sm, a.pt_sm, a.flex_wrap]}>
            <Button
              testID="invite-link-qr"
              label={l`Show QR code and share`}
              size="small"
              color="secondary"
              onPress={() => navigation.navigate('ShareInvite', {code: link.id})}>
              <ButtonIcon icon={QrIcon} />
              <ButtonText>
                <Trans>QR and share</Trans>
              </ButtonText>
            </Button>
            <Button
              testID="invite-link-copy"
              label={l`Copy link`}
              size="small"
              color="secondary"
              onPress={() => void copyText(inviteUrl(link.id))}>
              <ButtonIcon icon={CopyIcon} />
              <ButtonText>
                <Trans>Copy</Trans>
              </ButtonText>
            </Button>
            <Button
              testID="invite-link-revoke"
              label={l`Revoke link`}
              size="small"
              color="negative_subtle"
              onPress={() => {
                setRevoking(link)
                revokePrompt.open()
              }}>
              <ButtonText>
                <Trans>Revoke</Trans>
              </ButtonText>
            </Button>
          </View>
        </SyncToned>
      </Animated.View>
    )
  }

  const prompt = (
    <Prompt.Basic
      control={revokePrompt}
      title={l`Revoke this invite link?`}
      description={l`Anyone who has it can no longer use it. You can always make a new one.`}
      confirmButtonCta={l`Revoke link`}
      confirmButtonColor="negative"
      onConfirm={() => {
        if (revoking) void revoke(revoking)
      }}
    />
  )
  return {renderLink, prompt}
}

/**
 * Manage invite links (26.18): every link that still works, with uses left
 * and expiry, Copy, the QR sheet and Revoke (a prompt, so a bottom sheet on
 * phones). Links that stopped working are only counted.
 */
export function InviteLinksScreen() {
  const {t: l} = useLingui()
  const t = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const {isLoading, active, inactive, now} = useSortedInviteLinks()
  const {renderLink, prompt} = useInviteLinkRows(now)

  return (
    <Layout.Screen testID="screen-invite-links">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Invite links</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.ActionButton
          testID="invite-links-new"
          label={l`New invite link`}
          icon={PlusIcon}
          edge
          onPress={() => navigation.navigate('CreateInvite', {kind: 'friend'})}
        />
      </Layout.Header.Outer>
      {isLoading ? null : (
        <LayoutAnimationConfig skipEntering skipExiting>
          <List
            data={active}
            keyExtractor={(link: Entity<InviteLink>) => link.id}
            renderItem={({item}: {item: Entity<InviteLink>}) => renderLink(item)}
            ListHeaderComponent={
              active.length > 0 ? (
                <Text
                  style={[
                    a.px_lg,
                    a.pt_lg,
                    a.pb_sm,
                    a.text_sm,
                    a.leading_snug,
                    t.atoms.text_contrast_medium,
                  ]}>
                  <Trans>
                    Links that still work. Revoke one and it stops working
                    straight away; friends who already joined stay friends.
                  </Trans>
                </Text>
              ) : undefined
            }
            ListEmptyComponent={
              <EmptyState
                testID="invite-links-empty"
                illustration="empty-people"
                title={l`No active invite links`}
                message={l`Make a link or QR code to add friends or fill a group without typing anyone’s number.`}
                button={{
                  testID: 'invite-links-empty-create',
                  label: l`Create a link`,
                  text: l`Create a link`,
                  onPress: () => navigation.navigate('CreateInvite', {kind: 'friend'}),
                  size: 'small',
                  color: 'primary',
                }}
              />
            }
            ListFooterComponent={
              inactive.length > 0 ? (
                <Text
                  testID="invite-links-inactive"
                  style={[a.px_lg, a.py_lg, a.text_sm, t.atoms.text_contrast_medium]}>
                  <Plural
                    value={inactive.length}
                    one="# expired, used or revoked link isn’t shown."
                    other="# expired, used or revoked links aren’t shown."
                  />
                </Text>
              ) : undefined
            }
          />
        </LayoutAnimationConfig>
      )}
      {prompt}
    </Layout.Screen>
  )
}
