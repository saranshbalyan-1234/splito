import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {
  addGroupMembers,
  createPerson,
  type Entity,
  type Group,
  type Person,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {useEntities, useMutationCtx, usePendingRequests, useStore} from '#/data/hooks'
import {UserAvatar} from '#/view/com/util/UserAvatar'
import {atoms as a, useTheme} from '#/alf'
import {Button, ButtonIcon} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {PlusLarge_Stroke2_Corner0_Rounded as PlusIcon} from '#/components/icons/Plus'
import * as Toast from '#/components/Toast'
import * as FormSheet from '#/components/FormSheet'
import {PendingPeople} from '#/components/people/PendingPeople'

/**
 * Adds friends (or someone new) to a group from now on. Earlier expenses
 * keep their splits; a former member rejoins.
 */
export function AddMembersDialog({
  control,
  group,
}: {
  control: Dialog.DialogControlProps
  group: Entity<Group>
}) {
  return (
    <FormSheet.Outer control={control} testID="add-members-sheet">
      <Form group={group} />
    </FormSheet.Outer>
  )
}

function Form({group}: {group: Entity<Group>}) {
  const t = useTheme()
  const {outgoing: pending} = usePendingRequests()
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const people = useEntities<Person>('person')
  const [selected, setSelected] = useState<string[]>([])
  const [newName, setNewName] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const current = new Set(
    group.data.members.filter(m => m.leftAt === null).map(m => m.personId),
  )
  const candidates = (people ?? [])
    .filter(p => !p.data.isMe && !current.has(p.id))
    .sort((x, y) => x.data.name.localeCompare(y.data.name))

  const addNew = async () => {
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
  }

  const save = async () => {
    setIsSaving(true)
    try {
      await addGroupMembers(store, ctx, group.id, selected)
      haptics.success()
      control.close(() =>
        Toast.show(
          selected.length === 1
            ? l`1 member added`
            : l`${selected.length} members added`,
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
                <Toggle.LabelText style={[a.flex_1, a.text_md]}>
                  {friend.data.name}
                </Toggle.LabelText>
                <Toggle.Checkbox />
              </Toggle.Item>
            ))}
          </Toggle.Group>
        )}
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
    </FormSheet.Inner>
  )
}
