import {
  createContext,
  CSSProperties,
  type ReactNode,
  useCallback,
  useContext,
  useRef,
  useState
} from 'react';
import {createPortal} from 'react-dom';

import {composeFireTargetedContentEventViaApi, type FireTargetedContentEvent, type TargetedContent} from './targeted-content';
import {BusyIndicator} from './busy-indicator';
import styles from './wavecx.module.css';

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

let isContentLoading = false;
let eventQueue: Event[] = [];
let contentCache: TargetedContent[] = [];

export const WaveCxProvider = (props: {
  organizationCode: string;
  children?: ReactNode;
  apiBaseUrl?: string;
  recordEvent?: FireTargetedContentEvent;
  portalParent?: Element;
  disablePopupContent?: boolean;
}) => {
  const recordEvent = useCallback(
      props.recordEvent ??
      composeFireTargetedContentEventViaApi({
        apiBaseUrl: props.apiBaseUrl ?? 'https://api.wavecx.com',
      }),
    [props.recordEvent, props.apiBaseUrl],
  );

  const user = useRef<
    | { id: string; idVerification?: string; attributes?: object }
    | undefined
  >(undefined);
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

      if (event.type === 'session-started' && user.current?.id !== event.userId) {
        user.current = {
          id: event.userId,
          idVerification: event.userIdVerification,
          attributes: event.userAttributes,
        };

        isContentLoading = true;
        try {
          const targetedContentResult = await recordEvent({
            type: 'session-started',
            organizationCode: props.organizationCode,
            userId: event.userId,
            userIdVerification: event.userIdVerification,
            userAttributes: event.userAttributes,
          });
          contentCache = targetedContentResult.content;
        } catch {}
        isContentLoading = false;
        if (eventQueue.length > 0) {
          eventQueue.forEach((e) => handleEvent(e));
          eventQueue = [];
        }
      } else if (event.type === 'session-ended') {
        user.current = undefined;
        setActivePopupContent(undefined);
        setActiveUserTriggeredContent(undefined);
      } else if (event.type === 'user-triggered-content') {
        setIsUserTriggeredContentShown(true);
        onContentDismissedCallback.current = event.onContentDismissed;
      } else if (event.type === 'trigger-point') {
        if (isContentLoading) {
          eventQueue.push(event);
          return;
        }

        onContentDismissedCallback.current = event.onContentDismissed;
        setActivePopupContent(contentCache.filter((c) =>
          c.triggerPoint === event.triggerPoint
          && c.presentationType === 'popup'
        )[0]);
        contentCache = contentCache.filter((c) =>
          c.triggerPoint !== event.triggerPoint
          || c.presentationType !== 'popup'
        );
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
              className={styles.modal}
              onClick={(e) => {
                if (e.currentTarget === e.target) {
                  dismissContent();
                }
              }}
              onClose={dismissContent}
            >
              <button
                className={[
                  styles.modalCloseButton,
                  presentedContent.webModal?.closeButton.style === 'text' ? styles.textButton : ''
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
                <div className={styles.loadingView}>
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
                className={styles.webview}
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