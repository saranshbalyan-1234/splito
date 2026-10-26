import {Storage} from '#/storage'
import {type ExpenseForm} from './form'

/** Where the Add expense form came from; a draft is only restored into the same place. */
export type DraftContext = {personId?: string; groupId?: string}

type Schema = {
  addExpense: {form: ExpenseForm; context: DraftContext; savedAt: number}
}

/**
 * The unsaved Add expense form, on this device only (MMKV natively,
 * localStorage on web). It survives closing the composer, reloads and app
 * restarts, and is cleared on save or discard.
 * ponytail: one draft slot; keep a list if people ask for several drafts.
 */
const drafts = new Storage<[], Schema>({id: 'splito_drafts'})

export function readDraft(context: DraftContext): ExpenseForm | undefined {
  try {
    const d = drafts.get(['addExpense'])
    if (!d) return undefined
    const isSamePlace = (d.context.groupId ?? null) === (context.groupId ?? null) && (d.context.personId ?? null) === (context.personId ?? null)
    return isSamePlace || (!context.groupId && !context.personId) ? d.form : undefined
  } catch {
    return undefined
  }
}

export function writeDraft(form: ExpenseForm, context: DraftContext) {
  drafts.set(['addExpense'], {form, context, savedAt: Date.now()})
}

export function clearDraft() {
  drafts.remove(['addExpense'])
}
