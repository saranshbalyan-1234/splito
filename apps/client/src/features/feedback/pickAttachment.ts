// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/media/picker.shared.ts (openPicker)
import {launchImageLibraryAsync} from 'expo-image-picker'

import {logger} from '#/logger'
import {ATTACHMENT_MAX_URI_LENGTH, type PickResult} from './attachment'

/**
 * Native: the photo library, one image, re-encoded to JPEG by the picker and
 * kept as a data URI (the picker's cache file can be purged by the OS).
 */
export async function pickAttachment(): Promise<PickResult> {
  try {
    const res = await launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.5,
      base64: true,
      exif: false,
      selectionLimit: 1,
    })
    const asset = res.assets?.[0]
    if (res.canceled || !asset) return null
    if (asset.mimeType && !asset.mimeType.startsWith('image/')) {
      return {ok: false, reason: 'notImage'}
    }
    if (!asset.base64) return {ok: false, reason: 'failed'}
    const mime = asset.mimeType || 'image/jpeg'
    const uri = `data:${mime};base64,${asset.base64}`
    if (uri.length > ATTACHMENT_MAX_URI_LENGTH) {
      return {ok: false, reason: 'tooLarge'}
    }
    return {
      ok: true,
      attachment: {uri, mime, width: asset.width, height: asset.height},
    }
  } catch (e) {
    logger.error(e, {where: 'feedback.pickAttachment'})
    return {ok: false, reason: 'failed'}
  }
}
