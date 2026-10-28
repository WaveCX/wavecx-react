/**
 * Error categories, matching `WaveCxErrorType` in the Android SDK so the same logging can be
 * shared across platforms. Browsers don't expose TLS failures separately from other network
 * failures, so `SSL_ERROR` is never reported by this SDK.
 */
export type WaveCxErrorType =
  | 'NETWORK_UNAVAILABLE'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'PARSE_ERROR'
  | 'SSL_ERROR'
  | 'UNKNOWN';

export class WaveCxError extends Error {
  readonly type: WaveCxErrorType;
  /** HTTP status of the failed response, for `SERVER_ERROR` */
  readonly httpCode?: number;
  /** The original error, when this wraps one */
  readonly cause?: unknown;

  constructor(options: {type: WaveCxErrorType; message: string; httpCode?: number; cause?: unknown}) {
    super(options.message);
    this.name = 'WaveCxError';
    this.type = options.type;
    this.httpCode = options.httpCode;
    this.cause = options.cause;
  }
}

export type ErrorHandler = (error: WaveCxError) => void | Promise<void>;

const describe = (value: unknown): string => {
  try {
    return String(value);
  } catch {
    return 'Unknown error';
  }
};

/**
 * Checks by shape as well as `instanceof`, since the CJS and ESM builds each define their own
 * `WaveCxError` class and a host may throw one from the other build.
 */
export const isWaveCxError = (value: unknown): value is WaveCxError =>
  value instanceof WaveCxError
  || (
    typeof value === 'object'
    && value !== null
    && (value as {name?: unknown}).name === 'WaveCxError'
    && typeof (value as {type?: unknown}).type === 'string'
  );

export const toWaveCxError = (error: unknown): WaveCxError => {
  if (isWaveCxError(error)) {
    return error;
  }
  return new WaveCxError({
    type: 'UNKNOWN',
    message: error instanceof Error ? error.message : describe(error),
    cause: error,
  });
};

/**
 * Whether a failed request might succeed if tried again. Errors that aren't a `WaveCxError`
 * are retried, since nothing is known about them.
 */
export const isRetryable = (error: unknown): boolean => {
  if (!isWaveCxError(error)) return true;
  switch (error.type) {
    case 'NETWORK_UNAVAILABLE':
    case 'NETWORK_TIMEOUT':
    case 'NETWORK_ERROR':
      return true;
    case 'SERVER_ERROR':
      // A 4xx will get the same response again, except timeouts and rate limiting
      return error.httpCode === undefined
        || error.httpCode >= 500
        || error.httpCode === 408
        || error.httpCode === 429;
    default:
      return false;
  }
};
