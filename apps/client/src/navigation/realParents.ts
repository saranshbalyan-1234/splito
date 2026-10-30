import {useEffect} from 'react'
import {CommonActions, useNavigation, useRoute} from '@react-navigation/native'

import {IS_WEB} from '#/env'
import {COLD_KEY} from '#/lib/links/state'
import {type Fallback} from './goBack'

/**
 * A page opened cold (a refresh, a pasted address) gets the default chain under it (`webState`), which cannot know an
 * expense's group. Once the record is loaded, this swaps that chain for the real parents (`realParentsFor`), so Back
 * climbs expense -> group -> Groups -> Home. History a person really made (the routes under the page are not the cold
 * chain) is never touched. Web only: native has no cold chain.
 */
export function useRealParents(parents: Fallback[] | undefined) {
  const navigation = useNavigation()
  const route = useRoute()
  const wanted = parents ? JSON.stringify(parents) : ''
  useEffect(() => {
    if (!IS_WEB || !parents) return
    const state = navigation.getState()
    if (!state) return
    const at = state.routes.findIndex(r => r.key === route.key)
    if (at <= 0) return
    const below = state.routes.slice(0, at)
    if (!below.every(r => r.key.startsWith(COLD_KEY))) return
    if (JSON.stringify(below.map(r => ({name: r.name, ...(r.params ? {params: r.params} : {})}))) === wanted) return
    const routes = [
      ...parents.map((p, i) => ({name: p.name, params: p.params, key: `${COLD_KEY}real-${p.name}-${i}`})),
      ...state.routes.slice(at),
    ]
    navigation.dispatch(CommonActions.reset({...state, index: state.index + routes.length - state.routes.length, routes} as Parameters<typeof CommonActions.reset>[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, route.key])
}
