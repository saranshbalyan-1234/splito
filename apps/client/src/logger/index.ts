/* eslint-disable no-console */
type Metadata = Record<string, unknown>

/**
 * Same call surface as Bluesky's logger (`logger.error(message, metadata)`),
 * console-backed. Never pass receipt text or amounts tied to people in metadata.
 */
export const logger = {
  debug: (message: string, metadata?: Metadata) => __DEV__ && console.debug(message, metadata ?? ''),
  info: (message: string, metadata?: Metadata) => console.info(message, metadata ?? ''),
  warn: (message: string, metadata?: Metadata) => console.warn(message, metadata ?? ''),
  error: (error: unknown, metadata?: Metadata) => console.error(error, metadata ?? ''),
}
