/**
 * Opens the browser's file chooser (a hidden input, clicked from the user's
 * tap) and reads the chosen file. Resolves null when it was dismissed: the
 * `cancel` event covers current browsers, and a window focus without a change
 * covers older ones.
 */
export function pickTextFile(): Promise<{name: string; text: string} | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? {name: file.name, text: await file.text()} : null)
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}
