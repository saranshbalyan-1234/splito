import {useLingui} from '@lingui/react/macro'

import {Bubble_Stroke2_Corner2_Rounded as BubbleIcon} from '#/components/icons/Message'
import {usePrefControl} from '#/components/settings/PrefSection'
import {SwitchPref} from '#/components/settings/controls'

/** `comments.showHistory`: the edit history between the comments on an expense's page. */
export function CommentsShowHistoryPref() {
  const {t: l} = useLingui()
  return (
    <SwitchPref
      pref={usePrefControl('comments.showHistory')}
      icon={BubbleIcon}
      title={l`Edit history in discussions`}
      label={l`Show who added, edited or deleted an expense between its comments`}
      description={l`Off keeps only the comments on an expense’s page. The history stays saved either way.`}
    />
  )
}
