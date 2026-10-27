import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type CurrencyCode} from '@splito/domain'
import {
  archiveGroup,
  deleteGroup,
  type Entity,
  type Group,
  restoreGroup,
  unarchiveGroup,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useMutationCtx, useStore} from '#/data/hooks'
import {atoms as a} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Menu from '#/components/Menu'
import * as Toast from '#/components/Toast'
import {
  ArchiveIcon,
  LogOutIcon,
  UnarchiveIcon,
} from '#/screens/Group/components/groupIcons'
import {DeleteGroupPrompt} from './DeleteGroupPrompt'
import {MemberExitDialog} from './MemberExitDialog'

/**
 * Archive, leave and delete a group, and remove a member (F-604, F-615, F-613 part 1). The Group screen
 * mounts three pieces: this hook, the overflow items, and the dialogs; the logic is in `@splito/sync`'s
 * `groupLifecycle`.
 */
export function useGroupLifecycle() {
  const exitControl = Dialog.useDialogControl()
  const deleteControl = Dialog.useDialogControl()
  const [exitPerson, setExitPerson] = useState<string | null>(null)
  return {
    exitControl,
    deleteControl,
    exitPerson,
    /** Opens the leave sheet (my own id) or the remove-member sheet (a friend's). */
    openExit(personId: string) {
      setExitPerson(personId)
      exitControl.open()
    },
  }
}

export type GroupLifecycle = ReturnType<typeof useGroupLifecycle>

/** The overflow menu's items: Archive or Unarchive, Leave group, Delete group. */
export function GroupLifecycleItems({
  lifecycle,
  group,
  me,
}: {
  lifecycle: GroupLifecycle
  group: Entity<Group>
  me: string
}) {
  const {t: l} = useLingui()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const isArchived = group.data.archived
  const isMember = group.data.members.some(m => m.personId === me && m.leftAt === null)
  const groupName = group.data.name

  const toggleArchive = async () => {
    try {
      if (isArchived) {
        await unarchiveGroup(store, ctx, group.id)
        haptics.success()
        Toast.show(l`${groupName} is back in your groups`, {type: 'success'})
      } else {
        await archiveGroup(store, ctx, group.id)
        haptics.confirm()
        Toast.show(
          <Toast.Outer>
            <Toast.Icon />
            <Toast.Text>{l`${groupName} archived`}</Toast.Text>
            <Toast.Action
              label={l`Undo`}
              onPress={() =>
                void unarchiveGroup(store, ctx, group.id).catch(e =>
                  logger.error(e, {where: 'GroupLifecycle.unarchive'}),
                )
              }>
              <Trans context="action">Undo</Trans>
            </Toast.Action>
          </Toast.Outer>,
          {type: 'success'},
        )
      }
    } catch (e) {
      logger.error(e, {where: 'GroupLifecycle.archive'})
      Toast.show(l`Couldn’t update the group. Please try again.`, {type: 'error'})
    }
  }

  return (
    <>
      <Menu.Item
        testID="group-menu-archive"
        label={isArchived ? l`Unarchive group` : l`Archive group`}
        onPress={() => void toggleArchive()}>
        <Menu.ItemText>
          {isArchived ? <Trans>Unarchive group</Trans> : <Trans>Archive group</Trans>}
        </Menu.ItemText>
        <Menu.ItemIcon icon={isArchived ? UnarchiveIcon : ArchiveIcon} position="right" />
      </Menu.Item>
      {isMember && (
        <Menu.Item
          testID="group-menu-leave"
          label={l`Leave group`}
          destructive
          onPress={() => lifecycle.openExit(me)}>
          <Menu.ItemText>
            <Trans>Leave group</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={LogOutIcon} position="right" />
        </Menu.Item>
      )}
      <Menu.Item
        testID="group-menu-delete"
        label={l`Delete group`}
        destructive
        onPress={() => lifecycle.deleteControl.open()}>
        <Menu.ItemText>
          <Trans>Delete group</Trans>
        </Menu.ItemText>
        <Menu.ItemIcon icon={TrashIcon} position="right" />
      </Menu.Item>
    </>
  )
}

