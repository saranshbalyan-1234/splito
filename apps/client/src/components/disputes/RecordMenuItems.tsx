import {Trans, useLingui} from '@lingui/react/macro'
import {type DisputeTarget} from '@splito/sync'

import {requestDispute} from '#/lib/disputes/bus'
import {HoldIcon, RaiseIcon} from './icons'
import * as Menu from '#/components/Menu'

/**
 * "Dispute" and "Put on hold" for one live record (F-1210), as menu items: in the expense and payment menus and in a
 * history row's long-press / right-click menu. The sheets open from `DisputeHost`, since a menu is gone by the time
 * its item has been pressed. Whether this person may is checked in the sheet, with the mutation's own rules.
 */
export function RecordMenuItems({targetType, targetId, itemId}: {targetType: DisputeTarget; targetId: string; itemId?: string}) {
  const {t: l} = useLingui()
  return (
    <>
      <Menu.Item testID="record-dispute" label={l`Dispute`} onPress={() => requestDispute({kind: 'raise', targetType, targetId, itemId})}>
        <Menu.ItemText>
          <Trans>Dispute</Trans>
        </Menu.ItemText>
        <Menu.ItemIcon icon={RaiseIcon} position="right" />
      </Menu.Item>
      <Menu.Item testID="record-hold" label={l`Put on hold`} onPress={() => requestDispute({kind: 'hold', targetType, targetId})}>
        <Menu.ItemText>
          <Trans>Put on hold</Trans>
        </Menu.ItemText>
        <Menu.ItemIcon icon={HoldIcon} position="right" />
      </Menu.Item>
    </>
  )
}
