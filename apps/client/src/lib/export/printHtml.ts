import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

/**
 * Renders the statement HTML to a PDF file on the device (expo-print) and
 * opens the share sheet so it can be saved or sent. No server is involved.
 * Resolves true once the sheet was shown.
 */
export async function printHtml(name: string, html: string): Promise<boolean> {
  const {uri} = await Print.printToFileAsync({html})
  if (!(await Sharing.isAvailableAsync())) return false
  await Sharing.shareAsync(uri, {mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name})
  return true
}