/** The sheets behind those items and the Members tab's rows. */
export function GroupLifecycleDialogs({
  lifecycle,
  group,
  me,
  names,
  nets,
  locale,
}: {
  lifecycle: GroupLifecycle
  group: Entity<Group>
  me: string
  names: Map<string, string>
  nets: Record<CurrencyCode, Record<string, bigint>>
  locale: string
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const groupName = group.data.name

  const remove = async () => {
    try {
      await deleteGroup(store, ctx, group.id)
      haptics.confirm()
      navigation.navigate('Groups')
      Toast.show(
        <Toast.Outer>
          <Toast.Icon />
          <Toast.Text>{l`${groupName} deleted`}</Toast.Text>
          <Toast.Action
            label={l`Undo`}
            onPress={() =>
              void restoreGroup(store, ctx, group.id).catch(e => {
                logger.error(e, {where: 'GroupLifecycle.undoDelete'})
                Toast.show(l`Couldn’t undo. Please try again.`, {type: 'error'})
              })
            }>
            <Trans context="action">Undo</Trans>
          </Toast.Action>
        </Toast.Outer>,
        {type: 'success'},
      )
    } catch (e) {
      logger.error(e, {where: 'GroupLifecycle.delete'})
      haptics.error()
      Toast.show(l`Couldn’t delete the group. Please try again.`, {type: 'error'})
    }
  }

  return (
    <>
      <MemberExitDialog
        control={lifecycle.exitControl}
        group={group}
        personId={lifecycle.exitPerson}
        me={me}
        names={names}
        nets={nets}
        locale={locale}
      />
      <DeleteGroupPrompt
        control={lifecycle.deleteControl}
        group={group}
        onConfirm={() => void remove()}
      />
    </>
  )
}

/** A strip under the header for a group that is archived, or that I have left. */
export function GroupNotices({
  group,
  me,
}: {
  group: Entity<Group>
  me: string
}) {
  const {t: l} = useLingui()
  const store = useStore()
  const ctx = useMutationCtx()
  const hasLeft = group.data.members.some(m => m.personId === me && m.leftAt !== null)
  if (!group.data.archived && !hasLeft) return null
  return (
    <View style={[a.gap_sm]}>
      {group.data.archived && (
        <View testID="group-archived-notice">
          <Admonition.Outer type="info">
            <Admonition.Row>
              <Admonition.Icon />
              <Admonition.Content>
                <Admonition.Text>
                  <Trans>
                    Archived. Hidden from your Groups list; balances and search
                    still include it.
                  </Trans>
                </Admonition.Text>
              </Admonition.Content>
              <Admonition.Button
                testID="group-unarchive"
                label={l`Unarchive group`}
                color="secondary"
                onPress={() =>
                  void unarchiveGroup(store, ctx, group.id).catch(e => {
                    logger.error(e, {where: 'GroupNotices.unarchive'})
                    Toast.show(l`Couldn’t update the group. Please try again.`, {type: 'error'})
                  })
                }>
                <ButtonText>
                  <Trans>Unarchive</Trans>
                </ButtonText>
              </Admonition.Button>
            </Admonition.Row>
          </Admonition.Outer>
        </View>
      )}
      {hasLeft && (
        <View testID="group-left-notice">
          <Admonition.Outer type="info">
            <Admonition.Row>
              <Admonition.Icon />
              <Admonition.Content>
                <Admonition.Text>
                  <Trans>
                    You left this group. Open balances stay until they are
                    settled.
                  </Trans>
                </Admonition.Text>
              </Admonition.Content>
            </Admonition.Row>
          </Admonition.Outer>
        </View>
      )}
    </View>
  )
}
