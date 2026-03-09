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
});
