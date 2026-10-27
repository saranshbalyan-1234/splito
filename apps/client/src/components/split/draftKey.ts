/** Where the Add expense form came from. */
export type DraftContext = {personId?: string; groupId?: string}

/** One draft slot per place the composer opens from (audit m30a): a draft is only restored where it was started. */
export function draftKey({groupId, personId}: DraftContext): string {
  const parts = [groupId ? `g:${groupId}` : '', personId ? `p:${personId}` : '']
  return parts.filter(Boolean).join('|') || 'all'
}
