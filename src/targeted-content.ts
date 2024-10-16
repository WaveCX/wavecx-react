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
};

export type FireTargetedContentEvent = (options: {
  type: 'session-started' | 'trigger-point';
  triggerPoint?: string;
  organizationCode: string;
  userId: string;
  userIdVerification?: string;
  userAttributes?: object;
}) => Promise<{ content: TargetedContent[] }>;

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
