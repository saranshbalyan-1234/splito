import {Platform} from 'react-native'
import {type FeedbackAppInfo} from '@splito/sync'

import {APP_VERSION, IS_WEB} from '#/env'
import {osFromUserAgent} from './userAgent'

/**
 * Exactly what "Include app info" attaches: version, platform, OS, language
 * and the screen feedback was opened from. Never amounts, names, notes or
 * receipts (the record's whitelist enforces it again).
 */
export function collectAppInfo(
  screen: string,
  language: string,
): FeedbackAppInfo {
  return {
    version: APP_VERSION,
    platform: IS_WEB ? 'web' : Platform.OS,
    os: IS_WEB
      ? osFromUserAgent(navigator.userAgent)
      : `${Platform.OS === 'ios' ? 'iOS' : 'Android'} ${Platform.Version}`,
    language,
    screen,
  }
}
