import {useEffect, useId} from 'react'

/*
 * ARCHITECTURE 15: no automatic reload while a sheet holds unsaved input.
 * Outbox rows live in IndexedDB and never count.
 */
const dirty = new Set<string>()

export function markWorkAtStake(id: string, isDirty: boolean) {
  if (isDirty) dirty.add(id)
  else dirty.delete(id)
}

export function hasWorkAtStake() {
  return dirty.size > 0
}

/** A form with unsaved changes reports itself while it is mounted. */
export function useWorkAtStake(isDirty: boolean) {
  const id = useId()
  useEffect(() => {
    markWorkAtStake(id, isDirty)
    return () => markWorkAtStake(id, false)
  }, [id, isDirty])
}
