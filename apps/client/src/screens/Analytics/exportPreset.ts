import {type ExportPreset} from '#/features/export/ExportSheet'
import {scopeToExportGroup} from '#/screens/Analytics/exportScope'
import {type Report} from '#/screens/Analytics/useReport'
import {useScopeLabel} from '#/screens/Analytics/useScopeLabel'

/** The Export sheet's starting filters for what Analytics shows: its period, currency and scope, as a CSV. */
export function exportPresetOf(report: Report, scopeLabel: string): ExportPreset {
  return {
    format: 'csv',
    range: report.range,
    currency: report.currency || undefined,
    scopeLabel,
    ...scopeToExportGroup(report.scope),
  }
}

/** The preset for the Export sheet, `undefined` while the report loads. */
export function useExportPreset(report: Report | undefined): ExportPreset | undefined {
  const label = useScopeLabel(
    report?.scope ?? {nonGroup: true, groups: 'all'},
    report?.groupIds ?? [],
    id => report?.nameOfGroup(id) ?? '',
  )
  return report ? exportPresetOf(report, label) : undefined
}
