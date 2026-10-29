import {Trans, useLingui} from '@lingui/react/macro'

import {requestRemind} from '#/lib/remind/bus'
import {hasOpenBalance, owedByThem} from '#/lib/remind/owed'
import {useBalanceRows} from '#/data/hooks'
import * as Menu from '#/components/Menu'
import {RemindIcon, RemindMeIcon} from './icons'

/**
 * "Remind" and "Remind me" for one friend, as menu items (F-1118, F-1119): on the Person page, and on a
 * debtor row of a group's Balances and the Settle plan. Remind is offered only while they owe me
 * something, in any currency; Remind me while anything is open between us, in either direction. The sheets
 * open from `RemindHost`, since a menu is gone by the time its item has been pressed.
 *
 * `owed` (what they owe me, per currency) and `isOpen` are given by a row that already knows; the Person
 * page leaves them out and this reads the balances.
 */
export function RemindMenuItems({
  personId,
  groupId = null,
  owed,
  isOpen,
}: {
  personId: string
  /** The group the reminder is about; null: the friend across everything. */
  groupId?: string | null
  owed?: Record<string, bigint>
  isOpen?: boolean
}) {
  const {t: l} = useLingui()
  const rows = useBalanceRows()
  const theyOwe = owed ?? (rows ? owedByThem(rows, personId) : {})
  const canRemind = Object.keys(theyOwe).length > 0
  const canRemindMe = isOpen ?? (rows ? hasOpenBalance(rows, personId) : false)
  if (!canRemind && !canRemindMe) return null

  return (
    <>
      {canRemind && (
        <Menu.Item
          testID="remind"
          label={l`Remind`}
          onPress={() => requestRemind({kind: 'remind', personId, groupId, owed: theyOwe})}>
          <Menu.ItemText>
            <Trans>Remind</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={RemindIcon} position="right" />
        </Menu.Item>
      )}
      {canRemindMe && (
        <Menu.Item
          testID="remind-me"
          label={l`Remind me`}
          onPress={() => requestRemind({kind: 'remindMe', personId, groupId})}>
          <Menu.ItemText>
            <Trans>Remind me</Trans>
          </Menu.ItemText>
          <Menu.ItemIcon icon={RemindMeIcon} position="right" />
        </Menu.Item>
      )}
    </>
  )
}
