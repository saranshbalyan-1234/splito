/**
 * Opens the browser's file chooser (a hidden input, clicked from the user's
 * tap) and reads the chosen file. Resolves null when it was dismissed: the
 * `cancel` event covers current browsers, and the window getting focus back
 * with no file chosen covers older ones, so the sheet is never left waiting.
 */
export function pickTextFile(): Promise<{name: string; text: string} | null> {
  return new Promise(resolve => {
    let isSettled = false
    const settle = (value: {name: string; text: string} | null) => {
      if (isSettled) return
      isSettled = true
      window.removeEventListener('focus', onFocus)
      resolve(value)
    }
    // A change event can arrive a moment after focus returns, so give it time before calling it a dismissal.
    const onFocus = () => setTimeout(() => !input.files?.length && settle(null), 1000)
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.onchange = async () => {
      const file = input.files?.[0]
      settle(file ? {name: file.name, text: await file.text()} : null)
    }
    input.oncancel = () => settle(null)
    window.addEventListener('focus', onFocus)
    input.click()
  })
}
