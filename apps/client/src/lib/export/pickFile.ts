import {File} from 'expo-file-system'
import * as DocumentPicker from 'expo-document-picker'

/** The chosen file's name and text, or null when the picker was dismissed. */
export async function pickTextFile(): Promise<{name: string; text: string} | null> {
  const result = await DocumentPicker.getDocumentAsync({type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false})
  const asset = result.assets?.[0]
  if (result.canceled || !asset) return null
  return {name: asset.name, text: await new File(asset.uri).text()}
}
