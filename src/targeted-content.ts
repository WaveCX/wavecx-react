import {WaveCxError} from './errors';
import {retryWithBackoff} from './retry';

export type TargetedContent = {
  triggerPoint: string;
  type: 'featurette';
  presentationType: 'popup' | 'button-triggered';
  viewUrl: string;
  webModal?: {
    opacity: number;
    backdropFilterCss?: string;
    shadowCss?: string;
    borderCss?: string;
    borderRadiusCss: string;
    heightCss: string;
    widthCss: string;
    marginCss?: string;
    closeButton: {style: 'x'} | {style: 'text'; label: string};
  };
  loading?: {
    color: string;
    size: string;
    message?: string;
  };
};

export type FireTargetedContentEvent = (options: {
  type: 'session-started' | 'session-refresh' | 'trigger-point';
  sessionToken?: string;
  triggerPoint?: string;
  organizationCode: string;
  userId: string;
  userIdVerification?: string;
  userAttributes?: object;
}) => Promise<{ sessionToken?: string; expiresIn?: number; content: TargetedContent[] }>;

const SDK_VERSION = __SDK_VERSION__;

/** Per attempt, so a stalled request is retried rather than waited on */
const DEFAULT_TIMEOUT_MS = 10_000;

export function clientAgent() {
  return `wavecx-react/${SDK_VERSION}`;
}

export const composeFireTargetedContentEventViaApi =
  (dependencies: {
    apiBaseUrl: string;
    retryFn?: typeof retryWithBackoff;
    /** Per-attempt limit on the request and reading its response, in milliseconds */
    timeoutMs?: number;
  }): FireTargetedContentEvent =>
  async (options): Promise<{ content: TargetedContent[] }> => {
    const makeRequest = async () => {
      const url = `${dependencies.apiBaseUrl}/${options.organizationCode}/targeted-content-events`;
      let body: string;
      try {
        body = JSON.stringify({
          type: options.type,
          sessionToken: options.sessionToken,
          userId: options.userId,
          userIdVerification: options.userIdVerification,
          triggerPoint: options.triggerPoint,
          platform: 'desktop',
          userData: {
            attributes: options.userAttributes,
          },
        });
      } catch (error) {
        // A local failure (e.g. unserializable attributes) would fail the same way on retry,
        // and UNKNOWN isn't retried
        throw new WaveCxError({
          type: 'UNKNOWN',
          message: 'Failed to build request body',
          cause: error,
        });
      }
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, dependencies.timeoutMs ?? DEFAULT_TIMEOUT_MS);
      const init: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Agent': clientAgent(),
        },
        body,
        signal: controller.signal,
      };

      const networkError = (error: unknown, failedTo: string) => {
        if (timedOut) {
          return new WaveCxError({type: 'NETWORK_TIMEOUT', message: 'Request timed out', cause: error});
        }
        const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
        return new WaveCxError({
          type: offline ? 'NETWORK_UNAVAILABLE' : 'NETWORK_ERROR',
          message: offline ? 'No network connectivity available' : `Failed to ${failedTo}`,
          cause: error,
        });
      };

      try {
        let response: Response;
        try {
          response = await fetch(url, init);
        } catch (error) {
          throw networkError(error, 'send request');
        }

        if (!response.ok) {
          throw new WaveCxError({
            type: 'SERVER_ERROR',
            message: `API request failed with status ${response.status}`,
            httpCode: response.status,
          });
        }

        // The body is still downloading after fetch resolves, so a failure reading it is a
        // network failure rather than a parse failure
        let text: string;
        try {
          text = await response.text();
        } catch (error) {
          throw networkError(error, 'read response');
        }

        try {
          return JSON.parse(text);
        } catch (error) {
          throw new WaveCxError({
            type: 'PARSE_ERROR',
            message: 'Failed to parse API response',
            cause: error,
          });
        }
      } finally {
        clearTimeout(timeout);
      }
    };

    const retryFn = dependencies.retryFn ?? retryWithBackoff;
    return retryFn(makeRequest);
  };

export const fireTargetedContentEventViaApi = composeFireTargetedContentEventViaApi({
  apiBaseUrl: 'https://api.wavecx.com',
});
