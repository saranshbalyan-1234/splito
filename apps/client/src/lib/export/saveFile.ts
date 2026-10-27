import {File, Paths} from 'expo-file-system'
import * as Sharing from 'expo-sharing'

/**
 * Writes a text file to the app's cache and hands it to the system share
 * sheet (Save to Files, Drive, mail...). Resolves true once the sheet was
 * shown, false where the device has none. Nothing leaves the device by itself.
 */
export async function saveFile(name: string, mime: string, text: string): Promise<boolean> {
  const file = new File(Paths.cache, name)
  file.create({overwrite: true})
  file.write(text)
  if (!(await Sharing.isAvailableAsync())) return false
  await Sharing.shareAsync(file.uri, {mimeType: mime, dialogTitle: name})
  return true
}
