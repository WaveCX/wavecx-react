import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';

import {composeFireTargetedContentEventViaApi, type FireTargetedContentEvent, type TargetedContent} from './targeted-content';
import {BusyIndicator} from './busy-indicator';
import {clearSessionToken, InitiateSession, readSessionToken, storeSessionToken} from './sessions';
import {useAutoModalFromCallback} from './use-auto-modal';
import {retryWithBackoff, defaultRetryConfig, type RetryConfig} from './retry';
import {
  type MockModeConfig,
  defaultMockModeConfig,
  getInitialMockContent,
  simulateNetworkDelay,
} from './mock-mode';

export type Event =
  | { type: 'session-started'; userId: string; userIdVerification?: string; userAttributes?: object }
  | { type: 'session-ended' }
  | { type: 'trigger-point'; triggerPoint: string; onContentDismissed?: () => void }
  | { type: 'user-triggered-content'; triggerPoint?: string; onContentDismissed?: () => void };

export type EventHandler = (event: Event) => void | Promise<void>;

export interface WaveCxContextInterface {
  handleEvent: EventHandler;
  /**
   * @deprecated Use `hasContent(triggerPoint, 'popup')` instead
   */
  hasPopupContentForTriggerPoint: (triggerPoint: string) => boolean;
  /**
   * Check if content is available for a specific trigger point.
   *
   * @param triggerPoint - The trigger point code to check
   * @param presentationType - Optional presentation type filter ('popup' or 'button-triggered')
   * @returns true if content is available
   *
   * @example
   * // Check for any content type
   * const hasContent = hasContent('account-dashboard');
   *
   * // Check for specific presentation type
   * const hasPopup = hasContent('low-balance-alert', 'popup');
   * const hasButtonContent = hasContent('account-dashboard', 'button-triggered');
   */
  hasContent: (triggerPoint: string, presentationType?: 'popup' | 'button-triggered') => boolean;
  /**
   * Indicates if button-triggered content is available for the LAST FIRED trigger point.
   *
   * @deprecated Use `hasContent(triggerPoint, 'button-triggered')` to check for specific trigger points instead.
   * This flag only reflects the most recently fired trigger point and doesn't tell you which one.
   */
  hasUserTriggeredContent: boolean;
  /**
   * Indicates if the SDK is currently loading content from the API.
   * Useful for showing loading spinners during initial content fetch.
   */
  isContentLoading: boolean;
}

export const WaveCxContext = createContext<WaveCxContextInterface>({
  handleEvent: () => undefined,
  hasPopupContentForTriggerPoint: () => false,
  hasContent: () => false,
  hasUserTriggeredContent: false,
  isContentLoading: false,
});

export type ContentFetchStrategy =
  | 'session-start'
  | 'trigger-point';

const createDebugLogger = (debugMode: boolean) => {
  return (message: string, data?: any) => {
    if (debugMode) {
      if (data !== undefined) {
        console.log(`[WaveCx] ${message}`, data);
      } else {
        console.log(`[WaveCx] ${message}`);
      }
    }
  };
};

const isValidContentUrl = (url: string, mockModeEnabled: boolean): boolean => {
  try {
    const parsed = new URL(url);
    // In mock mode, allow data: URLs for inline content
    if (mockModeEnabled && parsed.protocol === 'data:') {
      return true;
    }
    // Only allow http and https protocols to prevent XSS attacks
    // Blocks: javascript:, file:, blob:, etc.
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    // Invalid URL format
    return false;
  }
};


