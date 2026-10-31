// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/hooks/useNavigationTabState.ts
import {useNavigationState} from '@react-navigation/native'

import {getTabState, TabState} from '#/lib/routes/helpers'
import {startPage} from '#/lib/routes/startTab'

export function useNavigationTabState() {
  return useNavigationState(state => {
    const res = {
      isAtPeople: getTabState(state, 'People') !== TabState.Outside,
      isAtGroups: getTabState(state, 'Groups') !== TabState.Outside,
      isAtAnalytics: getTabState(state, 'Analytics') !== TabState.Outside,
      isAtActivity: getTabState(state, 'Activity') !== TabState.Outside,
    }

    if (
      !res.isAtPeople &&
      !res.isAtGroups &&
      !res.isAtAnalytics &&
      !res.isAtActivity
    ) {
      // HACK for some reason useNavigationState will give us pre-hydration results
      //      and not update after, so we force the start tab if all came back false
      //      -prf
      res[`isAt${startPage()}`] = true
    }
    return res
  })
}
