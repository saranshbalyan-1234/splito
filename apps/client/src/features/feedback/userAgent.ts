/** The operating system from a browser's user agent, without its version. */
export function osFromUserAgent(ua: string): string {
  if (/android/i.test(ua)) return 'Android'
  if (/iphone|ipad|ipod/i.test(ua)) return 'iOS'
  if (/mac os x|macintosh/i.test(ua)) return 'macOS'
  if (/windows/i.test(ua)) return 'Windows'
  if (/cros/i.test(ua)) return 'ChromeOS'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Unknown'
}