export const WaveCxProvider = (props: {
  organizationCode: string;
  children?: ReactNode;
  apiBaseUrl?: string;
  recordEvent?: FireTargetedContentEvent;
  initiateSession?: InitiateSession;
  portalParent?: Element;
  disablePopupContent?: boolean;
  /**
   * @deprecated This prop no longer has any effect. Content is always fetched at session start.
   */
  contentFetchStrategy?: ContentFetchStrategy;
  debugMode?: boolean;
  retryConfig?: RetryConfig;
  mockModeConfig?: MockModeConfig;
}) => {
  const debugLog = useMemo(
    () => createDebugLogger(props.debugMode ?? false),
    [props.debugMode]
  );

  const mockModeConfig = props.mockModeConfig ?? defaultMockModeConfig;

  const stateRef = useRef({
    isContentLoading: false,
    eventQueue: [] as Event[],
  });

  // Content cache uses a hybrid state + ref approach to solve the "stale closure" problem:
  // - `contentCache` (state): Used by check functions (hasPopupContentForTriggerPoint, etc.)
  //   so that components re-render when content availability changes
  // - `contentCacheRef` (ref): Used inside `handleEvent` to read current content without
  //   causing `handleEvent` to be recreated on every cache change (which would cause infinite loops)
  // This is a standard React pattern until useEffectEvent becomes stable.
  // See: https://react.dev/learn/separating-events-from-effects#declaring-an-effect-event
  const [contentCache, setContentCache] = useState<TargetedContent[]>([]);
  const contentCacheRef = useRef<TargetedContent[]>(contentCache);

  // Keep ref in sync with state
  useEffect(() => {
    contentCacheRef.current = contentCache;
  }, [contentCache]);

  // Helper to update both state and ref synchronously
  const updateContentCache = useCallback((newContent: TargetedContent[] | ((prev: TargetedContent[]) => TargetedContent[])) => {
    if (typeof newContent === 'function') {
      setContentCache(prev => {
        const updated = newContent(prev);
        contentCacheRef.current = updated;
        return updated;
      });
    } else {
      contentCacheRef.current = newContent;
      setContentCache(newContent);
    }
  }, []);

  const retryConfig = props.retryConfig ?? defaultRetryConfig;

  const recordEvent = useMemo(() => {
    if (props.recordEvent) {
      return props.recordEvent;
    }

    const retryFn = (fn: () => Promise<any>) =>
      retryWithBackoff(fn, retryConfig, debugLog);

    return composeFireTargetedContentEventViaApi({
      apiBaseUrl: props.apiBaseUrl ?? 'https://api.wavecx.com',
      retryFn,
    });
  }, [props.recordEvent, props.apiBaseUrl, retryConfig, debugLog]);

  const onContentDismissedCallback = useRef<
    | (() => void)
    | undefined
  >(undefined);

  const {autoDialogRef, dialogRef} = useAutoModalFromCallback();

  const [activePopupContent, setActivePopupContent] = useState<TargetedContent | undefined>(undefined);
  const [activeUserTriggeredContent, setActiveUserTriggeredContent] = useState<TargetedContent | undefined>(undefined);
  const [isUserTriggeredContentShown, setIsUserTriggeredContentShown] = useState(false);
  const [isRemoteContentReady, setIsRemoteContentReady] = useState(false);
  const [isContentLoading, setIsContentLoading] = useState(false);

  const presentedContent =
    activePopupContent ?? (isUserTriggeredContentShown
      ? activeUserTriggeredContent
      : undefined);

  const checkPopupContent = useCallback(
    (triggerPoint: string) => {
      return contentCache.some((c) =>
        c.triggerPoint === triggerPoint
        && c.presentationType === 'popup'
      );
    },
    [contentCache],
  );

  const checkContent = useCallback(
    (triggerPoint: string, presentationType?: 'popup' | 'button-triggered') => {
      return contentCache.some((c) =>
        c.triggerPoint === triggerPoint
        && (presentationType === undefined || c.presentationType === presentationType)
      );
    },
    [contentCache],
  );

  const handleEvent = useCallback<EventHandler>(
    async (event) => {
      debugLog('handleEvent called', { eventType: event.type });

      // Helper to update loading state
      const updateLoadingState = (loading: boolean) => {
        stateRef.current.isContentLoading = loading;
        setIsContentLoading(loading);
      };

      // Helper to process queued events sequentially
      const processQueuedEvents = async () => {
        if (stateRef.current.eventQueue.length === 0) return;

        const queue = [...stateRef.current.eventQueue];
        stateRef.current.eventQueue = [];

        debugLog('Processing queued events', { queueLength: queue.length });

        for (const queuedEvent of queue) {
          try {
            await handleEvent(queuedEvent);
          } catch (error) {
            debugLog('Error processing queued event', { event: queuedEvent, error });
          }
        }
      };

      if (event.type === 'session-started') {
        onContentDismissedCallback.current = undefined;
        debugLog('Starting session', { userId: event.userId });
        updateContentCache([]);

        // Mock mode: skip API calls and use mock content
        if (mockModeConfig.enabled) {
          debugLog('Mock mode enabled - using mock content instead of API call');
          updateLoadingState(true);

          // Simulate network delay if configured
          await simulateNetworkDelay(mockModeConfig);

          // Get initial mock content
          const mockContent = getInitialMockContent(mockModeConfig);
          updateContentCache(mockContent);
          debugLog('Mock content loaded', { mockContent });

          updateLoadingState(false);
          await processQueuedEvents();
          return;
        }

        const sessionToken = readSessionToken();
        if (sessionToken) {
          debugLog('Existing session token found, refreshing session');
          try {
            updateLoadingState(true);
            const targetedContentResult = await recordEvent({
              organizationCode: props.organizationCode,
              type: 'session-refresh',
              sessionToken: sessionToken,
              userId: event.userId,
            });
            updateContentCache(targetedContentResult.content);
            debugLog('Session refreshed successfully', { content: targetedContentResult.content });
          } catch (error) {
            debugLog('Session refresh failed', { error });
          }
          updateLoadingState(false);
          await processQueuedEvents();
          return;
        }

        if (props.initiateSession) {
          debugLog('Using custom initiateSession function');
          try {
            updateLoadingState(true);
            const sessionResult = await props.initiateSession({
              organizationCode: props.organizationCode,
              userId: event.userId,
              userIdVerification: event.userIdVerification,
              userAttributes: event.userAttributes,
            });
            storeSessionToken(sessionResult.sessionToken, sessionResult.expiresIn ?? 3600);
            debugLog('Session initiated, fetching content');
            const targetedContentResult = await recordEvent({
              organizationCode: props.organizationCode,
              type: 'session-refresh',
              sessionToken: sessionResult.sessionToken,
              userId: event.userId,
            });
            updateContentCache(targetedContentResult.content);
            debugLog('Content fetched successfully', { content: targetedContentResult.content });
          } catch (error) {
            debugLog('Session initiation failed', { error });
          }
          updateLoadingState(false);
          await processQueuedEvents();
        } else {
          debugLog('Starting new session via API');
          updateLoadingState(true);
          try {
            const targetedContentResult = await recordEvent({
              type: 'session-started',
              organizationCode: props.organizationCode,
              userId: event.userId,
              userIdVerification: event.userIdVerification,
              userAttributes: event.userAttributes,
            });
            if (targetedContentResult.sessionToken) {
              storeSessionToken(targetedContentResult.sessionToken, targetedContentResult.expiresIn ?? 3600);
              debugLog('Session token stored');
            }
            updateContentCache(targetedContentResult.content);
            debugLog('Session started successfully', { content: targetedContentResult.content });
          } catch (error) {
            debugLog('Session start failed', { error });
          }
          updateLoadingState(false);
          await processQueuedEvents();
        }
      } else if (event.type === 'session-ended') {
        onContentDismissedCallback.current = undefined;
        debugLog('Ending session');
        updateContentCache([]);
        setActivePopupContent(undefined);
        setActiveUserTriggeredContent(undefined);
        clearSessionToken();
        debugLog('Session ended successfully');
      } else if (event.type === 'user-triggered-content') {
        debugLog('Showing user-triggered content', { triggerPoint: event.triggerPoint });

        // If a specific trigger point is provided, load that content
        if (event.triggerPoint) {
          const userTriggeredContent = contentCacheRef.current.filter((c) =>
            c.triggerPoint === event.triggerPoint
            && c.presentationType === 'button-triggered'
          )[0];

          if (userTriggeredContent) {
            if (isValidContentUrl(userTriggeredContent.viewUrl, mockModeConfig.enabled)) {
              debugLog('User-triggered content found for specific trigger point', { triggerPoint: event.triggerPoint });
              setActiveUserTriggeredContent(userTriggeredContent);
            } else {
              debugLog('User-triggered content rejected - invalid URL', { triggerPoint: event.triggerPoint, viewUrl: userTriggeredContent.viewUrl });
            }
          } else {
            debugLog('No user-triggered content found for specific trigger point', { triggerPoint: event.triggerPoint });
          }
        }

        setIsUserTriggeredContentShown(true);
        onContentDismissedCallback.current = event.onContentDismissed;
      } else if (event.type === 'trigger-point') {
        debugLog('Trigger point fired', { triggerPoint: event.triggerPoint });
        setActivePopupContent(undefined);
        setActiveUserTriggeredContent(undefined);
        onContentDismissedCallback.current = event.onContentDismissed;

        if (stateRef.current.isContentLoading) {
          debugLog('Content is loading, queueing trigger point event');
          stateRef.current.eventQueue.push(event);
          return;
        }

        if (!props.disablePopupContent) {
          const popupContent = contentCacheRef.current.filter((c) =>
            c.triggerPoint === event.triggerPoint
            && c.presentationType === 'popup'
          )[0];

          if (popupContent) {
            if (isValidContentUrl(popupContent.viewUrl, mockModeConfig.enabled)) {
              debugLog('Popup content found for trigger point', { triggerPoint: event.triggerPoint });
              setActivePopupContent(popupContent);
            } else {
              debugLog('Popup content rejected - invalid URL', { triggerPoint: event.triggerPoint, viewUrl: popupContent.viewUrl });
            }
          } else {
            debugLog('No popup content found for trigger point', { triggerPoint: event.triggerPoint });
          }

          updateContentCache(prev => prev.filter((c) =>
            c.triggerPoint !== event.triggerPoint
            || c.presentationType !== 'popup'
          ));
        }

        const userTriggeredContent = contentCacheRef.current.filter((c) =>
          c.triggerPoint === event.triggerPoint
          && c.presentationType === 'button-triggered'
        )[0];

        if (userTriggeredContent) {
          if (isValidContentUrl(userTriggeredContent.viewUrl, mockModeConfig.enabled)) {
            debugLog('User-triggered content found for trigger point', { triggerPoint: event.triggerPoint });
            setActiveUserTriggeredContent(userTriggeredContent);
          } else {
            debugLog('User-triggered content rejected - invalid URL', { triggerPoint: event.triggerPoint, viewUrl: userTriggeredContent.viewUrl });
          }
        } else {
          debugLog('No user-triggered content found for trigger point', { triggerPoint: event.triggerPoint });
        }
      }
    },
    [props.organizationCode, recordEvent, debugLog, mockModeConfig, props.disablePopupContent, updateContentCache, props.initiateSession],
  );

  const dismissContent = useCallback(() => {
    debugLog('Content dismissed');
    const callback = onContentDismissedCallback.current;
    setIsUserTriggeredContentShown(false);
    setActivePopupContent(undefined);
    setIsRemoteContentReady(false);
    // Call callback after state updates to ensure it's invoked even if component unmounts
    callback?.();
  }, [debugLog]);

  useEffect(() => {
    debugLog('WaveCxProvider initialized', {
      organizationCode: props.organizationCode,
      apiBaseUrl: props.apiBaseUrl ?? 'https://api.wavecx.com',
      debugMode: props.debugMode ?? false,
      disablePopupContent: props.disablePopupContent ?? false,
      contentFetchStrategy: 'session-start', // Always fetch at session start (trigger-point strategy deprecated)
      mockMode: mockModeConfig.enabled,
    });
  }, []);

  // Reset content load state when content changes
  useEffect(() => {
    setIsRemoteContentReady(false);
  }, [presentedContent?.viewUrl]);

  const contextValue = useMemo(
    () => ({
      handleEvent,
      hasUserTriggeredContent: activeUserTriggeredContent !== undefined,
      hasPopupContentForTriggerPoint: checkPopupContent,
      hasContent: checkContent,
      isContentLoading,
    }),
    [handleEvent, activeUserTriggeredContent, checkPopupContent, checkContent, isContentLoading]
  );

  return (
    <WaveCxContext.Provider value={contextValue}>
      {createPortal(
        <>
          {presentedContent && (
            <dialog
              ref={autoDialogRef}
              className={'__wcx_modal'}
              onClose={dismissContent}
              style={{
                '--backdrop-filter': presentedContent.webModal?.backdropFilterCss,
              } as CSSProperties}
            >
              <div
                className={'__wcx_modalContent'}
                style={{
                  opacity: presentedContent.webModal?.opacity,
                  boxShadow: presentedContent?.webModal?.shadowCss,
                  border: presentedContent?.webModal?.borderCss,
                  borderRadius: presentedContent?.webModal?.borderRadiusCss,
                  height: presentedContent.webModal?.heightCss,
                  width: presentedContent.webModal?.widthCss,
                  margin: presentedContent.webModal?.marginCss,
                } as CSSProperties}
              >
                <form
                  method={'dialog'}
                  onSubmit={(e) => {
                    e.preventDefault();
                    dialogRef.current?.close();
                  }}
                >
                  <button
                    className={[
                      '__wcx_modalCloseButton',
                      presentedContent.webModal?.closeButton.style === 'text' ? '__wcx_textButton' : ''
                    ].join(' ')}
                    title={'Close'}
                  >
                    {presentedContent.webModal?.closeButton.style === 'text'
                      ? presentedContent.webModal.closeButton.label
                      : ''
                    }
                  </button>
                </form>

                {!isRemoteContentReady && (
                  <div className={'__wcx_loadingView'}>
                    <BusyIndicator
                      color={presentedContent.loading?.color}
                      size={presentedContent.loading?.size}
                      message={presentedContent.loading?.message ?? 'Loading featured content'}
                    />
                  </div>
                )}

                <iframe
                  title={'Featured Content'}
                  src={presentedContent.viewUrl}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"
                  style={{
                    display: isRemoteContentReady ? undefined : 'none',
                  }}
                  className={'__wcx_webview'}
                  onLoad={() => {
                    debugLog('Content iframe loaded', { viewUrl: presentedContent.viewUrl });
                    setIsRemoteContentReady(true);
                  }}
                />
              </div>
            </dialog>
          )}
        </>,
        props.portalParent ?? document.body,
      )}

      {props.children}
    </WaveCxContext.Provider>
  );
};

export const useWaveCx = () => {
  const context = useContext(WaveCxContext);
  if (!context) {
    throw new Error(
      `${useWaveCx.name} must be used in a WaveCx context provider`
    );
  }
  return context;
};