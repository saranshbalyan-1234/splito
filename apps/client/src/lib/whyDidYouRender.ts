// The library patches this very module object; a namespace import would be a copy.
// eslint-disable-next-line no-restricted-imports
import React from 'react'
import whyDidYouRender from '@welldone-software/why-did-you-render'

/**
 * Wasted-render detector (ARCHITECTURE 17, owner 108). Loaded from the client
 * entry under `if (__DEV__)` only: Metro drops the require, and this file, from
 * production and `expo export` (e2e timing) bundles. babel.config.js points the
 * dev JSX runtime at the library so every element is seen, not just `memo`.
 *
 * Every report is logged by the library's own console notifier and also kept
 * on `window.__wdyr` (compact) for the render gate (`e2e-renders/`).
 */
export type WdyrReport = {
  name: string
  owner: string
  kind: 'props' | 'state' | 'hook' | 'same'
  keys: string[]
  detail?: string
}

type Differences = {pathString: string; diffType: string}[] | false | undefined

const reports: WdyrReport[] = []
;(globalThis as unknown as {__wdyr: WdyrReport[]}).__wdyr = reports

/** A short look at a hook result for the report (values are plain data; money is bigint). */
function preview(v: unknown) {
  try {
    return JSON.stringify(v, (_k, x) =>
      typeof x === 'bigint' ? x.toString() : typeof x === 'function' ? 'fn' : x,
    )?.slice(0, 160)
  } catch {
    return String(v).slice(0, 160)
  }
}

const paths = (d: Differences | undefined) =>
  d ? d.map(x => x.pathString) : []

whyDidYouRender(React, {
  // Every component, not only memo/Pure ones: the gate must see plain function components too.
  include: [/.*/],
  trackHooks: true,
  trackExtraHooks: [],
  logOwnerReasons: true,
  notifier(info) {
    const name = info.displayName
    // The component whose render created this element: the place to fix when props are new objects for equal values.
    const ownerType = (
      info as {
        nextOwner?: {type?: {displayName?: string; name?: string}} | null
      }
    ).nextOwner?.type
    const owner = ownerType?.displayName || ownerType?.name || ''
    // The component fibers above the owner, nearest first: tells a library's anonymous inner component from ours.
    const chain: string[] = []
    type Fiber = {
      type?:
        | {
            displayName?: string
            name?: string
            type?: {name?: string}
            render?: {name?: string}
          }
        | string
      return?: Fiber | null
    }
    for (
      let f = (info as {nextOwner?: Fiber | null}).nextOwner ?? null;
      f && chain.length < 6;
      f = f.return ?? null
    ) {
      const t = f.type
      if (t && typeof t !== 'string')
        chain.push(
          t.displayName || t.name || t.type?.name || t.render?.name || '?',
        )
    }
    const r = info.reason
    // The library applies this filter only in its own console notifier: a render where any value really changed is not wasted.
    const changed = (d: unknown) =>
      !!d && (d as {diffType: string}[]).some(x => x.diffType === 'different')
    if (
      changed(r.propsDifferences) ||
      changed(r.stateDifferences) ||
      changed(r.hookDifferences)
    )
      return
    const found: Omit<WdyrReport, 'name' | 'owner'>[] = []
    if (r.propsDifferences)
      found.push({
        kind: 'props',
        keys: paths(r.propsDifferences as Differences),
      })
    if (r.stateDifferences)
      found.push({
        kind: 'state',
        keys: paths(r.stateDifferences as Differences),
      })
    if (r.hookDifferences)
      found.push({
        kind: 'hook',
        keys: [
          info.hookName ?? '?',
          ...paths(r.hookDifferences as Differences).slice(0, 2),
        ],
      })
    // Neither props, state nor a hook differ: the parent re-rendered and passed nothing new.
    if (!found.length) found.push({kind: 'same', keys: []})
    const detail = info.hookName ? preview(info.nextHookResult) : undefined
    reports.push(
      ...found.map(f => ({name, owner, ...f, detail, chain: chain.join('<')})),
    )
    // The console log is opt-in (EXPO_PUBLIC_WDYR_LOG=1): thousands of groups would flood the dev console and a native device.
    if (process.env.EXPO_PUBLIC_WDYR_LOG === '1')
      whyDidYouRender.defaultNotifier(info)
  },
})
