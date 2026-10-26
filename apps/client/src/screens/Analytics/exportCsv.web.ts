/**
 * Saves the CSV as a download. The UTF-8 byte-order mark makes Excel read
 * ₹, € and Hindi names correctly. Resolves true once handed to the browser.
 */
export function exportCsv(filename: string, csv: string): Promise<boolean> {
  const blob = new Blob(['﻿' + csv], {type: 'text/csv;charset=utf-8'})
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return Promise.resolve(true)
}
