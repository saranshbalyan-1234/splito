// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/JoinRequest.tsx (preview card, Wrapper, broken-link state)
import {startPage} from '#/lib/routes/startTab'
import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import Animated, {FadeIn} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {
  acceptInvite,
  type InvitePreview,
  isInviteCode,
  joinGroupViaLink,
  linkOutcome,
  type Person,
  requestToJoin,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {directory} from '#/data/friends'
import {useEntities, useInviteLinks, useMutationCtx, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {LogoMark} from '#/components/brand/Logo'
import {Button, ButtonText} from '#/components/Button'
import {ChainLinkBroken_Stroke2_Corner0_Rounded as BrokenLinkIcon} from '#/components/icons/Invite'
import {useDescribeLink} from '#/components/invites/describe'
import * as Layout from '#/components/Layout'
import {Loader} from '#/components/Loader'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

type Answer = InvitePreview | 'not-found' | 'unavailable' | 'loading'

/**
 * Someone's invite link, opened in the app (26.18): who invited you, then
 * Accept or Decline. Opening a link never accepts by itself (section 14);
 * tapping Accept is the consent. Your own links say so instead.
 */
export function InviteScreen() {
  const {code: rawCode} =
    useRoute<RouteProp<AllNavigatorParams, 'Invite'>>().params
  const code = (rawCode ?? '').toLowerCase()
  const isValid = isInviteCode(code)
  const links = useInviteLinks()
  const own = links?.find(x => x.id === code)
  const [answer, setAnswer] = useState<Answer>('loading')
  const [attempt, setAttempt] = useState(0)

  const shouldFetch = isValid && links !== undefined && !own
  useEffect(() => {
    if (!shouldFetch) return
    let isCurrent = true
    setAnswer('loading')
    void directory.openInvite(code).then(a => {
      if (isCurrent) setAnswer(a)
    })
    return () => {
      isCurrent = false
    }
  }, [shouldFetch, code, attempt])

  return (
    <Layout.Screen testID="screen-invite">
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Invite</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content contentContainerStyle={[a.flex_1]}>
        <View style={[a.flex_1, a.align_center, a.justify_center, a.px_lg, a.py_4xl]}>
          {!isValid || answer === 'not-found' || (typeof answer === 'object' && answer.group?.joinPolicy === 'invite') ? (
            /* An invite-only group has no working link (owner 196). */
            <Broken />
          ) : links === undefined ? (
            <Loader size="xl" />
          ) : own ? (
            <OwnLink code={code} />
          ) : answer === 'loading' ? (
            <Loader size="xl" />
          ) : answer === 'unavailable' ? (
            <Unavailable onRetry={() => setAttempt(n => n + 1)} />
          ) : (
            <Preview code={code} preview={answer} />
          )}
        </View>
      </Layout.Content>
    </Layout.Screen>
  )
}

/** Bluesky's join card: logo, a raised rounded card, its content centred. */
function Card({children, testID}: {children: React.ReactNode; testID: string}) {
  const t = useTheme()
  const {gtMobile} = useBreakpoints()
  const shouldReduceMotion = useShouldReduceMotion()
  return (
    <Animated.View
      testID={testID}
      entering={shouldReduceMotion ? undefined : FadeIn.duration(220)}
      style={[a.w_full, a.align_center, a.gap_2xl, {maxWidth: 400}]}>
      <LogoMark size={44} />
      <View
        style={[
          a.w_full,
          a.align_center,
          a.gap_lg,
          gtMobile ? a.p_2xl : a.p_xl,
          a.border,
          t.atoms.bg,
          t.atoms.border_contrast_low,
          t.atoms.shadow_lg,
          {borderRadius: 32},
        ]}>
        {children}
      </View>
    </Animated.View>
  )
}

function Preview({code, preview}: {code: string; preview: InvitePreview}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const people = useEntities<Person>('person')
  const [isSaving, setIsSaving] = useState(false)
  const busy = useRef(false)
  const {inviter} = preview
  const existing = people?.find(p => p.data.accountId === inviter.accountId)

  const accept = async () => {
    if (busy.current) return
    busy.current = true
    setIsSaving(true)
    try {
      if (preview.kind === 'group' && preview.group) {
        // The group's rule decides (owner 196): "Anyone with the link" joins at once, "I approve each join" asks.
        const snapshot = {groupId: preview.group.id, groupName: preview.groupName ?? '', groupKind: preview.group.kind, groupCurrency: preview.group.currency, groupJoinPolicy: preview.group.joinPolicy}
        if (linkOutcome(preview.group) === 'join') {
          const group = await joinGroupViaLink(store, ctx, {...snapshot, inviter, code})
          await directory.accept(code)
          haptics.success()
          Toast.show(l`You joined ${snapshot.groupName}`, {type: 'success'})
          navigation.replace('Group', {groupId: group.id})
          return
        }
        await requestToJoin(store, ctx, {...snapshot, admin: inviter})
        await directory.accept(code)
        haptics.success()
        Toast.show(l`Request sent. An admin of ${snapshot.groupName} will answer it.`, {type: 'success'})
        navigation.navigate('Groups')
        return
      }
      if (preview.kind === 'group') {
        const delivery = await directory.accept(code)
        Toast.show(
          delivery === 'sent'
            ? l`Request sent. You’ll see ${preview.groupName ?? ''} once you’re in.`
            : l`Saved. We’ll send it when you’re online.`,
          {type: 'success'},
        )
        navigation.navigate('Groups')
        return
      }
      const person = await acceptInvite(store, ctx, {code, inviter})
      await directory.accept(code)
      haptics.success()
      Toast.show(l`You and ${inviter.name} are friends now`, {type: 'success'})
      navigation.replace('Person', {personId: person.id})
    } catch (e) {
      haptics.error()
      logger.error(e, {where: 'Invite.accept'})
      Toast.show(l`Couldn’t accept the invite. Please try again.`, {type: 'error'})
    } finally {
      busy.current = false
      setIsSaving(false)
    }
  }

  return (
    <Card testID="invite-preview">
      <UserAvatar size={88} name={inviter.name} type="user" />
      <View style={[a.gap_xs, a.align_center]}>
        <Text style={[a.text_xs, a.font_semi_bold, t.atoms.text_contrast_medium, {letterSpacing: 0.6}]}>
          {preview.kind === 'group' ? (
            <Trans>GROUP INVITE</Trans>
          ) : (
            <Trans>FRIEND INVITE</Trans>
          )}
        </Text>
        <Text emoji style={[a.text_2xl, a.font_bold, a.text_center, a.leading_tight]}>
          {inviter.name}
        </Text>
        <Text style={[a.text_md, a.text_center, a.leading_snug, t.atoms.text_contrast_high]}>
          {preview.kind === 'group' ? (
            <Trans>invited you to join {preview.groupName}</Trans>
          ) : (
            <Trans>invited you to be friends on Splito</Trans>
          )}
        </Text>
      </View>
      {existing && preview.kind === 'friend' ? (
        <>
          <Text style={[a.text_sm, a.text_center, t.atoms.text_contrast_medium]}>
            <Trans>You’re already friends.</Trans>
          </Text>
          <Button
            testID="invite-open-friend"
            label={l`Open ${existing.data.name}`}
            size="large"
            color="primary"
            style={[a.w_full]}
            onPress={() => navigation.replace('Person', {personId: existing.id})}>
            <ButtonText>
              <Trans>Open</Trans>
            </ButtonText>
          </Button>
        </>
      ) : (
        <>
          <Text style={[a.text_sm, a.text_center, a.leading_snug, t.atoms.text_contrast_medium]}>
            {preview.kind === 'group' ? (
              preview.group?.joinPolicy === 'approve' ? (
                <Trans>An admin approves each join. Ask to join and you’ll hear back.</Trans>
              ) : (
                <Trans>Accept to see the group’s expenses and split with its members.</Trans>
              )
            ) : (
              <Trans>Accept to split expenses with {inviter.name}. You’ll both see what you share.</Trans>
            )}
          </Text>
          <View style={[a.w_full, a.gap_sm]}>
            <Button
              testID="invite-accept"
              label={l`Accept invite`}
              size="large"
              color="primary"
              disabled={isSaving}
              onPress={() => void accept()}>
              <ButtonText>
                {preview.group?.joinPolicy === 'approve' ? <Trans>Ask to join</Trans> : <Trans>Accept</Trans>}
              </ButtonText>
            </Button>
            <Button
              testID="invite-decline"
              label={l`Decline invite`}
              size="large"
              color="secondary"
              disabled={isSaving}
              onPress={() => {
                Toast.show(l`Invite declined`)
                navigation.navigate(startPage() as never)
              }}>
              <ButtonText>
                <Trans>Decline</Trans>
              </ButtonText>
            </Button>
          </View>
        </>
      )}
    </Card>
  )
}

function OwnLink({code}: {code: string}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const links = useInviteLinks()
  const now = useTickEveryMinute()
  const describe = useDescribeLink()
  const link = links?.find(x => x.id === code)
  return (
    <Card testID="invite-own">
      <Text style={[a.text_xl, a.font_bold, a.text_center]}>
        <Trans>This is your invite link</Trans>
      </Text>
      {link ? (
        <Text style={[a.text_md, a.text_center, t.atoms.text_contrast_medium]}>
          {describe(link.data, now)}
        </Text>
      ) : null}
      <Button
        label={l`Manage invite links`}
        size="large"
        color="primary"
        style={[a.w_full]}
        onPress={() => navigation.replace('InviteLinks')}>
        <ButtonText>
          <Trans>Manage invite links</Trans>
        </ButtonText>
      </Button>
    </Card>
  )
}

function Broken() {
  const t = useTheme()
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  return (
    <Card testID="invite-broken">
      <BrokenLinkIcon size="3xl" fill={t.palette.primary_500} />
      <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
        <Trans>This invite link no longer works</Trans>
      </Text>
      <Text style={[a.text_sm, a.text_center, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>It may have expired, been used up or revoked. Ask for a new one.</Trans>
      </Text>
      <Button
        label={l`Go to People`}
        size="large"
        color="secondary"
        style={[a.w_full]}
        onPress={() => navigation.navigate('People')}>
        <ButtonText>
          <Trans>Go to People</Trans>
        </ButtonText>
      </Button>
    </Card>
  )
}

function Unavailable({onRetry}: {onRetry: () => void}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <Card testID="invite-unavailable">
      <Text style={[a.text_lg, a.font_semi_bold, a.text_center]}>
        <Trans>Can’t open this invite yet</Trans>
      </Text>
      <Text style={[a.text_sm, a.text_center, a.leading_snug, t.atoms.text_contrast_medium]}>
        <Trans>
          Opening an invite needs a connection to Splito. Try again once you’re
          online.
        </Trans>
      </Text>
      <Button
        label={l`Try again`}
        size="large"
        color="secondary"
        style={[a.w_full]}
        onPress={onRetry}>
        <ButtonText>
          <Trans>Try again</Trans>
        </ButtonText>
      </Button>
    </Card>
  )
}
