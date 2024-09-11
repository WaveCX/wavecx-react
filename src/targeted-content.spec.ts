import {describe, expect, it} from 'vitest';
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';

import {composeFireTargetedContentEventViaApi, TargetedContent} from './targeted-content';

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
});
