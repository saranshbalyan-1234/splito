import {saveFile} from '#/lib/export/saveFile'

/**
 * Saves the CSV as a real .csv file and opens the share sheet (Files, Drive,
 * mail...). Resolves true once the sheet was shown.
 */
export function exportCsv(filename: string, csv: string): Promise<boolean> {
  return saveFile(filename, 'text/csv', csv)
}
