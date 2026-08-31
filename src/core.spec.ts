import {describe, it, expect, beforeAll, beforeEach, vi} from 'vitest';
import {
  createHandleEvent,
  resetCoreState,
  getContentCache,
  getIsContentLoading,
  getActiveTriggerPoint,
  hasContent,
  hasPopupContentForTriggerPoint,
  subscribe,
} from './core';
import {clearSessionToken} from './sessions';

const setupMockHtmlDialogElement = () => {
  HTMLDialogElement.prototype.show = function mock(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.showModal = function mock(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function mock(this: HTMLDialogElement) {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
};

const mockContent = (overrides: Partial<{ triggerPoint: string; presentationType: string; viewUrl: string }> = {}) => ({
  type: 'featurette' as const,
  triggerPoint: overrides.triggerPoint ?? 'tp',
  presentationType: (overrides.presentationType ?? 'popup') as 'popup' | 'button-triggered',
  viewUrl: overrides.viewUrl ?? 'https://mock.content.com/embed',
});

describe('core', () => {
  beforeAll(() => {
    setupMockHtmlDialogElement();
  });

  beforeEach(() => {
    resetCoreState();
    clearSessionToken();
  });

  describe('session lifecycle', () => {
    it('populates content cache on session start', async () => {
      const content = [mockContent()];
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({content}),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});

      expect(getContentCache()).toEqual(content);
      expect(getIsContentLoading()).toBe(false);
    });

    it('clears content cache on session end', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({content: [mockContent()]}),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});
      expect(getContentCache()).toHaveLength(1);

      await handleEvent({type: 'session-ended'});
      expect(getContentCache()).toHaveLength(0);
    });

    it('sets isContentLoading during session start', async () => {
      let resolveApi!: (value: any) => void;
      const apiPromise = new Promise(r => { resolveApi = r; });

      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => {
          await apiPromise;
          return {content: []};
        },
      });

      const promise = handleEvent({type: 'session-started', userId: 'user-1'});
      expect(getIsContentLoading()).toBe(true);

      resolveApi(undefined);
      await promise;
      expect(getIsContentLoading()).toBe(false);
    });

    it('uses custom initiateSession to get token, then fetches content via session-refresh', async () => {
      const calls: string[] = [];

      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        initiateSession: async (opts) => {
          calls.push(`initiateSession:${opts.userId}`);
          return {sessionToken: 'custom-token', expiresIn: 3600};
        },
        recordEvent: async (event) => {
          calls.push(`recordEvent:${event.type}:${('sessionToken' in event) ? event.sessionToken : 'none'}`);
          return {
            content: [mockContent({triggerPoint: 'tp-1'})],
          };
        },
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});

      expect(calls).toEqual([
        'initiateSession:user-1',
        'recordEvent:session-refresh:custom-token',
      ]);
      expect(getContentCache()).toHaveLength(1);
    });

    it('skips initiateSession when session token already exists', async () => {
      // Pre-store a session token
      const {storeSessionToken} = await import('./sessions');
      storeSessionToken('existing-token', 3600);

      const calls: string[] = [];

      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        initiateSession: async () => {
          calls.push('initiateSession');
          return {sessionToken: 'new-token'};
        },
        recordEvent: async (event) => {
          calls.push(`recordEvent:${event.type}`);
          return {content: []};
        },
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});

      // Should have used session-refresh with existing token, NOT called initiateSession
      expect(calls).toEqual(['recordEvent:session-refresh']);
    });

    it('ignores duplicate session-started while loading', async () => {
      let callCount = 0;
      let resolveApi!: (value: any) => void;
      const apiPromise = new Promise(r => { resolveApi = r; });

      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => {
          callCount++;
          await apiPromise;
          return {content: []};
        },
      });

      const promise = handleEvent({type: 'session-started', userId: 'user-1'});
      await handleEvent({type: 'session-started', userId: 'user-1'});

      resolveApi(undefined);
      await promise;
      expect(callCount).toBe(1);
    });
  });

  describe('content queries', () => {
    it('hasContent returns true for matching content', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: [
            mockContent({triggerPoint: 'tp-1', presentationType: 'popup'}),
            mockContent({triggerPoint: 'tp-2', presentationType: 'button-triggered'}),
          ],
        }),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});

      expect(hasContent('tp-1')).toBe(true);
      expect(hasContent('tp-1', 'popup')).toBe(true);
      expect(hasContent('tp-1', 'button-triggered')).toBe(false);
      expect(hasContent('tp-2', 'button-triggered')).toBe(true);
      expect(hasContent('nonexistent')).toBe(false);
    });

    it('hasPopupContentForTriggerPoint delegates to hasContent', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: [mockContent({triggerPoint: 'tp-1', presentationType: 'popup'})],
        }),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});

      expect(hasPopupContentForTriggerPoint('tp-1')).toBe(true);
      expect(hasPopupContentForTriggerPoint('tp-2')).toBe(false);
    });
  });

  describe('user-triggered content', () => {
    it('falls back to active trigger point when no triggerPoint provided', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: [mockContent({triggerPoint: 'tp-1', presentationType: 'button-triggered'})],
        }),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});

      // Fire user-triggered-content WITHOUT a triggerPoint (v1.7.4 compat)
      await handleEvent({type: 'user-triggered-content'});

      const dialog = document.querySelector('dialog');
      expect(dialog).not.toBeNull();
      expect(dialog!.open).toBe(true);
    });
  });

  describe('trigger points', () => {
    it('consumes popup content after trigger point fires', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: [mockContent({triggerPoint: 'tp-1', presentationType: 'popup'})],
        }),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});
      expect(hasContent('tp-1', 'popup')).toBe(true);

      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});
      expect(hasContent('tp-1', 'popup')).toBe(false);
    });

    it('does not consume button-triggered content after trigger point fires', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: [mockContent({triggerPoint: 'tp-1', presentationType: 'button-triggered'})],
        }),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});
      expect(hasContent('tp-1', 'button-triggered')).toBe(true);
    });

    it('tracks active trigger point', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({content: []}),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});

      expect(getActiveTriggerPoint()).toBeUndefined();

      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});
      expect(getActiveTriggerPoint()).toBe('tp-1');

      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-2'});
      expect(getActiveTriggerPoint()).toBe('tp-2');
    });

    it('does not dismiss modal when same trigger point fires again (strict mode safety)', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: [mockContent({triggerPoint: 'tp-1', presentationType: 'popup'})],
        }),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});

      const dialog = document.querySelector('dialog');
      expect(dialog).not.toBeNull();
      expect(dialog!.open).toBe(true);

      // Fire same trigger point again (simulates strict mode double-invoke)
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});

      // Dialog should still be there (not dismissed)
      const dialogAfter = document.querySelector('dialog');
      expect(dialogAfter).not.toBeNull();
      expect(dialogAfter!.open).toBe(true);
    });

    it('does not consume popup content when disablePopupContent is true', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        disablePopupContent: true,
        recordEvent: async () => ({
          content: [mockContent({triggerPoint: 'tp-1', presentationType: 'popup'})],
        }),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});
      expect(hasContent('tp-1', 'popup')).toBe(true);
    });
  });

  describe('event queue', () => {
    it('queues trigger-point events during content loading and processes after', async () => {
      let resolveApi!: (value: any) => void;
      const apiPromise = new Promise(r => { resolveApi = r; });

      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => {
          await apiPromise;
          return {
            content: [mockContent({triggerPoint: 'tp-1', presentationType: 'popup'})],
          };
        },
      });

      const sessionPromise = handleEvent({type: 'session-started', userId: 'user-1'});

      // Fire trigger point while loading — should be queued
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});
      expect(getActiveTriggerPoint()).toBeUndefined();

      resolveApi(undefined);
      await sessionPromise;

      // After loading, queued trigger point should have been processed
      expect(getActiveTriggerPoint()).toBe('tp-1');
    });
  });

  describe('subscribe', () => {
    it('notifies listeners on state changes', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);

      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({content: []}),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});

      expect(listener).toHaveBeenCalled();
      unsubscribe();
    });

    it('stops notifying after unsubscribe', async () => {
      const listener = vi.fn();
      const unsubscribe = subscribe(listener);
      unsubscribe();

      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({content: []}),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('URL validation', () => {
    it('rejects content with javascript: URLs', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: [mockContent({triggerPoint: 'tp-1', viewUrl: 'javascript:alert(1)'})],
        }),
      });

      await handleEvent({type: 'session-started', userId: 'user-1'});
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});

      // Modal should not have been rendered
      const dialog = document.querySelector('dialog');
      expect(dialog).toBeNull();
    });
  });

  describe('content messages', () => {
    const contentOrigin = 'https://mock.content.com';
    const viewUrl = `${contentOrigin}/embed`;

    const openButtonTriggeredModal = async (overrides: {content?: any[]} = {}) => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: overrides.content
            ?? [mockContent({triggerPoint: 'tp-1', presentationType: 'button-triggered', viewUrl})],
        }),
      });
      await handleEvent({type: 'session-started', userId: 'user-1'});
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});
      await handleEvent({type: 'user-triggered-content', triggerPoint: 'tp-1'});
      return handleEvent;
    };

    const postFromContent = (data: unknown, options: {origin?: string; source?: any} = {}) => {
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      window.dispatchEvent(new MessageEvent('message', {
        data,
        origin: options.origin ?? contentOrigin,
        source: 'source' in options ? options.source : iframe.contentWindow,
      }));
    };

    const dismissMessage = (extra: object = {}) => ({
      source: 'wavecx',
      type: 'dismiss-content',
      ...extra,
    });

    it('closes the modal when content requests dismissal', async () => {
      await openButtonTriggeredModal();
      expect(document.querySelector('dialog')).not.toBeNull();

      postFromContent(dismissMessage({reason: 'user-closed'}));

      expect(document.querySelector('dialog')).toBeNull();
    });

    it('removes content from the session cache when suppressForSession is set', async () => {
      await openButtonTriggeredModal();
      expect(hasContent('tp-1', 'button-triggered')).toBe(true);

      postFromContent(dismissMessage({reason: 'no-show-again', suppressForSession: true}));

      expect(hasContent('tp-1', 'button-triggered')).toBe(false);
      expect(document.querySelector('dialog')).toBeNull();
    });

    it('keeps content in the session cache when suppressForSession is not set', async () => {
      await openButtonTriggeredModal();

      postFromContent(dismissMessage({reason: 'user-closed'}));

      // A plain close (e.g. a "Got it" button) must not hide the entry point
      expect(hasContent('tp-1', 'button-triggered')).toBe(true);
    });

    it('suppresses only the dismissed content, not siblings at the same trigger point', async () => {
      const siblingUrl = `${contentOrigin}/embed-2`;
      await openButtonTriggeredModal({
        content: [
          mockContent({triggerPoint: 'tp-1', presentationType: 'button-triggered', viewUrl}),
          mockContent({triggerPoint: 'tp-1', presentationType: 'button-triggered', viewUrl: siblingUrl}),
        ],
      });

      postFromContent(dismissMessage({reason: 'no-show-again', suppressForSession: true}));

      expect(getContentCache().map((c) => c.viewUrl)).toEqual([siblingUrl]);
    });

    it('notifies subscribers so hosts re-render entry points', async () => {
      await openButtonTriggeredModal();
      const listener = vi.fn();
      subscribe(listener);

      postFromContent(dismissMessage({reason: 'no-show-again', suppressForSession: true}));

      expect(listener).toHaveBeenCalled();
    });

    it('invokes the dismiss callback registered by the host', async () => {
      const handleEvent = createHandleEvent({
        organizationCode: 'org',
        recordEvent: async () => ({
          content: [mockContent({triggerPoint: 'tp-1', presentationType: 'button-triggered', viewUrl})],
        }),
      });
      await handleEvent({type: 'session-started', userId: 'user-1'});
      await handleEvent({type: 'trigger-point', triggerPoint: 'tp-1'});

      const onContentDismissed = vi.fn();
      await handleEvent({type: 'user-triggered-content', triggerPoint: 'tp-1', onContentDismissed});

      postFromContent(dismissMessage({reason: 'no-show-again', suppressForSession: true}));

      expect(onContentDismissed).toHaveBeenCalled();
    });

    it('ignores messages from an unexpected origin', async () => {
      await openButtonTriggeredModal();

      postFromContent(
        dismissMessage({reason: 'no-show-again', suppressForSession: true}),
        {origin: 'https://evil.example.com'},
      );

      expect(document.querySelector('dialog')).not.toBeNull();
      expect(hasContent('tp-1', 'button-triggered')).toBe(true);
    });

    it('ignores messages from a window other than the content iframe', async () => {
      await openButtonTriggeredModal();

      postFromContent(
        dismissMessage({reason: 'no-show-again', suppressForSession: true}),
        {source: window},
      );

      expect(document.querySelector('dialog')).not.toBeNull();
      expect(hasContent('tp-1', 'button-triggered')).toBe(true);
    });

    it('ignores messages that are not WaveCX dismiss messages', async () => {
      await openButtonTriggeredModal();

      postFromContent({type: 'dismiss-content'});
      postFromContent({source: 'wavecx', type: 'something-else'});
      postFromContent('not-an-object');
      postFromContent(null);

      expect(document.querySelector('dialog')).not.toBeNull();
    });

    it('stops listening once the modal is dismissed', async () => {
      await openButtonTriggeredModal();
      const iframe = document.querySelector('iframe') as HTMLIFrameElement;
      const source = iframe.contentWindow;

      // Close via the dialog itself, then replay a dismiss message from the dead frame
      (document.querySelector('dialog') as HTMLDialogElement).close();
      expect(hasContent('tp-1', 'button-triggered')).toBe(true);

      window.dispatchEvent(new MessageEvent('message', {
        data: dismissMessage({reason: 'no-show-again', suppressForSession: true}),
        origin: contentOrigin,
        source,
      }));

      expect(hasContent('tp-1', 'button-triggered')).toBe(true);
    });
  });
});
