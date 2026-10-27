import {expect, test} from 'bun:test'

import {searchAskKeyAction, shortcutHint} from './hotkeyAction'

const key = (
  k: string,
  extra: Partial<Parameters<typeof searchAskKeyAction>[0]> = {},
) => ({
  key: k,
  metaKey: false,
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  isEditable: false,
  isOpen: false,
  ...extra,
})

test('Cmd+K and Ctrl+K toggle the drawer from anywhere, typing included', () => {
  expect(searchAskKeyAction(key('k', {metaKey: true}))).toBe('toggle')
  expect(searchAskKeyAction(key('K', {ctrlKey: true}))).toBe('toggle')
  expect(searchAskKeyAction(key('k', {metaKey: true, isEditable: true}))).toBe(
    'toggle',
  )
  expect(searchAskKeyAction(key('k', {ctrlKey: true, isOpen: true}))).toBe(
    'toggle',
  )
})

test('other chords and plain K are left alone', () => {
  expect(searchAskKeyAction(key('k'))).toBe(null)
  expect(searchAskKeyAction(key('k', {metaKey: true, shiftKey: true}))).toBe(
    null,
  )
  expect(searchAskKeyAction(key('k', {ctrlKey: true, altKey: true}))).toBe(null)
  expect(searchAskKeyAction(key('j', {metaKey: true}))).toBe(null)
})

test('"/" opens it, but never while typing or already open', () => {
  expect(searchAskKeyAction(key('/'))).toBe('open')
  expect(searchAskKeyAction(key('/', {isEditable: true}))).toBe(null)
  expect(searchAskKeyAction(key('/', {isOpen: true}))).toBe(null)
  expect(searchAskKeyAction(key('/', {ctrlKey: true}))).toBe(null)
})

test('the hint names the platform key', () => {
  expect(shortcutHint('MacIntel')).toBe('⌘K')
  expect(shortcutHint('iPad')).toBe('⌘K')
  expect(shortcutHint('Win32')).toBe('Ctrl K')
  expect(shortcutHint('Linux x86_64')).toBe('Ctrl K')
})
