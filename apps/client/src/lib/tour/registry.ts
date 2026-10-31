import {type ComponentRef, useEffect, useSyncExternalStore} from 'react'
import {type View} from 'react-native'
import {useIsFocused} from '@react-navigation/native'

import {type TourTargetId} from './steps'

/*
 * What the guided tour (F-253) needs to know about the screen, kept in a tiny module store: no component re-renders
 * because a control registered, and nothing is read until a tour runs. Controls register themselves with `useTourRef`
 * (a ref callback, so React 19 unregisters them on unmount); People says what it holds (`usePublishPeopleState`).
 */

/** What a ref on a View, a Pressable or a Button gives; it can say where it is in the window. */
export type Measurable = ComponentRef<typeof View>

export type Rect = {x: number; y: number; width: number; height: number}

const nodes = new Map<TourTargetId, Set<Measurable>>()

/**
 * A ref callback that makes a control a place the tour can point at. Several mounted copies of one id are fine (a
 * parked tab keeps its own FAB): the tour measures all of them and takes the one that is actually showing.
 */
export function useTourRef(id: TourTargetId) {
  return (node: Measurable | null) => {
    if (!node) return
    let set = nodes.get(id)
    if (!set) nodes.set(id, (set = new Set()))
    set.add(node)
    return () => {
      set.delete(node)
    }
  }
}

function measure(node: Measurable): Promise<Rect | null> {
  return new Promise(resolve => {
    try {
      node.measureInWindow((x, y, width, height) => resolve(width > 0 && height > 0 && Number.isFinite(x) && Number.isFinite(y) ? {x, y, width, height} : null))
    } catch {
      resolve(null)
    }
  })
}

/** Where `id` is on screen now, or null when it is not mounted or not showing (a parked tab measures 0 x 0). Newest copy first. */
export async function measureTarget(id: TourTargetId): Promise<Rect | null> {
  const set = nodes.get(id)
  if (!set) return null
  for (const node of [...set].reverse()) {
    const rect = await measure(node)
    if (rect) return rect
  }
  return null
}

/** Every target that is showing right now, with its rectangle. */
export async function measureTargets(): Promise<Map<TourTargetId, Rect>> {
  const out = new Map<TourTargetId, Rect>()
  for (const id of nodes.keys()) {
    const rect = await measureTarget(id)
    if (rect) out.set(id, rect)
  }
  return out
}

/* -------------------------------------------------------------------------- */
/* People's state                                                             */
/* -------------------------------------------------------------------------- */

/** What the focused People tab holds: still loading, no friends, or friends. Null while People is not the page showing. */
export type PeopleState = 'loading' | 'empty' | 'friends'

let people: PeopleState | null = null
const peopleListeners = new Set<() => void>()
const setPeople = (next: PeopleState | null) => {
  if (people === next) return
  people = next
  peopleListeners.forEach(l => l())
}

/** People publishes what it holds while it is the focused page, so the tour starts there and only there. */
export function usePublishPeopleState(state: PeopleState) {
  const isFocused = useIsFocused()
  useEffect(() => {
    if (!isFocused) return
    setPeople(state)
    return () => setPeople(null)
  }, [isFocused, state])
}

const subscribePeople = (l: () => void) => {
  peopleListeners.add(l)
  return () => void peopleListeners.delete(l)
}

/** People's published state; only the running tour reads it. */
export function usePeopleState(): PeopleState | null {
  return useSyncExternalStore(subscribePeople, () => people)
}

/* -------------------------------------------------------------------------- */
/* Replay                                                                     */
/* -------------------------------------------------------------------------- */

let isRequested = false
const requestListeners = new Set<() => void>()
const setRequested = (next: boolean) => {
  if (isRequested === next) return
  isRequested = next
  requestListeners.forEach(l => l())
}

/** "Take the tour" (Settings > Support > Help): asks the one `TourHost` to run it again. */
export const requestTour = () => setRequested(true)
/** The tour ended (Done, Skip or no target to show). */
export const endTourRequest = () => setRequested(false)

const subscribeRequest = (l: () => void) => {
  requestListeners.add(l)
  return () => void requestListeners.delete(l)
}

/** Whether a replay was asked for and has not ended yet. */
export function useIsTourRequested(): boolean {
  return useSyncExternalStore(subscribeRequest, () => isRequested)
}
