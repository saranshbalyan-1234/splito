export type HistoryKind = 'created' | 'edited' | 'deleted' | 'restored'

/**
 * What one stored version of a record did, from the version before it: the first is "created", a version that
 * deletes a live record is "deleted", one that revives a deleted record is "restored", and any other change is an
 * edit. The expense page and the payment page both read their history through this.
 */
export function historyKind(row: {deleted: boolean}, prev: {deleted: boolean} | undefined): HistoryKind {
  if (!prev) return 'created'
  if (row.deleted && !prev.deleted) return 'deleted'
  if (!row.deleted && prev.deleted) return 'restored'
  return 'edited'
}
