import {useMutationCtx} from '#/data/hooks'

/**
 * My own person id (the signed-in actor). A context read, not a store subscription, so rows can ask "is this me?"
 * for free (PersonLink, owner 178). `components/` may not import `data/`, so they come here.
 */
export function useMyPersonId() {
  return useMutationCtx().actor
}
