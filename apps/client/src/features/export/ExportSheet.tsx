import {useState} from 'react'
import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'
import {CURRENCIES, type DateRange, periodRange, type StatementFilter, type WeekStart} from '@splito/domain'
import {createBackup, serializeBackup} from '@splito/sync'

import {saveFile} from '#/lib/export/saveFile'
import {printHtml} from '#/lib/export/printHtml'
import {statementCsv, statementHtml} from '#/lib/export/statementFormat'
import {useHaptics} from '#/lib/haptics'
import {logger} from '#/logger'
import {loadStatement} from '#/data/exportLedger'
import {useMutationCtx, usePref, useStore} from '#/data/hooks'
import {useToday} from '#/locale/useDates'
import {RangeDialog} from '#/screens/Analytics/components/RangeDialog'
import {atoms as a, useTheme} from '#/alf'
import * as Dialog from '#/components/Dialog'
import * as FormSheet from '#/components/FormSheet'
import * as SegmentedControl from '#/components/forms/SegmentedControl'
import {
  DatabaseBackup_Stroke2_Corner0_Rounded as BackupIcon,
  FileSpreadsheet_Stroke2_Corner0_Rounded as CsvIcon,
  FileExport_Stroke2_Corner0_Rounded as ExportIcon,
  FileText_Stroke2_Corner0_Rounded as PdfIcon,
} from '#/components/icons/Export'
import * as Menu from '#/components/Menu'
import {OptionDialog} from '#/components/settings/OptionDialog'
import {PickerTrigger} from '#/components/settings/controls'
import * as Toast from '#/components/Toast'
import {Text} from '#/components/Typography'
import {IS_WEB} from '#/env'
import {useStatementText} from './statementText'

type Format = 'csv' | 'pdf' | 'backup'
type Period = 'all' | 'month' | 'lastMonth' | 'year' | 'custom'

/** What an entry point fills in before the sheet opens. */
export interface ExportPreset {
  format?: Format
  groupId?: string
  personId?: string
  currency?: string
}

/**
 * Export centre (F-2007). CSV and PDF statements are built on the device from
 * the local ledger and work offline; the full backup is the JSON file F-2001
 * restores. Filters: date range, group, person and currency. Currencies are
 * never added together: every balance stays in its own currency.
 */
export function ExportSheet({control, preset}: {control: Dialog.DialogControlProps; preset?: ExportPreset}) {
  return (
    <FormSheet.Outer control={control} testID="export-sheet">
      <Form preset={preset} />
    </FormSheet.Outer>
  )
}

/** The sheet for an entry point: `open()` and the element to render once. */
export function useExportSheet(preset?: ExportPreset) {
  const control = Dialog.useDialogControl({url: 'export'})
  return {open: control.open, element: <ExportSheet control={control} preset={preset} />}
}

/** The shared overflow row ("Export", "Export statement") the group and friend menus mount. */
export function ExportMenuItem({testID, label, onPress}: {testID: string; label: string; onPress: () => void}) {
  return (
    <Menu.Item testID={testID} label={label} onPress={onPress}>
      <Menu.ItemText>{label}</Menu.ItemText>
      <Menu.ItemIcon icon={ExportIcon} position="right" />
    </Menu.Item>
  )
}

