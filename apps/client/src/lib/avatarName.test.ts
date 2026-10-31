/// <reference types="bun" />
import {expect, test} from 'bun:test'

import {initials, nameHash} from './avatarName'

test('a person gets the first letters of the first and last words', () => {
  expect(initials('Bela Joshi')).toBe('BJ')
  expect(initials('  anna  maria  de souza ')).toBe('AS')
  expect(initials('Bela')).toBe('B')
  expect(initials('')).toBe('')
  expect(initials(undefined)).toBe('')
  expect(initials('😀 Smile')).toBe('😀S')
})

test('a group gets the first letters of the first two words, or two letters of one word', () => {
  expect(initials('Goa', 'group')).toBe('GO')
  expect(initials('Goa Trip 2026', 'group')).toBe('GT')
  expect(initials('  weekend   away ', 'group')).toBe('WA')
  expect(initials('A', 'group')).toBe('A')
  expect(initials('', 'group')).toBe('?')
})

test('a one-word group and a one-word person differ on purpose: the create-group preview draws the group rule', () => {
  expect(initials('Goa', 'group')).toBe('GO')
  expect(initials('Goa')).toBe('G')
})

test('the hash is stable, case and padding blind, and picks the same hue every time', () => {
  expect(nameHash('Goa')).toBe(nameHash('  goa '))
  expect(nameHash('Goa')).not.toBe(nameHash('Gob'))
  expect(nameHash(undefined)).toBe(nameHash(''))
  expect(nameHash('Goa')).toBe(nameHash('Goa'))
  // FNV-1a of "" is its offset basis.
  expect(nameHash('')).toBe(0x811c9dc5)
})
