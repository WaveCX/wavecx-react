import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

export type Event =
  | { type: 'session-started'; userId: string; userIdVerification?: string; userAttributes?: object }
  | { type: 'session-ended' }
  | { type: 'trigger-point'; triggerPoint: string; onContentDismissed?: () => void }
  | { type: 'user-triggered-content'; onContentDismissed?: () => void };

export type EventHandler = (event: Event) => void;

export interface WaveCxContextInterface {
  handleEvent: EventHandler;
  hasPopupContentForTriggerPoint: (triggerPoint: string) => boolean;
  hasUserTriggeredContent: boolean;
}

export const WaveCxContext = createContext<WaveCxContextInterface>({
  handleEvent: () => undefined,
  hasPopupContentForTriggerPoint: () => false,
  hasUserTriggeredContent: false,
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

export const WaveCxProvider = (props: {
  organizationCode: string;
  children?: ReactNode;
  apiBaseUrl?: string;
  recordEvent?: FireTargetedContentEvent;
  initiateSession?: InitiateSession;
  portalParent?: Element;
  disablePopupContent?: boolean;
  contentFetchStrategy?: ContentFetchStrategy;
  debugMode?: boolean;
}) => {
  const debugLog = useCallback(
    createDebugLogger(props.debugMode ?? false),
    [props.debugMode]
  );

  const stateRef = useRef({
    isContentLoading: false,
    eventQueue: [] as Event[],
    contentCache: [] as TargetedContent[],
  });

  const recordEvent = useCallback(
      props.recordEvent ??
      composeFireTargetedContentEventViaApi({
        apiBaseUrl: props.apiBaseUrl ?? 'https://api.wavecx.com',
      }),
    [props.recordEvent, props.apiBaseUrl],
  );

  const onContentDismissedCallback = useRef<
    | (() => void)
    | undefined
  >(undefined);

  const {autoDialogRef, dialogRef} = useAutoModalFromCallback();

  const [activePopupContent, setActivePopupContent] = useState<TargetedContent | undefined>(undefined);
  const [activeUserTriggeredContent, setActiveUserTriggeredContent] = useState<TargetedContent | undefined>(undefined);
  const [isUserTriggeredContentShown, setIsUserTriggeredContentShown] = useState(false);
  const [isRemoteContentReady, setIsRemoteContentReady] = useState(false);

  const presentedContent =
    activePopupContent ?? (isUserTriggeredContentShown
      ? activeUserTriggeredContent
      : undefined);

  const checkPopupContent = useCallback(
    (triggerPoint: string) => {
      return stateRef.current.contentCache.some((c) =>
        c.triggerPoint === triggerPoint
        && c.presentationType === 'popup'
      );
    },
    [],
  );

  const handleEvent = useCallback<EventHandler>(
    async (event) => {
      debugLog('handleEvent called', { eventType: event.type });
      onContentDismissedCallback.current = undefined;

      if (event.type === 'session-started') {
        debugLog('Starting session', { userId: event.userId });
        stateRef.current.contentCache = [];

        const sessionToken = readSessionToken();
        if (sessionToken) {
          debugLog('Existing session token found, refreshing session');
          try {
            stateRef.current.isContentLoading = true;
            const targetedContentResult = await recordEvent({
              organizationCode: props.organizationCode,
              type: 'session-refresh',
              sessionToken: sessionToken,
              userId: event.userId,
            });
            stateRef.current.contentCache = targetedContentResult.content;
            debugLog('Session refreshed successfully', { contentCount: targetedContentResult.content.length });
          } catch (error) {
            debugLog('Session refresh failed', { error });
          }
          stateRef.current.isContentLoading = false;
          if (stateRef.current.eventQueue.length > 0) {
            debugLog('Processing queued events', { queueLength: stateRef.current.eventQueue.length });
            stateRef.current.eventQueue.forEach((e) => handleEvent(e));
            stateRef.current.eventQueue = [];
          }
          return;
        }

        if (props.initiateSession) {
          debugLog('Using custom initiateSession function');
          try {
            stateRef.current.isContentLoading = true;
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
            stateRef.current.contentCache = targetedContentResult.content;
            debugLog('Content fetched successfully', { contentCount: targetedContentResult.content.length });
          } catch (error) {
            debugLog('Session initiation failed', { error });
          }
          stateRef.current.isContentLoading = false;
          if (stateRef.current.eventQueue.length > 0) {
            debugLog('Processing queued events', { queueLength: stateRef.current.eventQueue.length });
            stateRef.current.eventQueue.forEach((e) => handleEvent(e));
            stateRef.current.eventQueue = [];
          }
        } else {
          debugLog('Starting new session via API');
          stateRef.current.isContentLoading = true;
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
            stateRef.current.contentCache = targetedContentResult.content;
            debugLog('Session started successfully', { contentCount: targetedContentResult.content.length });
          } catch (error) {
            debugLog('Session start failed', { error });
          }
          stateRef.current.isContentLoading = false;
          if (stateRef.current.eventQueue.length > 0) {
            debugLog('Processing queued events', { queueLength: stateRef.current.eventQueue.length });
            stateRef.current.eventQueue.forEach((e) => handleEvent(e));
            stateRef.current.eventQueue = [];
          }
        }
      } else if (event.type === 'session-ended') {
        debugLog('Ending session');
        stateRef.current.contentCache = [];
        setActivePopupContent(undefined);
        setActiveUserTriggeredContent(undefined);
        clearSessionToken();
        debugLog('Session ended successfully');
      } else if (event.type === 'user-triggered-content') {
        debugLog('Showing user-triggered content');
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
          const popupContent = stateRef.current.contentCache.filter((c) =>
            c.triggerPoint === event.triggerPoint
            && c.presentationType === 'popup'
          )[0];

          if (popupContent) {
            debugLog('Popup content found for trigger point', { triggerPoint: event.triggerPoint });
            setActivePopupContent(popupContent);
          } else {
            debugLog('No popup content found for trigger point', { triggerPoint: event.triggerPoint });
          }

          stateRef.current.contentCache = stateRef.current.contentCache.filter((c) =>
            c.triggerPoint !== event.triggerPoint
            || c.presentationType !== 'popup'
          );
        }

        const userTriggeredContent = stateRef.current.contentCache.filter((c) =>
          c.triggerPoint === event.triggerPoint
          && c.presentationType === 'button-triggered'
        )[0];

        if (userTriggeredContent) {
          debugLog('User-triggered content found for trigger point', { triggerPoint: event.triggerPoint });
          setActiveUserTriggeredContent(userTriggeredContent);
        } else {
          debugLog('No user-triggered content found for trigger point', { triggerPoint: event.triggerPoint });
        }
      }
    },
    [props.organizationCode, recordEvent, debugLog],
  );

  const dismissContent = useCallback(() => {
    debugLog('Content dismissed');
    onContentDismissedCallback.current?.();
    setIsUserTriggeredContentShown(false);
    setActivePopupContent(undefined);
    setIsRemoteContentReady(false);
  }, [onContentDismissedCallback.current, debugLog]);

  useEffect(() => {
    debugLog('WaveCxProvider initialized', {
      organizationCode: props.organizationCode,
      apiBaseUrl: props.apiBaseUrl ?? 'https://api.wavecx.com',
      debugMode: props.debugMode ?? false,
      disablePopupContent: props.disablePopupContent ?? false,
      contentFetchStrategy: props.contentFetchStrategy ?? 'trigger-point',
    });
  }, []);

  return (
    <WaveCxContext.Provider
      value={{
        handleEvent,
        hasUserTriggeredContent: activeUserTriggeredContent !== undefined,
        hasPopupContentForTriggerPoint: checkPopupContent,
      }}
    >
      {createPortal(
        <>
          {presentedContent && (
            <dialog
              ref={autoDialogRef}
              className={'__wcx_modal'}
              onClose={dismissContent}
            >
              <div
                className={'__wcx_modalContent'}
                style={{
                  opacity: presentedContent.webModal?.opacity,
                  boxShadow: presentedContent?.webModal?.shadowCss,
                  border: presentedContent?.webModal?.borderCss,
                  borderRadius: presentedContent?.webModal?.borderRadiusCss,
                  '--backdrop-filter': presentedContent.webModal?.backdropFilterCss,
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