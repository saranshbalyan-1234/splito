import {type ErrorCode, type ErrorEnvelope, ERRORS} from '@splito/contracts'

/** Thrown anywhere in a request; the app's error handler turns it into the contract envelope. */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

/** Builds the contract error body; retryability comes from the code. */
export function envelope(
  code: ErrorCode,
  message: string,
  details?: unknown,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      retryable: ERRORS[code].retryable,
      ...(details === undefined ? {} : {details}),
    },
  }
}
