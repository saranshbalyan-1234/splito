/** The database every build used before accounts (F-250): one per device, no owner. */
export const LEGACY_STORE = 'splito'

/** What an account id may look like before it becomes part of a file or database name (the real API's ids, and the dev ones). */
const ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/
export const isAccountId = (id: unknown): id is string => typeof id === 'string' && ACCOUNT_ID.test(id)

/** One database per account (ARCHITECTURE 26.15), named by the account id, so two accounts on a device never mix. */
export function accountStoreName(accountId: string) {
  if (!isAccountId(accountId)) throw new Error('INVALID_ACCOUNT_ID')
  return `splito-acct-${accountId}`
}

/** The device-key prefix of one account's demo mode (its database is `demoMode.ts`'s): never shared with another account's. */
export const demoScope = (accountId: string) => `demo:${accountId}:`
