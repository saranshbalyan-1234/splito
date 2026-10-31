import {Trans, useLingui} from '@lingui/react/macro'
import {type DisputeTarget} from '@splito/sync'

import {requestDispute} from '#/lib/disputes/bus'
import {RaiseIcon} from './icons'
import * as Menu from '#/components/Menu'

/**
 * "Report a problem" for one live record (F-1210, F-275), as a menu item: in the expense and payment menus and in a
 * history row's long-press / right-click menu. It is the one way in; the sheet's first choice is Dispute or Put on
 * hold. The sheet opens from `DisputeHost`, since a menu is gone by the time its item has been pressed. Whether this
 * person may is checked in the sheet, with the mutation's own rules.
 */
export function RecordMenuItems({targetType, targetId}: {targetType: DisputeTarget; targetId: string}) {
  const {t: l} = useLingui()
  return (
    <Menu.Item testID="record-report" label={l`Report a problem`} onPress={() => requestDispute({kind: 'report', targetType, targetId})}>
      <Menu.ItemText>
        <Trans>Report a problem</Trans>
      </Menu.ItemText>
      <Menu.ItemIcon icon={RaiseIcon} position="right" />
    </Menu.Item>
  )
}
