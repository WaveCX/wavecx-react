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

export function clientAgent() {
  return `wavecx-react/${SDK_VERSION}`;
}

export const composeFireTargetedContentEventViaApi =
  (dependencies: { apiBaseUrl: string; retryFn?: typeof import('./retry').retryWithBackoff }): FireTargetedContentEvent =>
  async (options): Promise<{ content: TargetedContent[] }> => {
    const makeRequest = async () => {
      const response = await fetch(
        `${dependencies.apiBaseUrl}/${options.organizationCode}/targeted-content-events`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Agent': clientAgent(),
          },
          body: JSON.stringify({
            type: options.type,
            sessionToken: options.sessionToken,
            userId: options.userId,
            userIdVerification: options.userIdVerification,
            triggerPoint: options.triggerPoint,
            platform: 'desktop',
            userData: {
              attributes: options.userAttributes,
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      return response.json();
    };

    if (dependencies.retryFn) {
      return dependencies.retryFn(makeRequest);
    } else {
      // Fallback without retry
      try {
        return await makeRequest();
      } catch {
        return { content: [] };
      }
    }
  };

export const fireTargetedContentEventViaApi = composeFireTargetedContentEventViaApi({ apiBaseUrl: 'https://api.wavecx.com' });
