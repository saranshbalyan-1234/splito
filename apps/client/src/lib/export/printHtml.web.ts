const FRAME_ID = 'splito-print-frame'

/**
 * Opens the statement in the browser's print dialog, where "Save as PDF" is
 * the destination. It prints from a hidden frame of this page, so no popup is
 * opened (popup blockers refuse windows opened after an `await`). The frame
 * stays until the next print replaces it. Resolves true once the dialog was asked for.
 */
export function printHtml(name: string, html: string): Promise<boolean> {
  document.getElementById(FRAME_ID)?.remove()
  const frame = document.createElement('iframe')
  frame.id = FRAME_ID
  frame.title = name
  frame.setAttribute('aria-hidden', 'true')
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden'
  return new Promise(resolve => {
    frame.onload = () => {
      frame.contentWindow?.focus()
      frame.contentWindow?.print()
      resolve(true)
    }
    frame.srcdoc = html
    document.body.appendChild(frame)
  })
}
