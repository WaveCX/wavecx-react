export type TargetedContent = {
  triggerPoint: string;
  type: 'featurette';
  presentationType: 'popup' | 'button-triggered';
  viewUrl: string;
};

export type FireTargetedContentEvent = (options: {
  type: 'session-started' | 'trigger-point';
  triggerPoint?: string;
  organizationCode: string;
  userId: string;
  userIdVerification?: string;
}) => Promise<{ content: TargetedContent[] }>;

export const composeFireTargetedContentEventViaApi =
  (dependencies: { apiBaseUrl: string }): FireTargetedContentEvent =>
  async (options) => {
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
          platform: 'mobile',
        }),
      }
    );
    const result = await response.json();
    return result;
  };

export const fireTargetedContentEventViaApi =
  composeFireTargetedContentEventViaApi({
    apiBaseUrl: 'https://api.wavecx.com',
  });
