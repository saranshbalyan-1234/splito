import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  addGroupMembers,
  createPerson,
  type Entity,
  type Group,
  groupAdmins,
  isRemovedFriend,
  joinPolicyOf,
  type Person,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {useSingleFlight} from '#/lib/hooks/useSingleFlight'
import {logger} from '#/logger'
import {useAnswerGroupInvites, useEntities, useInvitedPeople, useMutationCtx, usePendingRequests, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Toast from '#/components/Toast'
import * as FormSheet from '#/components/FormSheet'
import {useJoinPolicyText} from '#/components/groups/JoinPolicyField'
import {PendingPeople} from '#/components/people/PendingPeople'
import {Text} from '#/components/Typography'

/**
 * Adds friends (or someone new) to a group from now on, or opens the
 * group's invite link / QR. Earlier expenses
 * keep their splits; a former member rejoins.
 */
export function AddMembersDialog({
  control,
  group,
  inviteRow,
  onChangeRule,
}: {
  control: Dialog.DialogControlProps
  group: Entity<Group>
  /** The "Invite link or QR code" row, drawn by the screen (it navigates). */
  inviteRow?: React.ReactNode
  /** Opens Edit group, where "Who can join" is changed (owner 212: one place for the radios). */
  onChangeRule: () => void
}) {
  return (
    <FormSheet.Outer control={control} testID="add-members-sheet">
      <Form group={group} inviteRow={inviteRow} onChangeRule={onChangeRule} />
    </FormSheet.Outer>
  )
}

function Form({
  group,
  inviteRow,
  onChangeRule,
}: {
  group: Entity<Group>
  inviteRow: React.ReactNode
  onChangeRule: () => void
}) {
  const t = useTheme()
  const {outgoing: pending} = usePendingRequests()
  const invited = useInvitedPeople(group.id)
  const policy = joinPolicyOf(group.data)
  const policyText = useJoinPolicyText()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const answerInvites = useAnswerGroupInvites()
  const isAdmin = groupAdmins(group.data).includes(ctx.actor)
  const haptics = useHaptics()
  const people = useEntities<Person>('person')
  const [selected, setSelected] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const runOnce = useSingleFlight()
  const [isSaving, setIsSaving] = useState(false)
  const current = new Set(
    group.data.members.filter(m => m.leftAt === null).map(m => m.personId),
  )
  /* Someone already invited is waiting on their answer: not offered again, shown greyed below (owner 196). */
  const invitedIds = new Set(invited.map(r => r.data.personId))
  const candidates = (people ?? [])
    .filter(p => !p.data.isMe && !isRemovedFriend(p.data) && !current.has(p.id) && !invitedIds.has(p.id))
    .sort((x, y) => x.data.name.localeCompare(y.data.name))

  const addNew = () =>
    runOnce(async () => {
      if (!newName.trim()) return
      try {
        const p = await createPerson(store, ctx, {name: newName})
        setSelected(ids => [...ids, p.id])
        setNewName('')
        haptics.confirm()
      } catch (e) {
        logger.error(e, {where: 'AddMembersDialog.addNew'})
        Toast.show(l`Couldn’t add that person. Please try again.`, {
          type: 'error',
        })
      }
    })

  const save = async () => {
    setIsSaving(true)
    try {
      const result = await addGroupMembers(store, ctx, group.id, selected)
      void answerInvites(group.id)
      haptics.success()
      // A friend with a linked account is asked, not added (owner 196): they show as Invited until they join.
      const asked = result.asked.length
      const added = result.added.length
      control.close(() =>
        Toast.show(
          asked === 0
            ? added === 1
              ? l`1 member added`
              : l`${added} members added`
            : added === 0
              ? asked === 1
                ? l`1 invite sent`
                : l`${asked} invites sent`
              : l`${added} added, ${asked} invited`,
          {type: 'success'},
        ),
      )
    } catch (e) {
      setIsSaving(false)
      logger.error(e, {where: 'AddMembersDialog.save'})
      Toast.show(l`Couldn’t add members. Please try again.`, {type: 'error'})
    }
  }

  return (
    <FormSheet.Inner
      deferBody
      title={l`Add members`}
      isDirty={selected.length > 0 || newName.trim() !== ''}
      footer={{
        saveLabel: l`Add to group`,
        canSave: selected.length > 0,
        isSaving,
        onSave: () => void save(),
      }}>
      <FormSheet.Description>
        <Trans>
          They join from now on. Expenses already in the group keep their
          splits.
        </Trans>
      </FormSheet.Description>

      <View
        style={[
          a.rounded_md,
          a.border,
          t.atoms.border_contrast_low,
          a.overflow_hidden,
        ]}>
        {candidates.length > 0 && (
          <Toggle.Group
            label={l`Friends`}
            type="checkbox"
            values={selected}
            onChange={setSelected}>
            {candidates.map((friend, i) => (
              <Toggle.Item
                key={friend.id}
                testID={`add-member-${friend.data.name}`}
                name={friend.id}
                label={friend.data.name}
                style={[
                  a.px_md,
                  a.py_sm,
                  i > 0 && a.border_t,
                  t.atoms.border_contrast_low,
                ]}>
                <UserAvatar size={32} name={friend.data.name} type="user" />
                <View style={[a.flex_1]}>
                  <Toggle.LabelText style={[a.text_md]}>
                    {friend.data.name}
                  </Toggle.LabelText>
                  {friend.data.accountId ? (
                    <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
                      <Trans>Gets a request to join</Trans>
                    </Text>
                  ) : null}
                </View>
                <Toggle.Checkbox />
              </Toggle.Item>
            ))}
          </Toggle.Group>
        )}
        <PendingPeople
          group
          pending={invited}
          avatarSize={32}
          rowStyle={[
            a.px_md,
            candidates.length > 0 && a.border_t,
            t.atoms.border_contrast_low,
          ]}
        />
        <PendingPeople
          pending={pending}
          avatarSize={32}
          rowStyle={[
            a.px_md,
            candidates.length > 0 && a.border_t,
            t.atoms.border_contrast_low,
          ]}
        />
        <View
          style={[
            a.flex_row,
            a.align_center,
            a.gap_sm,
            a.px_md,
            a.py_sm,
            candidates.length > 0 && a.border_t,
            t.atoms.border_contrast_low,
          ]}>
          <View style={[a.flex_1]}>
            <TextField.Root>
              <Dialog.Input
                testID="add-member-new"
                label={l`Add someone new`}
                value={newName}
                onChangeText={setNewName}
                placeholder={l`Add someone new`}
                autoCapitalize="words"
                maxLength={64}
                onSubmitEditing={() => void addNew()}
              />
            </TextField.Root>
          </View>
          <Button
            testID="add-member-new-save"
            label={l`Add member`}
            size="large"
            color="secondary"
            shape="round"
            disabled={!newName.trim()}
            onPress={() => void addNew()}>
            <ButtonIcon icon={PlusIcon} />
          </Button>
        </View>
      </View>

      {/* Who can join (owner 196): shown as one line; the three options live in Edit group (owner 212). */}
      <View style={[a.flex_row, a.align_center, a.justify_between, a.gap_md]}>
        <Text testID="add-members-join-rule" style={[a.flex_1, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          {policyText.title(policy, isAdmin)}
        </Text>
        {isAdmin ? (
          <Button testID="add-members-change-rule" label={l`Change who can join`} size="small" variant="ghost" color="secondary" onPress={onChangeRule}>
            <ButtonText>
              <Trans>Change</Trans>
            </ButtonText>
          </Button>
        ) : null}
      </View>

      {/* The group's invite link lives only here (26.18 decision 77); invite only has none. */}
      {policy === 'invite' ? (
        <Text testID="add-members-no-link" style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
          <Trans>Invite only: there is no group link. Change who can join to get one.</Trans>
        </Text>
      ) : (
        inviteRow
      )}
    </FormSheet.Inner>
  )
}
