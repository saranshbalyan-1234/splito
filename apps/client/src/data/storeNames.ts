/** The database every build used before accounts (F-250): one per device, no owner. */
export const LEGACY_STORE = 'splito'

/** One database per account (ARCHITECTURE 26.15), named by the account id, so two accounts on a device never mix. */
export const accountStoreName = (accountId: string) => `splito-acct-${accountId}`
