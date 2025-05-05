import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';

import {composeFireTargetedContentEventViaApi, type FireTargetedContentEvent, type TargetedContent} from './targeted-content';
import {BusyIndicator} from './busy-indicator';
import {clearSessionToken, InitiateSession, readSessionToken, storeSessionToken} from './sessions';

export type Event =
  | { type: 'session-started'; userId: string; userIdVerification?: string; userAttributes?: object }
  | { type: 'session-ended' }
  | { type: 'trigger-point'; triggerPoint: string; onContentDismissed?: () => void }
  | { type: 'user-triggered-content'; onContentDismissed?: () => void };

export type EventHandler = (event: Event) => void;

export interface WaveCxContextInterface {
  handleEvent: EventHandler;
  hasUserTriggeredContent: boolean;
}

export const WaveCxContext = createContext<WaveCxContextInterface>({
  handleEvent: () => undefined,
  hasUserTriggeredContent: false,
});

export type ContentFetchStrategy =
  | 'session-start'
  | 'trigger-point';

let isContentLoading = false;
let eventQueue: Event[] = [];
let contentCache: TargetedContent[] = [];

export const WaveCxProvider = (props: {
  organizationCode: string;
  children?: ReactNode;
  apiBaseUrl?: string;
  recordEvent?: FireTargetedContentEvent;
  initiateSession?: InitiateSession;
  portalParent?: Element;
  disablePopupContent?: boolean;
  contentFetchStrategy?: ContentFetchStrategy;
}) => {
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

  const [activePopupContent, setActivePopupContent] = useState<TargetedContent | undefined>(undefined);
  const [activeUserTriggeredContent, setActiveUserTriggeredContent] = useState<TargetedContent | undefined>(undefined);
  const [isUserTriggeredContentShown, setIsUserTriggeredContentShown] = useState(false);
  const [isRemoteContentReady, setIsRemoteContentReady] = useState(false);

  const presentedContent =
    activePopupContent ?? (isUserTriggeredContentShown
      ? activeUserTriggeredContent
      : undefined);

  const handleEvent = useCallback<EventHandler>(
    async (event) => {
      onContentDismissedCallback.current = undefined;

      if (event.type === 'session-started') {
        contentCache = [];

        const sessionToken = readSessionToken();
        if (sessionToken) {
          try {
            isContentLoading = true;
            const targetedContentResult = await recordEvent({
              organizationCode: props.organizationCode,
              type: 'session-refresh',
              sessionToken: sessionToken,
              userId: event.userId,
            });
            contentCache = targetedContentResult.content;
          } catch {
          }
          isContentLoading = false;
          if (eventQueue.length > 0) {
            eventQueue.forEach((e) => handleEvent(e));
            eventQueue = [];
          }
          return;
        }

        if (props.initiateSession) {
          try {
            isContentLoading = true;
            const sessionResult = await props.initiateSession({
              organizationCode: props.organizationCode,
              userId: event.userId,
              userIdVerification: event.userIdVerification,
              userAttributes: event.userAttributes,
            });
            storeSessionToken(sessionResult.sessionToken);
            const targetedContentResult = await recordEvent({
              organizationCode: props.organizationCode,
              type: 'session-refresh',
              sessionToken: sessionResult.sessionToken,
              userId: event.userId,
            });
            contentCache = targetedContentResult.content;
          } catch {}
          isContentLoading = false;
          if (eventQueue.length > 0) {
            eventQueue.forEach((e) => handleEvent(e));
            eventQueue = [];
          }
        } else {
          isContentLoading = true;
          try {
            const targetedContentResult = await recordEvent({
              type: 'session-started',
              organizationCode: props.organizationCode,
              userId: event.userId,
              userIdVerification: event.userIdVerification,
              userAttributes: event.userAttributes,
            });
            if (targetedContentResult.sessionToken) {
              storeSessionToken(targetedContentResult.sessionToken);
            }
            contentCache = targetedContentResult.content;
          } catch {
          }
          isContentLoading = false;
          if (eventQueue.length > 0) {
            eventQueue.forEach((e) => handleEvent(e));
            eventQueue = [];
          }
        }
      } else if (event.type === 'session-ended') {
        contentCache = [];
        setActivePopupContent(undefined);
        setActiveUserTriggeredContent(undefined);
        clearSessionToken();
      } else if (event.type === 'user-triggered-content') {
        setIsUserTriggeredContentShown(true);
        onContentDismissedCallback.current = event.onContentDismissed;
      } else if (event.type === 'trigger-point') {
        setActivePopupContent(undefined);
        setActiveUserTriggeredContent(undefined);
        onContentDismissedCallback.current = event.onContentDismissed;

        if (isContentLoading) {
          eventQueue.push(event);
          return;
        }

        if (!props.disablePopupContent) {
          setActivePopupContent(contentCache.filter((c) =>
            c.triggerPoint === event.triggerPoint
            && c.presentationType === 'popup'
          )[0]);

          contentCache = contentCache.filter((c) =>
            c.triggerPoint !== event.triggerPoint
            || c.presentationType !== 'popup'
          );
        }
        setActiveUserTriggeredContent(contentCache.filter((c) =>
          c.triggerPoint === event.triggerPoint
          && c.presentationType === 'button-triggered'
        )[0]);
      }
    },
    [props.organizationCode, recordEvent],
  );

  const dismissContent = useCallback(() => {
    onContentDismissedCallback.current?.();
    setIsUserTriggeredContentShown(false);
    setActivePopupContent(undefined);
    setIsRemoteContentReady(false);
  }, [onContentDismissedCallback.current]);

  return (
    <WaveCxContext.Provider
      value={{
        handleEvent,
        hasUserTriggeredContent: activeUserTriggeredContent !== undefined,
      }}
    >
      {createPortal(
        <>
          {presentedContent && (
            <dialog
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
              ref={(r) => {
                r?.showModal();
                r?.focus();
              }}
              className={'__wcx_modal'}
              onClick={(e) => {
                if (e.currentTarget === e.target) {
                  dismissContent();
                }
              }}
              onClose={dismissContent}
            >
              <button
                className={[
                  '__wcx_modalCloseButton',
                  presentedContent.webModal?.closeButton.style === 'text' ? '__wcx_textButton' : ''
                ].join(' ')}
                onClick={dismissContent}
                title={'Close'}
              >
                {presentedContent.webModal?.closeButton.style === 'text'
                  ? presentedContent.webModal.closeButton.label
                  : ''
                }
              </button>

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
                onLoad={() => setIsRemoteContentReady(true)}
              />
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