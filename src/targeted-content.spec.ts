// Node environment: under jsdom, AbortSignal comes from jsdom and Node's fetch rejects it
// @vitest-environment node
import {afterEach, describe, expect, it, vi} from 'vitest';
import {delay, http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';

import {composeFireTargetedContentEventViaApi, TargetedContent} from './targeted-content';
import {WaveCxError} from './errors';
import {retryWithBackoff} from './retry';

describe('Fire Targeted Content', () => {
  it('sends a POST request to the API with the event details', async () => {
    let passedOrgCode = '';
    let passedEventType = '';
    let passedTriggerPoint = '';
    let passedUserId = '';
    let passedUserIdVerification = '';
    const apiServer = setupServer(
      http.post(`https://api.mock.com/:orgCode/targeted-content-events`, async (r) => {
        passedOrgCode = r.params.orgCode as string;
        const requestBody = await r.request.json();
        passedEventType = (requestBody as any).type;
        passedTriggerPoint = (requestBody as any).triggerPoint;
        passedUserId = (requestBody as any).userId;
        passedUserIdVerification = (requestBody as any).userIdVerification;
        return HttpResponse.json({content: []});
      }),
    );
    apiServer.listen();

    const fn = composeFireTargetedContentEventViaApi({
      apiBaseUrl: 'https://api.mock.com',
    });
    await fn({
      organizationCode: 'org',
      userId: 'test-id',
      userIdVerification: 'test-verification',
      type: 'trigger-point',
      triggerPoint: 'test-trigger',
    });

    expect(passedOrgCode).toEqual('org');
    expect(passedEventType).toEqual('trigger-point');
    expect(passedTriggerPoint).toEqual('test-trigger');
    expect(passedUserId).toEqual('test-id');
    expect(passedUserIdVerification).toEqual('test-verification');

    apiServer.close();
  });

  it('returns the content received from the API', async () => {
    const content: TargetedContent[] = [
      {
        type: 'featurette',
        triggerPoint: 'test-trigger',
        presentationType: 'popup',
        viewUrl: 'https://frontend.mock.com/targeted-content/1234',
      },
      {
        type: 'featurette',
        triggerPoint: 'test-trigger',
        presentationType: 'button-triggered',
        viewUrl: 'https://frontend.mock.com/targeted-content/2345',
      },
    ];

    const apiServer = setupServer(
      http.post(`https://api.mock.com/org/targeted-content-events`, () => {
        return HttpResponse.json({content});
      }),
    );
    apiServer.listen();

    try {
      const fn = composeFireTargetedContentEventViaApi({
        apiBaseUrl: 'https://api.mock.com',
      });

      const result = await fn({
        organizationCode: 'org',
        userId: '',
        type: 'trigger-point',
        triggerPoint: 'test-trigger',
      });

      expect(result).toEqual({content});
    } finally {
      apiServer.close();
    }
  });

  describe('errors', () => {
    const sendEvent = () => composeFireTargetedContentEventViaApi({
      apiBaseUrl: 'https://api.mock.com',
      retryFn: (fn) => fn(),
    })({organizationCode: 'org', userId: 'user', type: 'session-started'});

    const withApi = async (response: () => Response, test: () => Promise<void>) => {
      const apiServer = setupServer(
        http.post('https://api.mock.com/org/targeted-content-events', response),
      );
      apiServer.listen();
      try {
        await test();
      } finally {
        apiServer.close();
      }
    };

    afterEach(() => {
      vi.unstubAllGlobals();
      vi.restoreAllMocks();
    });

    it.each([400, 401, 404, 500, 503])('reports a %i response as SERVER_ERROR with its status', async (status) => {
      await withApi(() => new HttpResponse(null, {status}), async () => {
        const error = await sendEvent().catch((e) => e);
        expect(error).toBeInstanceOf(WaveCxError);
        expect(error).toMatchObject({
          type: 'SERVER_ERROR',
          httpCode: status,
          message: `API request failed with status ${status}`,
        });
      });
    });

    it('reports an unparseable response as PARSE_ERROR', async () => {
      await withApi(() => new HttpResponse('<html>not json</html>', {status: 200}), async () => {
        const error = await sendEvent().catch((e) => e);
        expect(error).toBeInstanceOf(WaveCxError);
        expect(error.type).toBe('PARSE_ERROR');
        expect(error.cause).toBeDefined();
      });
    });

    it('reports a failed request as NETWORK_ERROR', async () => {
      const original = new TypeError('Failed to fetch');
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(original);

      const error = await sendEvent().catch((e) => e);

      expect(error).toBeInstanceOf(WaveCxError);
      expect(error).toMatchObject({type: 'NETWORK_ERROR', cause: original});
      expect(error.httpCode).toBeUndefined();
    });

    it('reports unserializable attributes as UNKNOWN without retrying', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      let attempts = 0;

      const error = await composeFireTargetedContentEventViaApi({
        apiBaseUrl: 'https://api.mock.com',
        retryFn: (fn) => retryWithBackoff(() => { attempts++; return fn(); }),
      })({organizationCode: 'org', type: 'session-started', userAttributes: {big: BigInt(1)}})
        .catch((e) => e);

      expect(error).toBeInstanceOf(WaveCxError);
      expect(error).toMatchObject({type: 'UNKNOWN'});
      expect(error.cause).toBeInstanceOf(TypeError);
      expect(attempts).toBe(1);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    const sendEventWithTimeout = (timeoutMs: number) => composeFireTargetedContentEventViaApi({
      apiBaseUrl: 'https://api.mock.com',
      retryFn: (fn) => fn(),
      timeoutMs,
    })({organizationCode: 'org', userId: 'user', type: 'session-started'});

    // Rejects when the request's signal aborts, as fetch and its body stream do
    const untilAborted = (init?: RequestInit) => new Promise<never>((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    });

    it('reports a request with no response before the timeout as NETWORK_TIMEOUT', async () => {
      await withApi(async () => {
        await delay('infinite');
        return HttpResponse.json({content: []});
      }, async () => {
        const error = await sendEventWithTimeout(50).catch((e) => e);
        expect(error).toBeInstanceOf(WaveCxError);
        expect(error).toMatchObject({type: 'NETWORK_TIMEOUT'});
      });
    });

    it('reports a response body that stops arriving as NETWORK_TIMEOUT', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_, init) => ({
        ok: true,
        status: 200,
        text: () => untilAborted(init),
      } as unknown as Response));

      const error = await sendEventWithTimeout(50).catch((e) => e);

      expect(error).toBeInstanceOf(WaveCxError);
      expect(error).toMatchObject({type: 'NETWORK_TIMEOUT'});
    });

    it('retries a timed out request', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch')
        .mockImplementationOnce((_, init) => untilAborted(init))
        .mockResolvedValueOnce(new Response(JSON.stringify({content: []})));

      const result = await composeFireTargetedContentEventViaApi({
        apiBaseUrl: 'https://api.mock.com',
        retryFn: (fn) => retryWithBackoff(fn, {maxAttempts: 2, initialDelay: 1, maxDelay: 1, multiplier: 1}),
        timeoutMs: 50,
      })({organizationCode: 'org', userId: 'user', type: 'session-started'});

      expect(result).toEqual({content: []});
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('reports a failure reading the response body as NETWORK_ERROR', async () => {
      const original = new TypeError('network error');
      vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.reject(original),
      } as unknown as Response);

      const error = await sendEvent().catch((e) => e);

      expect(error).toBeInstanceOf(WaveCxError);
      expect(error).toMatchObject({type: 'NETWORK_ERROR', cause: original});
    });

    it('reports a failed request while offline as NETWORK_UNAVAILABLE', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
      vi.stubGlobal('navigator', {onLine: false});

      const error = await sendEvent().catch((e) => e);

      expect(error).toMatchObject({type: 'NETWORK_UNAVAILABLE'});
    });

    describe('without a retryFn', () => {
      const sendEventWithDefaultRetry = () => composeFireTargetedContentEventViaApi({
        apiBaseUrl: 'https://api.mock.com',
      })({organizationCode: 'org', userId: 'user', type: 'session-started'});

      it('reports failures rather than returning empty content', async () => {
        await withApi(() => new HttpResponse(null, {status: 400}), async () => {
          const error = await sendEventWithDefaultRetry().catch((e) => e);
          expect(error).toBeInstanceOf(WaveCxError);
          expect(error).toMatchObject({type: 'SERVER_ERROR', httpCode: 400});
        });
      });

      it('retries with the default backoff', async () => {
        vi.useFakeTimers();
        try {
          const fetchSpy = vi.spyOn(globalThis, 'fetch')
            .mockResolvedValueOnce(new Response(null, {status: 503}))
            .mockResolvedValueOnce(new Response(JSON.stringify({content: []})));

          const result = sendEventWithDefaultRetry();
          await vi.runAllTimersAsync();

          expect(await result).toEqual({content: []});
          expect(fetchSpy).toHaveBeenCalledTimes(2);
        } finally {
          vi.useRealTimers();
        }
      });
    });
  });
});
