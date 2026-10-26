/** Exclusive bound on the magnitude of any money value, in minor units. */
export const MAX_MINOR = 10n ** 15n

export class DomainError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'DomainError'
  }
}

export function assertInRange(minor: bigint): bigint {
  if (minor >= MAX_MINOR || minor <= -MAX_MINOR) throw new DomainError('OUT_OF_RANGE')
  return minor
}
