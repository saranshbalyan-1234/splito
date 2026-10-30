import {Trans, useLingui} from '@lingui/react/macro'
import {type ActivityEvent, deleteExpense, restoreExpense} from '@splito/sync'

import {useHaptics} from '#/lib/haptics'
import {useTheme} from '#/alf'
import {type Props as SVGIconProps} from '#/components/icons/common'
import * as Toast from '#/components/Toast'
import {useAnswerFriendRequest, useMutationCtx, useStore} from '#/data/hooks'
import {markAllRead, markRows, setHidden, setRead} from './feed'
import {DeleteIcon, HideIcon, MarkReadIcon, MarkUnreadIcon} from './icons'
import {type useActivityFeed} from './useActivityFeed'

/** What a swipe, a hover button or the row menu can do to a row. */
export type RowAction = 'markRead' | 'hide' | 'delete'

export type RowActionInfo = {
  label: string
  icon: React.ComponentType<SVGIconProps>
  /** The swipe background. */
  color: string
}

/**
 * Row actions for the Activity feed, shared by swipes (native), hover
 * buttons (web), the row menu and screen-reader actions. Hide and read marks
 * are personal; delete tombstones the expense the row is about. Hide, delete
 * and "mark all read" offer Undo in a toast.
 */
export function useActivityActions(feed: ReturnType<typeof useActivityFeed>) {
  const t = useTheme()
  const {t: l} = useLingui()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const {snapshot, update} = feed
  /** Accept / Decline on a friend request row (26.18). */
  const answerRequest = useAnswerFriendRequest()

  const isAvailable = (action: RowAction, event: ActivityEvent) => {
    /* My own changes are never unread (owner 92), so there is nothing to mark. */
    if (action === 'markRead') return event.actor !== feed.me
    if (action !== 'delete') return true
    const expense =
      event.entityType === 'expense'
        ? snapshot?.expenses.get(event.entityId)
        : undefined
    return !!expense && !expense.deleted
  }

  const info = (action: RowAction, isRead: boolean): RowActionInfo => {
    switch (action) {
      case 'markRead':
        return isRead
          ? {
              label: l`Mark as unread`,
              icon: MarkUnreadIcon,
              color: t.palette.primary_500,
            }
          : {
              label: l`Mark as read`,
              icon: MarkReadIcon,
              color: t.palette.primary_500,
            }
      case 'hide':
        return {
          label: l`Hide from activity`,
          icon: HideIcon,
          color: t.palette.contrast_500,
        }
      case 'delete':
        return {
          label: l`Delete expense`,
          icon: DeleteIcon,
          color: t.palette.negative_500,
        }
    }
  }

  const perform = async (
    action: RowAction,
    event: ActivityEvent,
    isRead: boolean,
  ) => {
    switch (action) {
      case 'markRead':
        update(s => setRead(s, event, !isRead))
        return
      case 'hide':
        update(s => setHidden(s, event.id, true))
        showUndo(<Trans>Hidden from your activity</Trans>, () =>
          update(s => setHidden(s, event.id, false)),
        )
        return
      case 'delete':
        try {
          await deleteExpense(store, ctx, event.entityId)
          haptics.confirm()
          showUndo(<Trans>Expense deleted</Trans>, () =>
            restoreExpense(store, ctx, event.entityId).catch(() =>
              Toast.show(l`Couldn't restore this expense`, {type: 'error'}),
            ),
          )
        } catch {
          Toast.show(l`Couldn't delete this expense`, {type: 'error'})
        }
        return
    }
  }

  const markEverythingRead = () => {
    const before = feed.state
    /* A narrowed list (a type, a group) marks only the unread rows it lists; the rest stays unread. */
    const listed = feed.rows.flatMap(r => (r.type === 'event' && !r.isRead ? [r.event] : []))
    update(s => (feed.isNarrowed ? markRows(s, listed) : markAllRead(s, snapshot?.events ?? [])))
    showUndo(feed.isNarrowed ? <Trans>Marked these as read</Trans> : <Trans>Marked everything as read</Trans>, () =>
      update(s => ({
        ...s,
        readUpTo: before.readUpTo,
        read: before.read,
        unread: before.unread,
      })),
    )
  }

  const unhideAll = () => update(s => ({...s, hidden: []}))

  function showUndo(message: React.ReactNode, undo: () => unknown) {
    Toast.show(
      <Toast.Outer>
        <Toast.Icon />
        <Toast.Text>{message}</Toast.Text>
        <Toast.Action label={l`Undo`} onPress={() => void undo()}>
          <Trans context="action">Undo</Trans>
        </Toast.Action>
      </Toast.Outer>,
      {type: 'success'},
    )
  }

  return {
    isAvailable,
    info,
    perform,
    markEverythingRead,
    unhideAll,
    answerRequest,
  }
}

export type ActivityActions = ReturnType<typeof useActivityActions>
