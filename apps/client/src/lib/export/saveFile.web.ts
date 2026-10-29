/**
 * Saves a text file as a browser download. A UTF-8 byte-order mark goes in
 * front of CSV so Excel reads rupee signs, euros and Hindi names correctly.
 * Resolves true once handed to the browser.
 */
export function saveFile(name: string, mime: string, text: string): Promise<boolean> {
  const blob = new Blob([mime.startsWith('text/csv') ? '﻿' + text : text], {type: `${mime};charset=utf-8`})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return Promise.resolve(true)
}
