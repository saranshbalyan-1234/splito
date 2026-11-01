// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/components/contacts/screens/GetContacts.tsx (permission primer, denied state) and src/components/contacts/screens/PhoneInput.tsx (one field, live validation)
import {useEffect, useRef, useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {
  type Contact,
  contactKey,
  detectContactKind,
  DomainError,
} from '@splito/domain'
import {
  createPerson,
  formatContact,
  parseContact,
  type Entity,
  type InviteLink,
  INVITE_EXPIRY_MS,
  isRemovedFriend,
  type Lookup,
  type Person,
  restoreFriend,
  sendFriendRequest,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {
  deviceRegion,
  directory,
  inviteUrl,
  makeInviteLink,
} from '#/data/friends'
import {
  useEntities,
  useMutationCtx,
  usePendingRequests,
  usePref,
  useStore,
} from '#/data/hooks'
import {useDemoMode} from '#/state/demo'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as FormSheet from '#/components/FormSheet'
import * as TextField from '#/components/forms/TextField'
import {CircleCheck_Stroke2_Corner0_Rounded as CheckIcon} from '#/components/icons/CircleCheck'
import {
  Contacts_Stroke2_Corner0_Rounded as ContactsIcon,
  Envelope_Stroke2_Corner0_Rounded as MailIcon,
  Phone_Stroke2_Corner0_Rounded as PhoneIcon,
  QrCode_Stroke2_Corner0_Rounded as QrIcon,
  Shield_Stroke2_Corner0_Rounded as ShieldIcon,
} from '#/components/icons/Invite'
import {Person_Stroke2_Corner2_Rounded as PersonIcon} from '#/components/icons/Person'
import {InviteShare} from '#/components/invites/InviteShare'
import {Loader} from '#/components/Loader'
import {AvatarPreview} from '#/components/people/AvatarPreview'
import {
  canPickContacts,
  contactsPermission,
  openContactsSettings,
  type PickedContact,
  pickContact,
  requestContactsPermission,
} from '#/components/people/contactPicker'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {AnimatedListRow} from '#/motion/listAnimations'

/** How long typing must pause before the directory is asked (it is rate-limited server-side). */
const LOOKUP_DEBOUNCE_MS = 350

type Step =
  | {name: 'form'}
  | {name: 'primer'; isDenied: boolean}
  | {name: 'pickValue'; contact: PickedContact; options: Contact[]}
  | {name: 'invited'; link: Entity<InviteLink>; to: Contact; shownName: string}

/** What we know about the typed contact. */
type Check =
  | {state: 'empty'}
  | {state: 'invalid'}
  | {state: 'friend'; person: Entity<Person>}
  | {state: 'removed'; person: Entity<Person>}
  | {state: 'requested'}
  | {state: 'local'}
  | {state: 'checking'}
  | {state: Lookup}

/**
 * Add friend (26.18). With no directory (no backend yet) it is a plain form:
 * a required name first, an optional email or number, and "Choose from
 * contacts"; Add friend makes a normal local friend, usable at once (F-275).
 * With a directory (demo mode today) it is one "Email or mobile number"
 * field, an optional name and the contacts button; Splito checks the
 * directory as soon as the value is valid: on Splito -> send a friend request
 * (they must accept); not on Splito -> a warning with Send invite and "Add
 * anyway (only for you)". One sheet: contacts, the primer and the invite are
 * steps inside it, never a second modal (section 4).
 */
export function AddFriendScreen() {
  const t = useTheme()
  const {t: l} = useLingui()
  const {gtMobile} = useBreakpoints()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const people = useEntities<Person>('person')
  const {outgoing} = usePendingRequests()
  const [inviteExpiry = '7d'] = usePref('invites.defaultExpiry')
  const [region] = useState(deviceRegion)
  const {hasDirectory: isDirectory} = useDemoMode()
  const [raw, setRaw] = useState('')
  const [name, setName] = useState('')
  const [isBlurred, setIsBlurred] = useState(false)
  const [lookup, setLookup] = useState<{key: string; result: Lookup} | null>(
    null,
  )
  const [step, setStep] = useState<Step>({name: 'form'})
  const [isSaving, setIsSaving] = useState(false)
  const busy = useRef(false)

  const contact = parseContact(raw, region)
  const key = contact ? contactKey(contact) : null
  const kind = detectContactKind(raw)
  const friend = key
    ? people?.find(
        p =>
          !p.data.isMe &&
          p.data.accountId &&
          p.data.contact &&
          contactKey(p.data.contact) === key,
      )
    : undefined
  const isRequested =
    !!key &&
    outgoing.some(r => r.data.contact && contactKey(r.data.contact) === key)
  const check: Check = !raw.trim()
    ? {state: 'empty'}
    : !contact
      ? {state: 'invalid'}
      : !isDirectory
        ? {state: 'local'}
        : friend
        ? {state: isRemovedFriend(friend.data) ? 'removed' : 'friend', person: friend}
        : isRequested
          ? {state: 'requested'}
          : lookup?.key === key
            ? {state: lookup.result}
            : {state: 'checking'}

  /* Ask the directory once typing settles; a newer value wins. */
  const needsLookup = check.state === 'checking' && key !== null
  useEffect(() => {
    if (!needsLookup || !key) return
    let isCurrent = true
    const timer = setTimeout(() => {
      void directory.lookup(contactFromKey(key)).then(result => {
        if (isCurrent) setLookup({key, result})
      })
    }, LOOKUP_DEBOUNCE_MS)
    return () => {
      isCurrent = false
      clearTimeout(timer)
    }
  }, [needsLookup, key])

  const shownName = name.trim() || (contact ? formatContact(contact) : '')
  const isDirty = raw.trim() !== '' || name.trim() !== ''

  const close = () => {
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('People')
  }

  /* One write at a time from the first tap (section 10, single flight). */
  const run = async (what: string, fn: () => Promise<void>) => {
    if (busy.current) return
    busy.current = true
    setIsSaving(true)
    try {
      await fn()
    } catch (e) {
      haptics.error()
      if (e instanceof DomainError && e.code === 'INVALID_NAME')
        Toast.show(l`Enter a name or an email or number.`, {type: 'error'})
      else {
        logger.error(e, {where: `AddFriend.${what}`})
        Toast.show(l`Couldn’t add your friend. Please try again.`, {
          type: 'error',
        })
      }
    } finally {
      busy.current = false
      setIsSaving(false)
    }
  }

  const addPrivately = () =>
    run('addPrivately', async () => {
      const person = await createPerson(store, ctx, {name, contact})
      haptics.success()
      Toast.show(l`${person.data.name} added, only for you`, {
        type: 'success',
      })
      close()
      navigation.navigate('Person', {personId: person.id})
    })

  const sendRequest = (reach: 'on-splito' | 'unchecked') =>
    run('sendRequest', async () => {
      if (!contact) return
      const r = await sendFriendRequest(store, ctx, {contact, name, reach})
      const delivery = await directory.sendRequest(r.id)
      haptics.success()
      Toast.show(
        delivery === 'sent'
          ? l`Friend request sent to ${shownName}`
          : l`Saved. We’ll check and send it when you’re online.`,
        {type: 'success'},
      )
      close()
    })

  const sendInvite = () =>
    run('sendInvite', async () => {
      if (!contact) return
      const link = await makeInviteLink(store, ctx, {
        kind: 'friend',
        groupId: null,
        maxUses: 1,
        expiresInMs: INVITE_EXPIRY_MS[inviteExpiry],
        approveJoins: false,
      })
      if (link === 'unavailable') {
        Toast.show(
          l`Invites need a connection. Try again when you’re online.`,
          {
            type: 'error',
          },
        )
        return
      }
      await sendFriendRequest(store, ctx, {
        contact,
        name,
        reach: 'invited',
        inviteCode: link.id,
      })
      haptics.success()
      setStep({name: 'invited', link, to: contact, shownName})
    })

  const applyContact = (c: Contact, picked: PickedContact) => {
    setRaw(formatContact(c))
    if (!name.trim() && picked.name) setName(picked.name)
    setIsBlurred(true)
    setStep({name: 'form'})
  }

  const openPicker = async () => {
    const picked = await pickContact().catch(e => {
      logger.error(e, {where: 'AddFriend.pickContact'})
      return null
    })
    if (!picked) return
    const options = uniqueContacts(picked, region)
    if (options.length === 0) {
      Toast.show(
        picked.name
          ? l`${picked.name} has no email or mobile number.`
          : l`This contact has no email or mobile number.`,
      )
    } else if (options.length === 1) {
      applyContact(options[0]!, picked)
    } else {
      setStep({name: 'pickValue', contact: picked, options})
    }
  }

  const chooseFromContacts = async () => {
    const permission = await contactsPermission()
    if (permission === 'granted') return openPicker()
    setStep({name: 'primer', isDenied: permission === 'denied'})
  }

  const footer: FormSheet.FooterProps | undefined = (() => {
    if (step.name === 'primer') {
      return step.isDenied
        ? {
            saveLabel: l`Open Settings`,
            cancelLabel: l`Back`,
            onCancel: () => setStep({name: 'form'}),
            onSave: openContactsSettings,
          }
        : {
            saveLabel: l`Continue`,
            cancelLabel: l`Not now`,
            onCancel: () => setStep({name: 'form'}),
            onSave: () =>
              void requestContactsPermission().then(granted => {
                setStep(
                  granted ? {name: 'form'} : {name: 'primer', isDenied: true},
                )
                if (granted) void openPicker()
              }),
          }
    }
    if (step.name === 'pickValue') return undefined
    if (step.name === 'invited')
      return {
        saveLabel: l`Done`,
        cancelLabel: l`Add another`,
        onCancel: () => {
          setRaw('')
          setName('')
          setIsBlurred(false)
          setStep({name: 'form'})
        },
        onSave: close,
      }
    if (!isDirectory)
      return {
        saveLabel: l`Add friend`,
        canSave: name.trim() !== '' && check.state !== 'invalid',
        isSaving,
        onSave: () => void addPrivately(),
      }
    switch (check.state) {
      case 'empty':
        return {
          saveLabel: l`Add friend`,
          canSave: name.trim() !== '',
          isSaving,
          onSave: () => void addPrivately(),
        }
      case 'not-on-splito':
        return {
          saveLabel: l`Send invite`,
          isSaving,
          onSave: () => void sendInvite(),
        }
      case 'unavailable':
      case 'on-splito':
        return {
          // Phones: the long label would wrap in a half-width footer button (section 4).
          saveLabel: gtMobile ? l`Send friend request` : l`Send request`,
          isSaving,
          onSave: () =>
            void sendRequest(
              check.state === 'on-splito' ? 'on-splito' : 'unchecked',
            ),
        }
      default:
        return {
          saveLabel: gtMobile ? l`Send friend request` : l`Send request`,
          canSave: false,
          onSave: () => {},
        }
    }
  })()

  const reason =
    step.name === 'form' && check.state === 'invalid' && isBlurred ? (
      <Text
        testID="add-friend-reason"
        style={[a.pb_sm, a.text_sm, {color: t.palette.negative_500}]}>
        {kind === 'email' ? (
          <Trans>Enter a full email address, like name@example.com.</Trans>
        ) : (
          <Trans>
            Enter a mobile number with its country code, like +91 98765 43210.
          </Trans>
        )}
      </Text>
    ) : undefined

  const nameField = (
    <View>
      <TextField.LabelText>
        {isDirectory ? <Trans>Name (optional)</Trans> : <Trans>Name</Trans>}
      </TextField.LabelText>
      <TextField.Root>
        <TextField.Icon icon={PersonIcon} />
        <TextField.Input
          testID="add-friend-name"
          label={l`Name`}
          value={name}
          onChangeText={setName}
          placeholder={l`What you call them, e.g. Riya`}
          autoCapitalize="words"
          autoFocus={!isDirectory}
          maxLength={64}
        />
      </TextField.Root>
    </View>
  )

  return (
    <FormSheet.Screen
      testID="screen-add-friend"
      title={
        step.name === 'invited'
          ? l`Invite ${step.shownName}`
          : step.name === 'pickValue'
            ? l`Choose one`
            : l`Add friend`
      }
      closeHint={l`Closes without adding anyone`}
      isDirty={isDirty && !isSaving && step.name === 'form'}
      onClose={close}
      discardDescription={l`What you typed won’t be kept.`}
      readout={reason}
      footer={footer}>
      {step.name === 'primer' ? (
        <ContactsPrimer isDenied={step.isDenied} />
      ) : step.name === 'pickValue' ? (
        <PickValue
          contact={step.contact}
          options={step.options}
          onPick={c => applyContact(c, step.contact)}
          onBack={() => setStep({name: 'form'})}
        />
      ) : step.name === 'invited' ? (
        <View style={[a.px_lg, a.pt_md, a.gap_lg]} testID="add-friend-invited">
          <Text style={[a.text_md, a.leading_snug, t.atoms.text_contrast_high]}>
            <Trans>
              Your personal invite is ready. When {step.shownName} joins with
              it, you’re friends straight away. It works once and is listed
              under Invites sent.
            </Trans>
          </Text>
          <InviteShare
            url={inviteUrl(step.link.id)}
            to={step.to}
            subject={l`Join me on Splito`}
            message={l`Join me on Splito so we can split expenses:`}
          />
        </View>
      ) : (
        <View style={[a.px_lg, a.pt_md, a.gap_lg]}>
          <View style={[a.flex_row, a.align_center, a.gap_md]}>
            <AvatarPreview name={shownName} type="user" size={56} />
            <View style={[a.flex_1, a.gap_2xs]}>
              <Text style={[a.text_xl, a.font_bold, a.leading_tight]}>
                {isDirectory ? (
                  <Trans>Add by email or number</Trans>
                ) : (
                  <Trans>Add a friend</Trans>
                )}
              </Text>
              <Text
                style={[
                  a.text_sm,
                  a.leading_snug,
                  t.atoms.text_contrast_medium,
                ]}>
                {isDirectory ? (
                  <Trans>
                    They get a request to accept. Once they do, you can split
                    anything together.
                  </Trans>
                ) : (
                  <Trans>
                    Add their name and split right away. Only you see them for
                    now.
                  </Trans>
                )}
              </Text>
            </View>
          </View>

          {isDirectory ? null : nameField}

          <View>
            <TextField.LabelText>
              {isDirectory ? (
                <Trans>Email or mobile number</Trans>
              ) : (
                <Trans>Email or mobile number (optional)</Trans>
              )}
            </TextField.LabelText>
            <TextField.Root isInvalid={check.state === 'invalid' && isBlurred}>
              <TextField.Icon icon={kind === 'phone' ? PhoneIcon : MailIcon} />
              <TextField.Input
                testID="add-friend-contact"
                label={l`Email or mobile number`}
                value={raw}
                onChangeText={v => {
                  setRaw(v)
                  setIsBlurred(false)
                }}
                onBlur={() => setIsBlurred(true)}
                placeholder={l`name@example.com or +91 98765 43210`}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                autoFocus={isDirectory}
                maxLength={254}
                returnKeyType="next"
              />
            </TextField.Root>
            {canPickContacts() ? (
              <Button
                testID="add-friend-contacts"
                label={l`Choose from contacts`}
                size="small"
                color="secondary"
                variant="ghost"
                style={[a.self_start, a.mt_sm, {marginLeft: -8}]}
                onPress={() => void chooseFromContacts()}>
                <ButtonIcon icon={ContactsIcon} />
                <ButtonText>
                  <Trans>Choose from contacts</Trans>
                </ButtonText>
              </Button>
            ) : null}
          </View>

          {isDirectory ? nameField : null}

          {/* Each new answer fades in and the old one out; neither runs while the sheet itself closes (the exit scope, owner 189). */}
          {isDirectory ? (
            <AnimatedListRow
              key={check.state}
              testID={`add-friend-status-${check.state}`}>
              <Status
                check={check}
                value={contact ? formatContact(contact) : raw.trim()}
                isSaving={isSaving}
                onAddAnyway={() => void addPrivately()}
                onOpenFriend={personId => {
                  close()
                  navigation.navigate('Person', {personId})
                }}
                onAddBack={personId =>
                  void restoreFriend(store, ctx, personId).then(
                    () => {
                      haptics.success()
                      close()
                      navigation.navigate('Person', {personId})
                    },
                    () =>
                      Toast.show(l`Couldn’t add them back. Please try again.`, {
                        type: 'error',
                      }),
                  )
                }
              />
            </AnimatedListRow>
          ) : null}

          {/* Invite links need the server (they fail closed offline), so they are not offered until there is one. */}
          {isDirectory ? (
            <SettingsList.Container>
              <SettingsList.PressableItem
                testID="add-friend-invite-link"
                label={l`Invite with a link or QR code`}
                contentContainerStyle={[a.px_0]}
                onPress={() =>
                  navigation.replace('CreateInvite', {kind: 'friend'})
                }>
                <SettingsList.ItemIcon icon={QrIcon} />
                <SettingsList.ItemText>
                  <Trans>Invite link or QR code</Trans>
                </SettingsList.ItemText>
                <SettingsList.Chevron />
              </SettingsList.PressableItem>
            </SettingsList.Container>
          ) : null}
        </View>
      )}
    </FormSheet.Screen>
  )
}

/** The live result under the fields. */
function Status({
  check,
  value,
  isSaving,
  onAddAnyway,
  onOpenFriend,
  onAddBack,
}: {
  check: Check
  value: string
  isSaving: boolean
  onAddAnyway: () => void
  onOpenFriend: (personId: string) => void
  onAddBack: (personId: string) => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const addAnyway = (
    <Admonition.Button
      testID="add-friend-add-anyway"
      label={l`Add anyway, only for you`}
      color="secondary"
      disabled={isSaving}
      onPress={onAddAnyway}>
      <ButtonText>
        <Trans>Add anyway (only for you)</Trans>
      </ButtonText>
    </Admonition.Button>
  )
  switch (check.state) {
    case 'empty':
      return (
        <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>
            No email or number? Add just a name and they’re only for you.
          </Trans>
        </Text>
      )
    case 'invalid':
    case 'local':
      return null
    case 'checking':
      return (
        <View style={[a.flex_row, a.align_center, a.gap_sm, a.py_xs]}>
          <Loader size="sm" />
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Checking Splito…</Trans>
          </Text>
        </View>
      )
    case 'on-splito':
      return (
        <Admonition.Outer type="tip">
          <Admonition.Row>
            <CheckIcon size="md" fill={t.palette.primary_500} />
            <Admonition.Content>
              <Admonition.Text>
                <Trans>
                  <Text style={[a.font_semi_bold]}>{value}</Text> is on Splito.
                  They’ll get your friend request to accept.
                </Trans>
              </Admonition.Text>
            </Admonition.Content>
          </Admonition.Row>
        </Admonition.Outer>
      )
    case 'not-on-splito':
      return (
        <Admonition.Outer type="warning">
          <Admonition.Row>
            <Admonition.Icon />
            <Admonition.Content>
              <Admonition.Text>
                <Trans>
                  <Text style={[a.font_semi_bold]}>{value}</Text> isn’t on
                  Splito yet. Send an invite, or add them just for you and link
                  them when they join.
                </Trans>
              </Admonition.Text>
              <View style={[a.flex_row]}>{addAnyway}</View>
            </Admonition.Content>
          </Admonition.Row>
        </Admonition.Outer>
      )
    case 'unavailable':
      return (
        <Admonition.Outer type="info">
          <Admonition.Row>
            <Admonition.Icon />
            <Admonition.Content>
              <Admonition.Text>
                <Trans>
                  We’ll check when you’re online. Your request waits on this
                  device until then.
                </Trans>
              </Admonition.Text>
              <View style={[a.flex_row]}>{addAnyway}</View>
            </Admonition.Content>
          </Admonition.Row>
        </Admonition.Outer>
      )
    case 'friend':
      return (
        <Admonition.Outer type="info">
          <Admonition.Row>
            <Admonition.Icon />
            <Admonition.Content>
              <Admonition.Text>
                <Trans>{check.person.data.name} is already your friend.</Trans>
              </Admonition.Text>
              <View style={[a.flex_row]}>
                <Admonition.Button
                  label={l`Open ${check.person.data.name}`}
                  color="secondary"
                  onPress={() => onOpenFriend(check.person.id)}>
                  <ButtonText>
                    <Trans>Open</Trans>
                  </ButtonText>
                </Admonition.Button>
              </View>
            </Admonition.Content>
          </Admonition.Row>
        </Admonition.Outer>
      )
    case 'removed':
      return (
        <Admonition.Outer type="info">
          <Admonition.Row>
            <Admonition.Icon />
            <Admonition.Content>
              <Admonition.Text>
                <Trans>You removed {check.person.data.name}. Their history is still here.</Trans>
              </Admonition.Text>
              <View style={[a.flex_row]}>
                <Admonition.Button
                  testID="add-friend-add-back"
                  label={l`Add ${check.person.data.name} back`}
                  color="primary"
                  onPress={() => onAddBack(check.person.id)}>
                  <ButtonText>
                    <Trans>Add back</Trans>
                  </ButtonText>
                </Admonition.Button>
              </View>
            </Admonition.Content>
          </Admonition.Row>
        </Admonition.Outer>
      )
    case 'requested':
      return (
        <Admonition.Admonition type="info">
          <Trans>
            You’ve already asked {value}. It’s under Invites sent on People,
            where you can resend it.
          </Trans>
        </Admonition.Admonition>
      )
  }
}

/** F-216: say why before the OS asks; after a refusal, point to Settings. */
function ContactsPrimer({isDenied}: {isDenied: boolean}) {
  const t = useTheme()
  return (
    <View
      testID="add-friend-primer"
      style={[a.px_lg, a.pt_xl, a.gap_lg, a.align_center]}>
      <View
        style={[
          a.align_center,
          a.justify_center,
          a.rounded_full,
          {width: 72, height: 72, backgroundColor: t.palette.primary_50},
        ]}>
        <ContactsIcon size="2xl" fill={t.palette.primary_500} />
      </View>
      <Text style={[a.text_2xl, a.font_bold, a.text_center, a.leading_tight]}>
        {isDenied ? (
          <Trans>Allow access to contacts</Trans>
        ) : (
          <Trans>Pick a friend from your contacts</Trans>
        )}
      </Text>
      <Text
        style={[
          a.text_md,
          a.leading_snug,
          a.text_center,
          t.atoms.text_contrast_medium,
        ]}>
        {isDenied ? (
          <Trans>
            Splito can’t open your contacts. Turn on Contacts for Splito in
            Settings, then come back.
          </Trans>
        ) : (
          <Trans>
            Your phone will ask to let Splito open your contacts. You pick one
            person; only the email or number you choose is used.
          </Trans>
        )}
      </Text>
      <View style={[a.flex_row, a.gap_sm, a.align_center]}>
        <ShieldIcon size="sm" fill={t.atoms.text_contrast_medium.color} />
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Your contact book is never uploaded.</Trans>
        </Text>
      </View>
    </View>
  )
}

/** A contact with several numbers or emails: which one? (26.18) */
function PickValue({
  contact,
  options,
  onPick,
  onBack,
}: {
  contact: PickedContact
  options: Contact[]
  onPick: (c: Contact) => void
  onBack: () => void
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  return (
    <View style={[a.px_lg, a.pt_md, a.gap_md]} testID="add-friend-pick-value">
      <View style={[a.flex_row, a.align_center, a.gap_md]}>
        <UserAvatar size={44} name={contact.name} type="user" />
        <View style={[a.flex_1]}>
          <Text emoji style={[a.text_lg, a.font_semi_bold]} numberOfLines={1}>
            {contact.name}
          </Text>
          <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
            <Trans>Which one should Splito use?</Trans>
          </Text>
        </View>
      </View>
      <SettingsList.Container>
        {options.map((c, i) => (
          <SettingsList.PressableItem
            key={contactKey(c)}
            testID={`contact-value-${i}`}
            label={l`Use ${formatContact(c)}`}
            contentContainerStyle={[a.px_0]}
            onPress={() => onPick(c)}>
            <SettingsList.ItemIcon
              icon={c.kind === 'phone' ? PhoneIcon : MailIcon}
            />
            <SettingsList.ItemText>{formatContact(c)}</SettingsList.ItemText>
            <SettingsList.Chevron />
          </SettingsList.PressableItem>
        ))}
      </SettingsList.Container>
      <Button
        testID="add-friend-pick-back"
        label={l`Back`}
        size="small"
        color="secondary"
        variant="ghost"
        style={[a.self_start]}
        onPress={onBack}>
        <ButtonText>
          <Trans>Back</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}

/** The contact a `contactKey` names (keys are `kind:value`). */
function contactFromKey(key: string): Contact {
  const i = key.indexOf(':')
  return {kind: key.slice(0, i) as Contact['kind'], value: key.slice(i + 1)}
}

/** Every valid, distinct email and number on a picked contact. */
function uniqueContacts(picked: PickedContact, region: string): Contact[] {
  const seen = new Set<string>()
  return picked.values.flatMap(v => {
    const c = parseContact(v.raw, region)
    if (!c || seen.has(contactKey(c))) return []
    seen.add(contactKey(c))
    return [c]
  })
}
