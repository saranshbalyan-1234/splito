import {type ComponentProps, useMemo, useState} from 'react'
import {View} from 'react-native'
import {useLingui} from '@lingui/react/macro'

import {useHiddenItems, useShowHidden} from '#/data/hiddenItems'
import {atoms as a} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as Toggle from '#/components/forms/Toggle'
import * as FormSheet from '#/components/FormSheet'
import {HideRow} from '#/features/hidden/HideItem'
import {DisputedOnlyToggle} from '#/components/disputes/DisputedOnlyToggle'
import {type HistoryEntry} from '#/components/people/ledger'

/**
 * The one "Show hidden" switch (decision 105) in a list's filters: off, what I hid (deleted items, and groups hidden
 * from my lists) stays out; on, it is back, each with "Unhide". The same switch on every list, remembered.
 */
export function ShowHiddenToggle({value, onChange}: {value: boolean; onChange: (v: boolean) => void}) {
  const {t: l} = useLingui()
  return (
    <Toggle.SwitchRow
      testID="filter-show-hidden"
      name="showHidden"
      label={l`Show hidden`}
      hint={l`Bring back what you hid from your lists. Only you ever see this choice.`}
      value={value}
      onChange={onChange}
    />
  )
}

/** A list's own filter sheet with only this switch (a group's Expenses tab). Applies and remembers on Apply. */
export function ShowHiddenSheet({control, testID, disputed}: {control: Dialog.DialogControlProps; testID: string; /** The list's "Disputed only" choice (F-1210), applied with the rest. */ disputed?: {value: boolean; onApply: (v: boolean) => void}}) {
  return (
    <FormSheet.Outer control={control} testID={testID}>
      <Form disputed={disputed} />
    </FormSheet.Outer>
  )
}

function Form({disputed}: {disputed?: {value: boolean; onApply: (v: boolean) => void}}) {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const [current, set] = useShowHidden()
  const [draft, setDraft] = useState(current)
  const [draftDisputed, setDraftDisputed] = useState(disputed?.value ?? false)
  return (
    <FormSheet.Inner
      title={l`Filter`}
      isDirty={draft !== current || draftDisputed !== (disputed?.value ?? false)}
      footer={{
        saveLabel: l`Apply`,
        onSave: () =>
          control.close(() => {
            if (draft !== current) void set(draft)
            disputed?.onApply(draftDisputed)
          }),
      }}>
      <View style={[a.gap_lg]}>
        {disputed ? <DisputedOnlyToggle value={draftDisputed} onChange={setDraftDisputed} /> : null}
        <ShowHiddenToggle value={draft} onChange={setDraft} />
      </View>
    </FormSheet.Inner>
  )
}

/**
 * A history list as I see it: entries I hid are out unless "Show hidden" is on. Filtered after the paged read (a
 * hidden set is a handful of ids), so the page reads stay the same index reads.
 */
export function useVisibleEntries(entries: HistoryEntry[]) {
  const hidden = useHiddenItems()
  const [showHidden] = useShowHidden()
  const visible = useMemo(() => (showHidden || hidden.size === 0 ? entries : entries.filter(e => !(e.entity.deleted && hidden.has(e.entity.id)))), [entries, hidden, showHidden])
  return {visible, hidden, showHidden}
}

/** Hide / Unhide of a deleted history row, for `HistoryRow`'s `hide` prop; live rows have none. */
export function historyRowHide(entry: HistoryEntry, hidden: ReadonlySet<string>, fallbackName: string) {
  if (!entry.entity.deleted) return undefined
  const isHidden = hidden.has(entry.entity.id)
  const name = entry.kind === 'expense' ? entry.entity.data.title : fallbackName
  return {
    isHidden,
    wrap: (row: ComponentProps<typeof HideRow>['row'], style: ComponentProps<typeof HideRow>['style']) => (
      <HideRow
        testID={`history-${entry.entity.id}-more`}
        target={{type: entry.kind, id: entry.entity.id}}
        isHidden={isHidden}
        name={name}
        style={style}
        row={row}
      />
    ),
  }
}
