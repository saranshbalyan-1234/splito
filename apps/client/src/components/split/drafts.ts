import {Storage} from '#/storage'
import {type DraftContext, draftKey} from './draftKey'
import {type ExpenseForm} from './form'

export type {DraftContext} from './draftKey'

type Schema = {
  addExpense: {form: ExpenseForm; context: DraftContext; savedAt: number}
}

/**
 * The unsaved Add expense forms, on this device only (MMKV natively,
 * localStorage on web), one per place the composer opens from. They survive
 * closing the composer, reloads and app restarts, and are cleared on save or
 * discard. (The old single `addExpense` slot is no longer read.)
 */
const drafts = new Storage<[string], Schema>({id: 'splito_drafts'})

export function readDraft(context: DraftContext): ExpenseForm | undefined {
  try {
    return drafts.get([draftKey(context), 'addExpense'])?.form
  } catch {
    return undefined
  }
}

export function writeDraft(form: ExpenseForm, context: DraftContext) {
  drafts.set([draftKey(context), 'addExpense'], {
    form,
    context,
    savedAt: Date.now(),
  })
}

export function clearDraft(context: DraftContext) {
  drafts.remove([draftKey(context), 'addExpense'])
}
