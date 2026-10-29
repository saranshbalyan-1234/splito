/** Where the Add expense form came from. */
export type DraftContext = {personId?: string; groupId?: string}

/** One draft slot per place the composer opens from (audit m30a): a draft is only restored where it was started. */
export function draftKey({groupId, personId}: DraftContext): string {
  const parts = [groupId ? `g:${groupId}` : '', personId ? `p:${personId}` : '']
  return parts.filter(Boolean).join('|') || 'all'
}

/**
 * The slot a composer writes its draft to, if it owns one. A form an Ask Splito card prefilled owns none: it
 * must never write over, or clear, the draft the user saved for the same place.
 */
export function draftContextFor(context: DraftContext, isPrefilled: boolean): DraftContext | undefined {
  return isPrefilled ? undefined : context
}
