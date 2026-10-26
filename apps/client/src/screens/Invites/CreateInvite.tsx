// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/screens/Messages/components/InviteLinkDialog.tsx (Step.GENERATE -> Step.MANAGE)
import {useRef, useState} from 'react'
import {View} from 'react-native'
import Animated, {FadeIn} from 'react-native-reanimated'
import {Trans, useLingui} from '@lingui/react/macro'
import {type RouteProp, useNavigation, useRoute} from '@react-navigation/native'
import {
  type Group,
  type InviteExpiry,
  INVITE_EXPIRY_MS,
  type InviteLink,
  type InviteMaxUses,
  offlineDirectory,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type AllNavigatorParams, type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {directory, inviteUrl, makeInviteLink} from '#/data/friends'
import {useEntities, useInviteLinks, useMutationCtx, usePref, useStore} from '#/data/hooks'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {Admonition} from '#/components/Admonition'
import * as FormSheet from '#/components/FormSheet'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import * as Toggle from '#/components/forms/Toggle'
import {ChainLink_Stroke2_Corner0_Rounded as LinkIcon} from '#/components/icons/Invite'
import {useDescribeLink} from '#/components/invites/describe'
import {InviteShare} from '#/components/invites/InviteShare'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {useTickEveryMinute} from '#/state/shell/tick-every-minute'
import {useShouldReduceMotion} from '#/motion/useShouldReduceMotion'

const USES: InviteMaxUses[] = [1, 5, 25, 'unlimited']
const EXPIRIES: InviteExpiry[] = ['24h', '7d', '30d', 'never']

/**
 * The invite link / QR sheet (26.18): choose max uses, expiry and (groups)
 * "approve each join", then Create; the sheet turns into the QR code, the
 * link with Copy, and Share. `ShareInvite` opens it on an existing link.
 */
export function CreateInviteScreen() {
  const {t: l} = useLingui()
  const t = useTheme()
  const navigation = useNavigation<NavigationProp>()
  const route = useRoute<
    RouteProp<AllNavigatorParams, 'CreateInvite' | 'ShareInvite'>
  >()
  const params = (route.params ?? {}) as {
    kind?: 'friend' | 'group'
    groupId?: string
    code?: string
  }
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const shouldReduceMotion = useShouldReduceMotion()
  const now = useTickEveryMinute()
  const describe = useDescribeLink()
  const links = useInviteLinks()
  const groups = useEntities<Group>('group')
  const [createdCode, setCreatedCode] = useState<string | null>(null)
  const code = params.code ?? createdCode
  const link = code ? links?.find(x => x.id === code)?.data : undefined
  const kind: InviteLink['kind'] = link?.kind ?? (params.groupId ? 'group' : (params.kind ?? 'friend'))
  const groupId = link?.groupId ?? params.groupId ?? null
  const group = groupId ? groups?.find(g => g.id === groupId) : undefined

  const [defaultUses] = usePref(kind === 'group' ? 'invites.defaultMaxUses.group' : 'invites.defaultMaxUses.friend')
  const [defaultExpiry] = usePref('invites.defaultExpiry')
  const [uses, setUses] = useState<InviteMaxUses | null>(null)
  const [expiry, setExpiry] = useState<InviteExpiry | null>(null)
  const [defaultApproveJoins = false] = usePref('invites.approveJoins')
  const [approveJoinsChoice, setApproveJoins] = useState<boolean | null>(null)
  const approveJoins = approveJoinsChoice ?? defaultApproveJoins
  const [isSaving, setIsSaving] = useState(false)
  const busy = useRef(false)
  const chosenUses = uses ?? defaultUses ?? (kind === 'group' ? 25 : 1)
  const chosenExpiry = expiry ?? defaultExpiry ?? '7d'
  /* Invite links need the server (section 10: they fail closed, never a made-up URL). */
  const isLinkAvailable = directory !== offlineDirectory

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('People')
  }

  const create = async () => {
    if (busy.current) return
    busy.current = true
    setIsSaving(true)
    try {
      const made = await makeInviteLink(store, ctx, {
        kind,
        groupId,
        maxUses: chosenUses === 'unlimited' ? null : chosenUses,
        expiresInMs: INVITE_EXPIRY_MS[chosenExpiry],
        approveJoins: kind === 'group' && approveJoins,
      })
      if (made === 'unavailable') {
        Toast.show(l`Invite links need a connection. Try again when you’re online.`, {type: 'error'})
        return
      }
      haptics.success()
      setCreatedCode(made.id)
    } catch (e) {
      haptics.error()
      logger.error(e, {where: 'CreateInvite.create'})
      Toast.show(l`Couldn’t create the link. Please try again.`, {type: 'error'})
    } finally {
      busy.current = false
      setIsSaving(false)
    }
  }

  const title =
    kind === 'group' && group
      ? l`Invite to ${group.data.name}`
      : l`Invite link`

  if (code) {
    return (
      <FormSheet.Screen
        testID="screen-invite-link"
        title={title}
        isDirty={false}
        onClose={close}
        footer={
          link
            ? {
                saveLabel: l`Done`,
                cancelLabel: l`Manage links`,
                onCancel: () => navigation.replace('InviteLinks'),
                onSave: close,
              }
            : undefined
        }>
        <Animated.View
          entering={shouldReduceMotion ? undefined : FadeIn.duration(200)}
          style={[a.px_lg, a.pt_md, a.gap_lg]}>
          {link ? (
            <>
              <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
                {kind === 'group' ? (
                  <Trans>
                    Anyone with this link or QR code can ask to join. Using it
                    counts as accepting your invite.
                  </Trans>
                ) : (
                  <Trans>
                    Anyone with this link or QR code can become your friend on
                    Splito. Using it counts as accepting.
                  </Trans>
                )}
              </Text>
              <InviteShare
                url={inviteUrl(link.code)}
                subject={l`Join me on Splito`}
                message={
                  kind === 'group' && group
                    ? l`Join ${group.data.name} on Splito:`
                    : l`Join me on Splito so we can split expenses:`
                }
                details={
                  <Text testID="invite-details">{describe(link, now)}</Text>
                }
              />
            </>
          ) : links ? (
            <Admonition type="warning">
              <Trans>This invite link isn’t on this device.</Trans>
            </Admonition>
          ) : null}
        </Animated.View>
      </FormSheet.Screen>
    )
  }

  return (
    <FormSheet.Screen
      testID="screen-create-invite"
      title={title}
      closeHint={l`Closes without making a link`}
      isDirty={false}
      onClose={close}
      footer={{
        saveLabel: l`Create link`,
        canSave: isLinkAvailable,
        isSaving,
        onSave: () => void create(),
      }}>
      <View style={[a.px_lg, a.pt_md, a.gap_xl]}>
        <View style={[a.flex_row, a.align_center, a.gap_md]}>
          <View
            style={[
              a.align_center,
              a.justify_center,
              a.rounded_full,
              {width: 48, height: 48, backgroundColor: t.palette.primary_50},
            ]}>
            <LinkIcon size="lg" fill={t.palette.primary_500} />
          </View>
          <Text style={[a.flex_1, a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
            {kind === 'group' ? (
              <Trans>
                A link and QR code people can use to join this group. You set
                how many people and for how long.
              </Trans>
            ) : (
              <Trans>
                A link and QR code that makes people your friends when they use
                it. You set how many people and for how long.
              </Trans>
            )}
          </Text>
        </View>

        <Choice
          title={l`How many people can use it`}
          testID="invite-uses"
          value={String(chosenUses)}
          options={USES.map(u => ({
            value: String(u),
            label: u === 'unlimited' ? l`No limit` : String(u),
          }))}
          onChange={v =>
            setUses(v === 'unlimited' ? 'unlimited' : (Number(v) as InviteMaxUses))
          }
        />

        <Choice
          title={l`Link expires after`}
          testID="invite-expiry"
          value={chosenExpiry}
          options={EXPIRIES.map(e => ({
            value: e,
            label: {
              '24h': l`1 day`,
              '7d': l`7 days`,
              '30d': l`30 days`,
              never: l`Never`,
            }[e],
          }))}
          onChange={v => setExpiry(v as InviteExpiry)}
        />

        {kind === 'group' ? (
          <Toggle.Item
            type="checkbox"
            testID="invite-approve-joins"
            name="approveJoins"
            label={l`Approve each join`}
            value={approveJoins}
            onChange={setApproveJoins}
            style={[a.w_full, a.gap_md]}>
            <View style={[a.flex_1, a.gap_2xs]}>
              <Toggle.LabelText style={[a.text_md, a.font_semi_bold]}>
                <Trans>Approve each join</Trans>
              </Toggle.LabelText>
              <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
                <Trans>People who use the link wait until you let them in.</Trans>
              </Text>
            </View>
            <Toggle.Platform />
          </Toggle.Item>
        ) : null}

        {isLinkAvailable ? null : (
          <Admonition type="info">
            <Trans>
              Invite links need a connection to Splito’s servers, which arrive
              with sign-in and sync. Until then, add friends by email or
              number, or just by name.
            </Trans>
          </Admonition>
        )}

        <SettingsList.Container>
          <SettingsList.PressableItem
            testID="invite-manage-links"
            label={l`Manage invite links`}
            contentContainerStyle={[a.px_0]}
            onPress={() => navigation.replace('InviteLinks')}>
            <SettingsList.ItemIcon icon={LinkIcon} />
            <SettingsList.ItemText>
              <Trans>Manage invite links</Trans>
            </SettingsList.ItemText>
            <SettingsList.Chevron />
          </SettingsList.PressableItem>
        </SettingsList.Container>
      </View>
    </FormSheet.Screen>
  )
}

/** A titled segmented choice, as the Settings controls show one. */
function Choice({
  title,
  testID,
  value,
  options,
  onChange,
}: {
  title: string
  testID: string
  value: string
  options: Array<{value: string; label: string}>
  onChange: (value: string) => void
}) {
  return (
    <View style={[a.gap_sm]}>
      <Text style={[a.text_md, a.font_semi_bold]}>{title}</Text>
      <SegmentedControl.Root type="radio" label={title} value={value} onChange={onChange}>
        {options.map(o => (
          <SegmentedControl.Item
            key={o.value}
            testID={`${testID}-${o.value}`}
            label={o.label}
            value={o.value}>
            <SegmentedControl.ItemText>{o.label}</SegmentedControl.ItemText>
          </SegmentedControl.Item>
        ))}
      </SegmentedControl.Root>
    </View>
  )
}
