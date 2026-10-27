import {expect, test} from 'bun:test'

import {osFromUserAgent} from './userAgent'

test('names the OS without its version', () => {
  expect(osFromUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120')).toBe('macOS')
  expect(osFromUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('iOS')
  expect(osFromUserAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('Android')
  expect(osFromUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('Windows')
  expect(osFromUserAgent('curl/8')).toBe('Unknown')
})
