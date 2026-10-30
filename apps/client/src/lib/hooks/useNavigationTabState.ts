// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/hooks/useNavigationTabState.ts
import {useNavigationState} from '@react-navigation/native'

import {getTabState, TabState} from '#/lib/routes/helpers'

export function useNavigationTabState() {
  return useNavigationState(state => {
    const res = {
      isAtHome: getTabState(state, 'Home') !== TabState.Outside,
      isAtPeople: getTabState(state, 'People') !== TabState.Outside,
      isAtGroups: getTabState(state, 'Groups') !== TabState.Outside,
      isAtAnalytics: getTabState(state, 'Analytics') !== TabState.Outside,
      isAtActivity: getTabState(state, 'Activity') !== TabState.Outside,
    }

    if (
      !res.isAtHome &&
      !res.isAtPeople &&
      !res.isAtGroups &&
      !res.isAtAnalytics &&
      !res.isAtActivity
    ) {
      // HACK for some reason useNavigationState will give us pre-hydration results
      //      and not update after, so we force isAtHome if all came back false
      //      -prf
      res.isAtHome = true
    }
    return res
  })
}
