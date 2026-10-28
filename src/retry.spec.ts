import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retryWithBackoff, defaultRetryConfig, type RetryConfig } from './retry';
import { WaveCxError } from './errors';

describe('retryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns result on first successful attempt', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = retryWithBackoff(fn);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries on failure and eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Attempt 1 failed'))
      .mockRejectedValueOnce(new Error('Attempt 2 failed'))
      .mockResolvedValue('success');

    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
    };

    const resultPromise = retryWithBackoff(fn, config);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('throws error after max attempts are exhausted', async () => {
    const error = new Error('Always fails');
    const fn = vi.fn().mockRejectedValue(error);

    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
    };

    const promise = retryWithBackoff(fn, config);

    // Run timers and wait for rejection in parallel
    await Promise.all([
      vi.runAllTimersAsync(),
      expect(promise).rejects.toThrow('Always fails')
    ]);

    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('uses exponential backoff delays', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockResolvedValue('success');

    const config: RetryConfig = {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
    };

    const resultPromise = retryWithBackoff(fn, config);

    // First attempt fails immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // Wait for first retry delay (1000ms)
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Wait for second retry delay (2000ms = 1000 * 2)
    await vi.advanceTimersByTimeAsync(2000);
    expect(fn).toHaveBeenCalledTimes(3);

    await resultPromise;
  });

  it('caps delay at maxDelay', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail 1'))
      .mockRejectedValueOnce(new Error('Fail 2'))
      .mockRejectedValueOnce(new Error('Fail 3'))
      .mockResolvedValue('success');

    const config: RetryConfig = {
      maxAttempts: 4,
      initialDelay: 1000,
      maxDelay: 2500, // Cap at 2.5 seconds
      multiplier: 3,
    };

    const resultPromise = retryWithBackoff(fn, config);

    // First attempt
    await vi.advanceTimersByTimeAsync(0);
    expect(fn).toHaveBeenCalledTimes(1);

    // Second attempt after 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Third attempt after 2500ms (capped from 3000ms)
    await vi.advanceTimersByTimeAsync(2500);
    expect(fn).toHaveBeenCalledTimes(3);

    // Fourth attempt after 2500ms (still capped)
    await vi.advanceTimersByTimeAsync(2500);
    expect(fn).toHaveBeenCalledTimes(4);

    await resultPromise;
  });

  it('uses default config when not provided', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const resultPromise = retryWithBackoff(fn);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('calls debug log with attempt information', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('Fail'))
      .mockResolvedValue('success');

    const debugLog = vi.fn();

    const config: RetryConfig = {
      maxAttempts: 2,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
    };

    const resultPromise = retryWithBackoff(fn, config, debugLog);
    await vi.runAllTimersAsync();
    await resultPromise;

    expect(debugLog).toHaveBeenCalledWith('Attempt 1/2');
    expect(debugLog).toHaveBeenCalledWith('Attempt 1 failed, retrying in 1000ms', expect.any(Object));
    expect(debugLog).toHaveBeenCalledWith('Attempt 2/2');
  });

  it('logs when all attempts fail', async () => {
    const error = new Error('Always fails');
    const fn = vi.fn().mockRejectedValue(error);
    const debugLog = vi.fn();

    const config: RetryConfig = {
      maxAttempts: 2,
      initialDelay: 1000,
      maxDelay: 10000,
      multiplier: 2,
    };

    const promise = retryWithBackoff(fn, config, debugLog);

    // Run timers and wait for rejection in parallel
    await Promise.all([
      vi.runAllTimersAsync(),
      expect(promise).rejects.toThrow('Always fails')
    ]);

    expect(debugLog).toHaveBeenCalledWith('All 2 attempts failed', expect.any(Object));
  });

  it('preserves error type when all attempts fail', async () => {
    class CustomError extends Error {
      constructor(message: string, public code: number) {
        super(message);
      }
    }

    const error = new CustomError('Custom error', 404);
    const fn = vi.fn().mockRejectedValue(error);

    const config: RetryConfig = {
      maxAttempts: 2,
      initialDelay: 100,
      maxDelay: 1000,
      multiplier: 2,
    };

    const promise = retryWithBackoff(fn, config);

    // Run timers and wait for rejection in parallel, then check error properties
    let caughtError: unknown;
    await Promise.all([
      vi.runAllTimersAsync(),
      promise.catch(err => { caughtError = err; throw err; })
    ]).catch(() => {
      // Expected to throw
    });

    expect(caughtError).toBeInstanceOf(CustomError);
    expect((caughtError as CustomError).code).toBe(404);
    expect((caughtError as CustomError).message).toBe('Custom error');
  });

  it.each([
    ['a 400', new WaveCxError({type: 'SERVER_ERROR', message: 'bad request', httpCode: 400})],
    ['a 401', new WaveCxError({type: 'SERVER_ERROR', message: 'unauthorized', httpCode: 401})],
    ['a 404', new WaveCxError({type: 'SERVER_ERROR', message: 'not found', httpCode: 404})],
    ['a parse error', new WaveCxError({type: 'PARSE_ERROR', message: 'bad json'})],
    [
      'a WaveCxError from the other bundle',
      Object.assign(new Error('bad request'), {name: 'WaveCxError', type: 'SERVER_ERROR', httpCode: 400}),
    ],
  ])('does not retry %s', async (_, error) => {
    const fn = vi.fn().mockRejectedValue(error);

    const promise = retryWithBackoff(fn).catch((e) => e);
    await vi.runAllTimersAsync();

    expect(await promise).toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a 500', new WaveCxError({type: 'SERVER_ERROR', message: 'server error', httpCode: 500})],
    ['a 408', new WaveCxError({type: 'SERVER_ERROR', message: 'timeout', httpCode: 408})],
    ['a 429', new WaveCxError({type: 'SERVER_ERROR', message: 'rate limited', httpCode: 429})],
    ['a network error', new WaveCxError({type: 'NETWORK_ERROR', message: 'failed'})],
    ['a network outage', new WaveCxError({type: 'NETWORK_UNAVAILABLE', message: 'offline'})],
  ])('retries %s', async (_, error) => {
    const fn = vi.fn().mockRejectedValue(error);

    const promise = retryWithBackoff(fn).catch((e) => e);
    await vi.runAllTimersAsync();

    expect(await promise).toBe(error);
    expect(fn).toHaveBeenCalledTimes(defaultRetryConfig.maxAttempts);
  });

  it('handles default retry config values correctly', () => {
    expect(defaultRetryConfig.maxAttempts).toBe(3);
    expect(defaultRetryConfig.initialDelay).toBe(1000);
    expect(defaultRetryConfig.maxDelay).toBe(32000);
    expect(defaultRetryConfig.multiplier).toBe(2.0);
  });
});
