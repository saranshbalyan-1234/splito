import {expect, mock, test} from 'bun:test'

;(globalThis as {__DEV__?: boolean}).__DEV__ = false

/* MMKV is native; a Map stands in for it so the scoping of keys can be checked under Bun. */
mock.module('react-native-mmkv', () => ({
  MMKV: class {
    m = new Map<string, string>()
    set(k: string, v: string) {
      this.m.set(k, v)
    }
    getString(k: string) {
      return this.m.get(k)
    }
    delete(k: string) {
      this.m.delete(k)
    }
    getAllKeys() {
      return [...this.m.keys()]
    }
    clearAll() {
      this.m.clear()
    }
    addOnValueChangedListener() {
      return {remove() {}}
    }
  },
}))

test('reminder bookkeeping is kept per mode: demo mode never sees or overwrites the real armed ids', async () => {
  const {setStorageScope, clearStorageScope} = await import('#/storage')
  const {remindDevice} = await import('./storage')
  setStorageScope('')
  remindDevice.set(['armed'], {r1: {osIds: ['n1'], key: 'k', rearmAt: null}})
  setStorageScope('demo:')
  expect(remindDevice.get(['armed'])).toBeUndefined()
  remindDevice.set(['armed'], {})
  remindDevice.set(['checkedAt'], 5)
  setStorageScope('')
  expect(Object.keys(remindDevice.get(['armed']) ?? {})).toEqual(['r1'])
  expect(remindDevice.get(['checkedAt'])).toBeUndefined()
  // Turning demo mode off erases its keys, the real ones stay (owner 136).
  clearStorageScope('demo:')
  setStorageScope('demo:')
  expect(remindDevice.get(['armed'])).toBeUndefined()
  setStorageScope('')
  expect(Object.keys(remindDevice.get(['armed']) ?? {})).toEqual(['r1'])
})
