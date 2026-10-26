import {Share} from 'react-native'

/**
 * Hands the CSV to the system share sheet (save to Files, mail, Drive...).
 * Resolves true when the user shared it, false when they dismissed the sheet.
 * ponytail: shared as text, not a file attachment; add expo-file-system +
 * expo-sharing when a real .csv file in the share sheet is needed.
 */
export async function exportCsv(
  filename: string,
  csv: string,
): Promise<boolean> {
  const result = await Share.share({title: filename, message: csv})
  return result.action === Share.sharedAction
}
