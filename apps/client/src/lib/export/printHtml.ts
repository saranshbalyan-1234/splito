import {File, Paths} from 'expo-file-system'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'

/**
 * Renders the statement HTML to a PDF file on the device (expo-print), named
 * `name`, and opens the share sheet so it can be saved or sent. No server is
 * involved. Resolves true once the sheet was shown, false where the device
 * has none; the file is deleted afterwards either way.
 */
export async function printHtml(name: string, html: string): Promise<boolean> {
  const {uri} = await Print.printToFileAsync({html})
  const printed = new File(uri)
  const named = new File(Paths.cache, name)
  try {
    if (named.exists) named.delete()
    printed.move(named)
    if (!(await Sharing.isAvailableAsync())) return false
    await Sharing.shareAsync(named.uri, {mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: name})
    return true
  } finally {
    if (printed.exists) printed.delete()
    if (named.exists) named.delete()
  }
}
