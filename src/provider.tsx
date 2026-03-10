import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import {type FireTargetedContentEvent} from './targeted-content';
import {type InitiateSession} from './sessions';
import {type RetryConfig} from './retry';
import {type MockModeConfig} from './mock-mode';
import {
  type EventHandler,
  type ContentFetchStrategy,
  createHandleEvent,
  subscribe,
  hasContent,
  hasPopupContentForTriggerPoint,
  getContentCache,
  getIsContentLoading,
  getActiveTriggerPoint,
} from './core';

export type {ContentFetchStrategy};
export {type Event, type EventHandler} from './core';

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

export const WaveCxProvider = (props: {
  organizationCode: string;
  children?: ReactNode;
  apiBaseUrl?: string;
  recordEvent?: FireTargetedContentEvent;
  initiateSession?: InitiateSession;
  /**
   * @deprecated This prop no longer has any effect. Modal rendering is handled internally.
   */
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
  const [, forceRender] = useReducer((x: number) => x + 1, 0);

  useLayoutEffect(() => {
    return subscribe(forceRender);
  }, []);

  // Create handleEvent once on mount. It reads shared module-level state
  // so it doesn't need to be recreated when props change.
  const handleEventRef = useRef<EventHandler | null>(null);
  if (!handleEventRef.current) {
    handleEventRef.current = createHandleEvent({
      organizationCode: props.organizationCode,
      apiBaseUrl: props.apiBaseUrl,
      recordEvent: props.recordEvent,
      initiateSession: props.initiateSession,
      disablePopupContent: props.disablePopupContent,
      debugMode: props.debugMode,
      retryConfig: props.retryConfig,
      mockModeConfig: props.mockModeConfig,
    });
  }

  const cache = getContentCache();
  const loading = getIsContentLoading();
  const triggerPoint = getActiveTriggerPoint();
  const hasUserTriggered = triggerPoint !== undefined && cache.some(c =>
    c.triggerPoint === triggerPoint
    && c.presentationType === 'button-triggered'
  );

  const contextValue = useMemo(
    () => ({
      handleEvent: handleEventRef.current!,
      hasPopupContentForTriggerPoint,
      hasContent,
      hasUserTriggeredContent: hasUserTriggered,
      isContentLoading: loading,
    }),
    [hasUserTriggered, cache, loading],
  );

  return (
    <WaveCxContext.Provider value={contextValue}>
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
