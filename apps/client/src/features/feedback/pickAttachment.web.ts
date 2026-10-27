// Adapted from bluesky-social/social-app@4e4ad9c (MIT) - src/lib/media/picker.shared.ts (openPicker; web uses a file input)
import {logger} from '#/logger'
import {
  ATTACHMENT_MAX_SIDE,
  ATTACHMENT_MAX_URI_LENGTH,
  type PickResult,
} from './attachment'

/** Resolves with the chosen file, or null when the dialog is cancelled. */
function chooseFile(): Promise<File | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => resolve(input.files?.[0] ?? null)
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/**
 * Web: a file input (phones offer the camera too), then the picture is
 * scaled down and re-encoded to a JPEG data URI, since blob URLs die with
 * the tab.
 */
export async function pickAttachment(): Promise<PickResult> {
  const file = await chooseFile()
  if (!file) return null
  if (!file.type.startsWith('image/')) return {ok: false, reason: 'notImage'}
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(
      1,
      ATTACHMENT_MAX_SIDE / Math.max(bitmap.width, bitmap.height),
    )
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return {ok: false, reason: 'failed'}
    /* JPEG has no alpha: transparent screenshots would turn black. */
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()
    const uri = canvas.toDataURL('image/jpeg', 0.8)
    if (uri.length > ATTACHMENT_MAX_URI_LENGTH) {
      return {ok: false, reason: 'tooLarge'}
    }
    return {ok: true, attachment: {uri, mime: 'image/jpeg', width, height}}
  } catch (e) {
    logger.error(e, {where: 'feedback.pickAttachment'})
    return {ok: false, reason: 'failed'}
  }
}
