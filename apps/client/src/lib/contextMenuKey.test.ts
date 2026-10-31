import {expect, test} from 'bun:test'

import {isContextMenuKey} from './contextMenuKey'

test('the ContextMenu key and Shift+F10 open a row menu, other keys do not', () => {
  expect(isContextMenuKey({key: 'ContextMenu', shiftKey: false})).toBe(true)
  expect(isContextMenuKey({key: 'F10', shiftKey: true})).toBe(true)
  expect(isContextMenuKey({key: 'F10', shiftKey: false})).toBe(false)
  expect(isContextMenuKey({key: 'Enter', shiftKey: true})).toBe(false)
})
