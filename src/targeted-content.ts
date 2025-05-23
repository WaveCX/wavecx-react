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
}) => Promise<{ sessionToken?: string; content: TargetedContent[] }>;

export const composeFireTargetedContentEventViaApi =
  (dependencies: { apiBaseUrl: string }): FireTargetedContentEvent =>
  async (options): Promise<{ content: TargetedContent[] }> => {
    const response = await fetch(
      `${dependencies.apiBaseUrl}/${options.organizationCode}/targeted-content-events`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    return response.json();
  };

export const fireTargetedContentEventViaApi = composeFireTargetedContentEventViaApi({ apiBaseUrl: 'https://api.wavecx.com' });