function Form({preset}: {preset?: ExportPreset}) {
  const t = useTheme()
  const {t: l, i18n} = useLingui()
  const control = Dialog.useDialogContext()
  const store = useStore()
  const ctx = useMutationCtx()
  const haptics = useHaptics()
  const today = useToday()
  const [weekStartPref = 1] = usePref('weekStart')
  const words = useStatementText()
  const [format, setFormat] = useState<Format>(preset?.format ?? 'pdf')
  const [period, setPeriod] = useState<Period>('all')
  const [custom, setCustom] = useState<DateRange>()
  const [groupId, setGroupId] = useState(preset?.groupId ?? '')
  const [personId, setPersonId] = useState(preset?.personId ?? '')
  const [currency, setCurrency] = useState(preset?.currency ?? '')
  const [isBusy, setIsBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const periodControl = Dialog.useDialogControl({url: 'export/period'})
  const groupControl = Dialog.useDialogControl({url: 'export/group'})
  const personControl = Dialog.useDialogControl({url: 'export/person'})
  const currencyControl = Dialog.useDialogControl({url: 'export/currency'})
  const rangeControl = Dialog.useDialogControl({url: 'export/range'})

  const range = (): DateRange | undefined => {
    const ws = weekStartPref as WeekStart
    if (period === 'month') return periodRange('month', today, ws, 0)
    if (period === 'lastMonth') return periodRange('month', today, ws, -1)
    if (period === 'year') return periodRange('year', today, ws, 0)
    return period === 'custom' ? custom : undefined
  }
  const day = (d: string) => i18n.date(new Date(`${d}T00:00:00Z`), {dateStyle: 'medium', timeZone: 'UTC'})
  const periodLabel = (p: Period) =>
    ({all: l`All time`, month: l`This month`, lastMonth: l`Last month`, year: l`This year`, custom: custom ? `${day(custom.from)} – ${day(custom.to)}` : l`Custom range`})[p]

  const groups = (words.groups ?? []).filter(g => !g.deleted)
  const friends = (words.people ?? []).filter(p => !p.deleted && !p.data.isMe)
  const isBackup = format === 'backup'
  const groupName = groups.find(g => g.id === groupId)?.data.name
  const personName = friends.find(p => p.id === personId)?.data.name

  /* Sharing unavailable or the file could not be made: say so, change nothing, stay open. */
  const fail = () => {
    haptics.error()
    setFailed(true)
    setIsBusy(false)
  }

  const run = async () => {
    setIsBusy(true)
    setFailed(false)
    try {
      if (isBackup) {
        const file = await createBackup(store, ctx)
        const count = Object.values(file.entities).reduce((n, list) => n + list.length, 0)
        const isShared = await saveFile(`splito-backup-${today}.json`, 'application/json', serializeBackup(file))
        if (!isShared) return fail()
        haptics.success()
        control.close(() => Toast.show(IS_WEB ? l`Backup downloaded (${count} records)` : l`Backup ready to save (${count} records)`, {type: 'success'}))
        return
      }
      const r = range()
      const filter: StatementFilter = {from: r?.from, to: r?.to, groupId: groupId || null, personId: personId || null, currency: currency || null}
      const statement = await loadStatement(store, ctx.actor, filter, today)
      const subject = personName ? l`With ${personName}` : (groupName ?? l`All activity`)
      const slug = (personName ?? groupName ?? 'all').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '') || 'all'
      const name = `splito-statement-${slug}-${today}`
      const owner = words.people?.find(p => p.id === ctx.actor)?.data.name ?? ''
      const isDone =
        format === 'csv'
          ? await saveFile(`${name}.csv`, 'text/csv', statementCsv(statement, words.text))
          : await printHtml(`${name}.pdf`, statementHtml(statement, words.text, words.page({subject, from: r?.from, to: r?.to, owner}), words.locale))
      if (!isDone) return fail()
      haptics.success()
      const n = statement.rows.length
      control.close(() =>
        Toast.show(
          format === 'pdf' && IS_WEB ? l`Print dialog opened. Choose Save as PDF.` : n === 1 ? l`Exported 1 record` : l`Exported ${n} records`,
          {type: 'success'},
        ),
      )
    } catch (e) {
      logger.error(e, {where: 'ExportSheet.run'})
      fail()
    }
  }

  const FORMATS: Array<{value: Format; label: string; icon: typeof CsvIcon; hint: string}> = [
    {value: 'pdf', label: l`PDF`, icon: PdfIcon, hint: l`A tidy statement with a running balance for each currency. Print it or save it as a PDF.`},
    {value: 'csv', label: l`CSV`, icon: CsvIcon, hint: l`One row per record, for a spreadsheet. Amounts are exact, with their currency beside them.`},
    {value: 'backup', label: l`Backup`, icon: BackupIcon, hint: l`Everything on this device in one file: people, groups, expenses, payments, settings and history. Restore it from Settings > Import.`},
  ]
  const current = FORMATS.find(f => f.value === format)!

  const allOption = (label: string) => ({value: '', label})
  return (
    <FormSheet.Inner
      title={l`Export`}
      footer={{
        saveLabel: isBackup ? l`Save backup` : format === 'pdf' ? l`Create PDF` : l`Export CSV`,
        canSave: !isBusy && (period !== 'custom' || !!custom),
        onSave: () => void run(),
      }}>
      <View style={[a.gap_xl]}>
        <View style={[a.gap_md]}>
          <SegmentedControl.Root type="radio" label={l`Export format`} value={format} onChange={v => setFormat(v as Format)}>
            {FORMATS.map(f => (
              <SegmentedControl.Item key={f.value} testID={`export-format-${f.value}`} label={f.label} value={f.value}>
                <SegmentedControl.ItemText>{f.label}</SegmentedControl.ItemText>
              </SegmentedControl.Item>
            ))}
          </SegmentedControl.Root>
          <View style={[a.flex_row, a.gap_md, a.align_start]}>
            <current.icon size="md" fill={t.palette.primary_500} />
            <Text testID="export-format-hint" style={[a.flex_1, a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              {current.hint}
            </Text>
          </View>
        </View>

        {isBackup ? (
          <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
            <Trans>The file stays on your device until you choose where to send it. Keep it somewhere safe: it holds everything you have recorded.</Trans>
          </Text>
        ) : (
          <View style={[a.gap_lg]}>
            <Field label={l`Period`}>
              <PickerTrigger testID="export-period" label={l`Choose period`} value={periodLabel(period)} onPress={periodControl.open} />
            </Field>
            <Field label={l`Group`}>
              <PickerTrigger testID="export-group" label={l`Choose group`} value={groupName ?? l`All groups`} onPress={groupControl.open} />
            </Field>
            <Field label={l`Friend`}>
              <PickerTrigger testID="export-person" label={l`Choose friend`} value={personName ?? l`Everyone`} onPress={personControl.open} />
            </Field>
            <Field label={l`Currency`}>
              <PickerTrigger testID="export-currency" label={l`Choose currency`} value={currency || l`All currencies`} onPress={currencyControl.open} />
            </Field>
            <Text style={[a.text_sm, a.leading_snug, t.atoms.text_contrast_medium]}>
              <Trans>Made on this device, works offline. Each currency keeps its own running balance; they are never added together.</Trans>
            </Text>
          </View>
        )}
        {failed && (
          <Text testID="export-error" style={[a.text_sm, {color: t.palette.negative_500}]}>
            <Trans>Couldn’t export. Nothing was changed. Try again.</Trans>
          </Text>
        )}
      </View>

      <OptionDialog
        testID="export-period-dialog"
        control={periodControl}
        title={l`Period`}
        searchLabel={l`Search periods`}
        options={(['all', 'month', 'lastMonth', 'year', 'custom'] as const).map(p => ({value: p, label: p === 'custom' ? l`Custom range` : periodLabel(p)}))}
        value={period}
        onSelect={v => {
          setPeriod(v as Period)
          if (v === 'custom') rangeControl.open()
        }}
      />
      <RangeDialog control={rangeControl} initial={custom} today={today} weekStart={weekStartPref as WeekStart} onApply={setCustom} />
      <OptionDialog
        testID="export-group-dialog"
        control={groupControl}
        title={l`Group`}
        searchLabel={l`Search groups`}
        options={[allOption(l`All groups`), ...groups.map(g => ({value: g.id, label: g.data.name}))]}
        value={groupId}
        onSelect={setGroupId}
      />
      <OptionDialog
        testID="export-person-dialog"
        control={personControl}
        title={l`Friend`}
        searchLabel={l`Search friends`}
        options={[allOption(l`Everyone`), ...friends.map(p => ({value: p.id, label: p.data.name}))]}
        value={personId}
        onSelect={setPersonId}
      />
      <OptionDialog
        testID="export-currency-dialog"
        control={currencyControl}
        title={l`Currency`}
        searchLabel={l`Search currencies`}
        options={[allOption(l`All currencies`), ...Object.values(CURRENCIES).map(c => ({value: c.code, label: c.code, hint: c.name, keywords: c.name}))]}
        value={currency}
        onSelect={setCurrency}
      />
    </FormSheet.Inner>
  )
}

function Field({label, children}: {label: string; children: React.ReactNode}) {
  const t = useTheme()
  return (
    <View style={[a.gap_xs]}>
      <Text style={[a.text_sm, a.font_semi_bold, t.atoms.text_contrast_medium]}>{label}</Text>
      <View style={[a.flex_row]}>{children}</View>
    </View>
  )
}
