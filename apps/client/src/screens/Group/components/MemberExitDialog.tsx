import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  type CurrencyCode,
  DomainError,
  formatAmount,
  magnitude,
  memberExitChanges,
  memberExitTransfers,
  NO_RULES,
  ZERO,
} from '@splito/domain'
import {
  type Entity,
  type ExitChoice,
  type Group,
  groupAdmins,
  removeGroupMember,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {todayIn} from '#/locale/dates'
import {useTimeZone} from '#/locale/useDates'
import {atoms as a, useTheme} from '#/alf'
import * as Admonition from '#/components/Admonition'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as Toggle from '#/components/forms/Toggle'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'

type Nets = Record<CurrencyCode, Record<string, bigint>>

/**
 * Leave a group (my own row) or remove a member (a friend's row), F-615 and F-613 part 1. A member with a
 * balance picks what happens to it - settle it, call it even, or stay on as an inactive member - and sees every
 * member's balance before and after the choice (the domain's `memberExitChanges`) before anything is written.
 * The last admin names who takes over first. Written in one transaction by `removeGroupMember`.
 */
export function MemberExitDialog({
  control,
  group,
  personId,
  me,
  names,
  nets,
  locale,
}: {
  control: Dialog.DialogControlProps
  group: Entity<Group>
  personId: string | null
  me: string
  names: Map<string, string>
  nets: Nets
  locale: string
}) {
  return (
    <FormSheet.Outer control={control} testID="member-exit-sheet">
      {personId && (
        <Body
          group={group}
          personId={personId}
          me={me}
          names={names}
          nets={nets}
          locale={locale}
        />
      )}
    </FormSheet.Outer>
  )
}

function Body({
  group,
  personId,
  me,
  names,
  nets,
  locale,
}: {
  group: Entity<Group>
  personId: string
  me: string
  names: Map<string, string>
  nets: Nets
  locale: string
}) {
  const t = useTheme()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const tz = useTimeZone()
  const haptics = useHaptics()
  const isMe = personId === me
  const name = (id: string) => (id === me ? l`You` : (names.get(id) ?? l`Someone`))
  const who = name(personId)
  const groupName = group.data.name

  const owed = Object.entries(nets).flatMap(([currency, net]) =>
    (net[personId] ?? ZERO) === ZERO ? [] : [{currency, amount: net[personId]!}],
  )
  const hasBalance = owed.length > 0
  const transfers = memberExitTransfers(
    nets,
    personId,
    group.data.rules ?? NO_RULES,
  )
  const changes = memberExitChanges(nets, transfers)

  const admins = groupAdmins(group.data)
  const needsHandOver =
    admins.includes(personId) && !admins.some(p => p !== personId)
  const others = group.data.members.filter(
    m => m.leftAt === null && m.personId !== personId,
  )
  const isAlone = others.length === 0

  const [choice, setChoice] = useState<ExitChoice | null>(null)
  const [heir, setHeir] = useState<string | null>(
    others.length === 1 ? others[0]!.personId : null,
  )
  const [isSaving, setIsSaving] = useState(false)
  const canSave =
    !isAlone && (!hasBalance || choice !== null) && (!needsHandOver || !!heir)

  const money = (v: bigint, currency: string) =>
    formatAmount(magnitude(v), currency, locale)
  /** "owes €10.00" / "is owed €10.00" / "settled up" for one member. */
  const standing = (id: string, v: bigint, currency: string) =>
    v === ZERO
      ? l`settled up`
      : v > ZERO
        ? id === me
          ? l`you are owed ${money(v, currency)}`
          : l`is owed ${money(v, currency)}`
        : id === me
          ? l`you owe ${money(v, currency)}`
          : l`owes ${money(v, currency)}`

  const save = async () => {
    setIsSaving(true)
    try {
      await removeGroupMember(store, ctx, {
        groupId: group.id,
        personId,
        choice: choice ?? 'keep',
        handAdminTo: needsHandOver ? (heir ?? undefined) : undefined,
        date: todayIn(tz),
        tz,
      })
      haptics.success()
      control.close(() =>
        Toast.show(
          isMe ? l`You left ${groupName}` : l`${who} was removed from ${groupName}`,
          {type: 'success'},
        ),
      )
    } catch (e) {
      setIsSaving(false)
      haptics.error()
      if (e instanceof DomainError && e.code === 'LAST_ADMIN')
        Toast.show(l`Choose who runs the group first.`, {type: 'error'})
      else {
        logger.error(e, {where: 'MemberExitDialog.save'})
        Toast.show(
          isMe
            ? l`Couldn’t leave the group. Please try again.`
            : l`Couldn’t remove ${who}. Please try again.`,
          {type: 'error'},
        )
      }
    }
  }

  const options: Array<{value: ExitChoice; label: string; hint: string}> = [
    {
      value: 'settle',
      label: l`Settle up now`,
      hint: isMe
        ? l`Records the payments that clear your balance. Splito records them; it never moves money.`
        : l`Records the payments that clear ${who}’s balance. Splito records them; it never moves money.`,
    },
    {
      value: 'forgive',
      label: l`Call it even`,
      hint: l`Writes the balance off. Nobody pays, and it is recorded as forgiven.`,
    },
    {
      value: 'keep',
      label: isMe ? l`Stay as an inactive member` : l`Keep as an inactive member`,
      hint: isMe
        ? l`You leave the group but your balance stays open until it is settled.`
        : l`${who} leaves the group but their balance stays open until it is settled.`,
    },
  ]

  return (
    <FormSheet.Inner
      title={isMe ? l`Leave group` : l`Remove ${who}`}
      footer={{
        saveLabel: isMe ? l`Leave group` : l`Remove`,
        canSave,
        isSaving,
        onSave: () => void save(),
      }}>
      <View style={[a.gap_xl]} testID="member-exit-body">
        <FormSheet.Description>
          {isMe ? (
            <Trans>
              You will no longer be in {groupName}. Earlier expenses and the
              history stay as they are.
            </Trans>
          ) : (
            <Trans>
              {who} will no longer be in {groupName}. Earlier expenses and the
              history stay as they are.
            </Trans>
          )}
        </FormSheet.Description>

        {isAlone && (
          <View testID="member-exit-alone">
            <Admonition.Outer type="warning">
              <Admonition.Row>
                <Admonition.Icon />
                <Admonition.Content>
                  <Admonition.Text>
                    <Trans>
                      Nobody else is in this group. Delete the group instead of
                      leaving it.
                    </Trans>
                  </Admonition.Text>
                </Admonition.Content>
              </Admonition.Row>
            </Admonition.Outer>
          </View>
        )}

        {hasBalance && !isAlone && (
          <View style={[a.gap_md]}>
            <SectionLabel>
              <Trans>Their balance</Trans>
            </SectionLabel>
            <View style={[a.rounded_md, a.border, t.atoms.border_contrast_low]}>
              {owed.map(({currency, amount}, i) => (
                <View
                  key={currency}
                  testID={`member-exit-owed-${currency}`}
                  style={[
                    a.flex_row,
                    a.justify_between,
                    a.gap_md,
                    a.px_md,
                    a.py_sm,
                    i > 0 && [a.border_t, t.atoms.border_contrast_low],
                  ]}>
                  <Text style={[a.text_md, t.atoms.text_contrast_medium]}>
                    {currency}
                  </Text>
                  <Text style={[a.text_md, a.font_semi_bold]}>
                    {standing(personId, amount, currency)}
                  </Text>
                </View>
              ))}
            </View>

            <SectionLabel>
              <Trans>What should happen to it?</Trans>
            </SectionLabel>
            <Toggle.Group
              label={l`What should happen to the balance`}
              type="radio"
              values={choice ? [choice] : []}
              onChange={([next]) => setChoice((next as ExitChoice) ?? null)}>
              <View style={[a.gap_md]}>
                {options.map(option => (
                  <Toggle.Item
                    key={option.value}
                    testID={`member-exit-${option.value}`}
                    name={option.value}
                    label={option.label}
                    style={[a.align_start]}>
                    <Toggle.Radio />
                    <View style={[a.flex_1, a.gap_2xs]}>
                      <Toggle.LabelText>{option.label}</Toggle.LabelText>
                      <Text
                        style={[
                          a.text_sm,
                          a.leading_snug,
                          t.atoms.text_contrast_medium,
                        ]}>
                        {option.hint}
                      </Text>
                    </View>
                  </Toggle.Item>
                ))}
              </View>
            </Toggle.Group>

            {choice && (
              <View style={[a.gap_sm]} testID="member-exit-preview">
                <SectionLabel>
                  <Trans>After this</Trans>
                </SectionLabel>
                {choice === 'keep' ? (
                  <Text
                    style={[
                      a.text_sm,
                      a.leading_snug,
                      t.atoms.text_contrast_medium,
                    ]}>
                    <Trans>
                      Nobody’s balance changes. {who} stays in the group’s
                      balances, marked as having left.
                    </Trans>
                  </Text>
                ) : (
                  <View
                    style={[a.rounded_md, a.border, t.atoms.border_contrast_low]}>
                    {changes.map((c, i) => (
                      <View
                        key={`${c.currency}-${c.personId}`}
                        testID={`member-exit-change-${c.currency}-${name(c.personId)}`}
                        style={[
                          a.gap_2xs,
                          a.px_md,
                          a.py_sm,
                          i > 0 && [a.border_t, t.atoms.border_contrast_low],
                        ]}>
                        <Text emoji style={[a.text_md, a.font_semi_bold]}>
                          {name(c.personId)}
                        </Text>
                        <Text
                          style={[
                            a.text_sm,
                            a.leading_snug,
                            t.atoms.text_contrast_medium,
                            {fontVariant: ['tabular-nums']},
                          ]}>
                          {`${standing(c.personId, c.before, c.currency)} → ${standing(c.personId, c.after, c.currency)}`}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {needsHandOver && !isAlone && (
          <View style={[a.gap_md]}>
            <SectionLabel>
              <Trans>Who runs the group next?</Trans>
            </SectionLabel>
            <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {isMe ? (
                <Trans>
                  You are the only admin, so someone has to take over before you
                  go.
                </Trans>
              ) : (
                <Trans>
                  {who} is the only admin, so someone has to take over before
                  they go.
                </Trans>
              )}
            </Text>
            <Toggle.Group
              label={l`New admin`}
              type="radio"
              values={heir ? [heir] : []}
              onChange={([next]) => setHeir(next ?? null)}>
              <View style={[a.gap_md]}>
                {others.map(m => (
                  <Toggle.Item
                    key={m.personId}
                    testID={`member-exit-admin-${name(m.personId)}`}
                    name={m.personId}
                    label={name(m.personId)}>
                    <Toggle.Radio />
                    <Toggle.LabelText>{name(m.personId)}</Toggle.LabelText>
                  </Toggle.Item>
                ))}
              </View>
            </Toggle.Group>
          </View>
        )}
      </View>
    </FormSheet.Inner>
  )
}

function SectionLabel({children}: {children: React.ReactNode}) {
  const t = useTheme()
  return (
    <Text
      style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>
      {children}
    </Text>
  )
}
