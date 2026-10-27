import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {useNavigation} from '@react-navigation/native'
import {type CurrencyCode, formatAmount, openAmounts} from '@splito/domain'
import {
  deleteGroup,
  type Entity,
  type Group,
  isGroupInactive,
  makeGroupActive,
  makeGroupInactive,
  restoreGroup,
  setGroupHidden,
} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {type NavigationProp} from '#/lib/routes/types'
import {logger} from '#/logger'
import {useHiddenGroups} from '#/data/groupVisibility'
import {useMutationCtx, useStore} from '#/data/hooks'
import {atoms as a} from '#/alf'
import * as Admonition from '#/components/Admonition'
import {ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {Trash_Stroke2_Corner0_Rounded as TrashIcon} from '#/components/icons/Trash'
import * as Menu from '#/components/Menu'
import * as Prompt from '#/components/Prompt'
import {Text} from '#/components/Typography'
import * as Toast from '#/components/Toast'
import {
  EyeIcon,
  EyeOffIcon,
  LogOutIcon,
  PauseIcon,
  PlayIcon,
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
  const inactiveControl = Dialog.useDialogControl()
  const [exitPerson, setExitPerson] = useState<string | null>(null)
  return {
    exitControl,
    deleteControl,
    inactiveControl,
    exitPerson,
    /** Opens the leave sheet (my own id) or the remove-member sheet (a friend's). */
    openExit(personId: string) {
      setExitPerson(personId)
      exitControl.open()
    },
  }
}

export type GroupLifecycle = ReturnType<typeof useGroupLifecycle>

/** Undo toast shared by the state changes: the message and what Undo runs. */
function showUndo(message: string, undoLabel: string, onUndo: () => void) {
  Toast.show(
    <Toast.Outer>
      <Toast.Icon />
      <Toast.Text>{message}</Toast.Text>
      <Toast.Action label={undoLabel} onPress={onUndo}>
        <Trans context="action">Undo</Trans>
      </Toast.Action>
    </Toast.Outer>,
    {type: 'success'},
  )
}

/**
 * The overflow menu's items (decision 89): Make inactive / Make active (the group's state for everyone), Hide
 * group / Show group (only mine), Leave group, Delete group. Making a group inactive with an open balance asks
 * first, listing what is open and offering Settle up first.
 */
export function GroupLifecycleItems({
  lifecycle,
  group,
  me,
  nets,
}: {
  lifecycle: GroupLifecycle
  group: Entity<Group>
  me: string
  nets: Record<CurrencyCode, Record<string, bigint>>
}) {
  const {t: l} = useLingui()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const hiddenIds = useHiddenGroups()
  const isInactive = isGroupInactive(group.data)
  const isHidden = hiddenIds.has(group.id)
  const isMember = group.data.members.some(m => m.personId === me && m.leftAt === null)
  const groupName = group.data.name
  const failed = (e: unknown, where: string) => {
    logger.error(e, {where})
    Toast.show(l`Couldn’t update the group. Please try again.`, {type: 'error'})
  }

  const setActive = async (isActive: boolean) => {
    try {
      if (isActive) await makeGroupActive(store, ctx, group.id)
      else await makeGroupInactive(store, ctx, group.id)
      haptics.confirm()
      showUndo(
        isActive ? l`${groupName} is active again` : l`${groupName} is inactive`,
        l`Undo`,
        () =>
          void (isActive ? makeGroupInactive : makeGroupActive)(store, ctx, group.id).catch(e => failed(e, 'GroupLifecycle.undoActive')),
      )
    } catch (e) {
      failed(e, 'GroupLifecycle.setActive')
    }
  }
  const setHidden = async (hidden: boolean) => {
    try {
      await setGroupHidden(store, ctx, group.id, hidden)
      haptics.confirm()
      showUndo(
        hidden ? l`${groupName} hidden from your lists` : l`${groupName} is back in your lists`,
        l`Undo`,
        () => void setGroupHidden(store, ctx, group.id, !hidden).catch(e => failed(e, 'GroupLifecycle.undoHidden')),
      )
    } catch (e) {
      failed(e, 'GroupLifecycle.setHidden')
    }
  }
  const hasOpenBalance = Object.keys(openAmounts(nets)).length > 0

  return (
    <>
      <Menu.Item
        testID="group-menu-inactive"
        label={isInactive ? l`Make active` : l`Make inactive`}
        onPress={() => {
          if (isInactive) void setActive(true)
          else if (hasOpenBalance) lifecycle.inactiveControl.open()
          else void setActive(false)
        }}>
        <Menu.ItemText>
          {isInactive ? <Trans>Make active</Trans> : <Trans>Make inactive</Trans>}
        </Menu.ItemText>
        <Menu.ItemIcon icon={isInactive ? PlayIcon : PauseIcon} position="right" />
      </Menu.Item>
      <Menu.Item
        testID="group-menu-hide"
        label={isHidden ? l`Show group` : l`Hide group`}
        onPress={() => void setHidden(!isHidden)}>
        <Menu.ItemText>
          {isHidden ? <Trans>Show group</Trans> : <Trans>Hide group</Trans>}
        </Menu.ItemText>
        <Menu.ItemIcon icon={isHidden ? EyeIcon : EyeOffIcon} position="right" />
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
      <MakeInactivePrompt
        control={lifecycle.inactiveControl}
        group={group}
        nets={nets}
        locale={locale}
      />
    </>
  )
}

/** Making a group inactive with money still open: lists the open amounts and offers Settle up first. */
function MakeInactivePrompt({
  control,
  group,
  nets,
  locale,
}: {
  control: Dialog.DialogControlProps
  group: Entity<Group>
  nets: Record<CurrencyCode, Record<string, bigint>>
  locale: string
}) {
  const {t: l} = useLingui()
  const navigation = useNavigation<NavigationProp>()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const groupName = group.data.name
  const open = Object.entries(openAmounts(nets)).sort(([x], [y]) => x.localeCompare(y))
  return (
    <Prompt.Outer control={control} testID="make-inactive-prompt">
      <Prompt.Content>
        <Prompt.TitleText>
          <Trans>Make {groupName} inactive?</Trans>
        </Prompt.TitleText>
        <Prompt.DescriptionText>
          <Trans>
            It will take no new expenses, but you can still settle up. Money is
            still open in this group:
          </Trans>
        </Prompt.DescriptionText>
        <View testID="make-inactive-open" style={[a.gap_xs, a.pb_md]}>
          {open.map(([currency, amount]) => (
            <Text key={currency} style={[a.text_md, a.font_semi_bold]}>
              {formatAmount(amount, currency, locale)}
            </Text>
          ))}
        </View>
      </Prompt.Content>
      <Prompt.Actions>
        <Prompt.Action
          testID="make-inactive-settle"
          cta={l`Settle up first`}
          onPress={() => navigation.navigate('Settle', {groupId: group.id})}
        />
        <Prompt.Action
          testID="make-inactive-confirm"
          cta={l`Make inactive anyway`}
          color="secondary"
          onPress={() =>
            void makeGroupInactive(store, ctx, group.id)
              .then(() => {
                haptics.confirm()
                showUndo(l`${groupName} is inactive`, l`Undo`, () => void makeGroupActive(store, ctx, group.id))
              })
              .catch(e => {
                logger.error(e, {where: 'MakeInactivePrompt.confirm'})
                Toast.show(l`Couldn’t update the group. Please try again.`, {type: 'error'})
              })
          }
        />
        <Prompt.Cancel />
      </Prompt.Actions>
    </Prompt.Outer>
  )
}

/** Strips under the header: the group is inactive or hidden, or I have left it. */
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
  const hiddenIds = useHiddenGroups()
  const isInactive = isGroupInactive(group.data)
  const isHidden = hiddenIds.has(group.id)
  const hasLeft = group.data.members.some(m => m.personId === me && m.leftAt !== null)
  if (!isInactive && !isHidden && !hasLeft) return null
  const failed = (e: unknown, where: string) => {
    logger.error(e, {where})
    Toast.show(l`Couldn’t update the group. Please try again.`, {type: 'error'})
  }
  return (
    <View style={[a.gap_sm]}>
      {isInactive && (
        <View testID="group-inactive-notice">
          <Admonition.Outer type="info">
            <Admonition.Row>
              <Admonition.Icon />
              <Admonition.Content>
                <Admonition.Text>
                  <Trans>Inactive · Make active to add expenses</Trans>
                </Admonition.Text>
              </Admonition.Content>
              <Admonition.Button
                testID="group-make-active"
                label={l`Make active`}
                color="secondary"
                onPress={() =>
                  void makeGroupActive(store, ctx, group.id).catch(e => failed(e, 'GroupNotices.makeActive'))
                }>
                <ButtonText>
                  <Trans>Make active</Trans>
                </ButtonText>
              </Admonition.Button>
            </Admonition.Row>
          </Admonition.Outer>
        </View>
      )}
      {isHidden && (
        <View testID="group-hidden-notice">
          <Admonition.Outer type="info">
            <Admonition.Row>
              <Admonition.Icon />
              <Admonition.Content>
                <Admonition.Text>
                  <Trans>
                    Hidden from your lists. Only you see this; the group is
                    unchanged for everyone else.
                  </Trans>
                </Admonition.Text>
              </Admonition.Content>
              <Admonition.Button
                testID="group-show"
                label={l`Show group`}
                color="secondary"
                onPress={() =>
                  void setGroupHidden(store, ctx, group.id, false).catch(e => failed(e, 'GroupNotices.show'))
                }>
                <ButtonText>
                  <Trans>Show</Trans>
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
