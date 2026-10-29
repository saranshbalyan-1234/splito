import {saveFile} from '#/lib/export/saveFile'

/** Saves the CSV as a download (the UTF-8 byte-order mark is added for Excel). */
export function exportCsv(filename: string, csv: string): Promise<boolean> {
  return saveFile(filename, 'text/csv', csv)
}
