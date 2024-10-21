import {createContext, CSSProperties, type ReactNode, useCallback, useContext, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import {composeFireTargetedContentEventViaApi, type FireTargetedContentEvent, type TargetedContent} from './targeted-content';
import {BusyIndicator} from './busy-indicator';
import styles from './wavecx.module.css';

export type EventHandler = (
  event:
    | { type: 'session-started'; userId: string; userIdVerification?: string; userAttributes?: object }
    | { type: 'session-ended' }
    | { type: 'trigger-point'; triggerPoint: string; onContentDismissed?: () => void }
    | { type: 'user-triggered-content'; onContentDismissed?: () => void }
) => void;

export interface WaveCxContextInterface {
  handleEvent: EventHandler;
  hasUserTriggeredContent: boolean;
}

export const WaveCxContext = createContext<WaveCxContextInterface>({
  handleEvent: () => undefined,
  hasUserTriggeredContent: false,
});

export const WaveCxProvider = (props: {
  organizationCode: string;
  children?: ReactNode;
  apiBaseUrl?: string;
  recordEvent?: FireTargetedContentEvent;
  portalParent?: Element;
  disablePopupContent?: boolean;
}) => {
  const recordEvent = useMemo(
    () =>
      props.recordEvent ??
      composeFireTargetedContentEventViaApi({
        apiBaseUrl: props.apiBaseUrl ?? 'https://api.wavecx.com',
      }),
    [props.recordEvent, props.apiBaseUrl]
  );

  const user = useRef<
    | { id: string; idVerification?: string; attributes?: object }
    | undefined
  >(undefined);
  const onContentDismissedCallback = useRef<
    | (() => void)
    | undefined
  >(undefined);

  const [contentItems, setContentItems] = useState<TargetedContent[]>([]);
  const [userTriggeredContentItems, setUserTriggeredContentItems] = useState<TargetedContent[]>([]);
  const [isUserTriggeredContentShown, setIsUserTriggeredContentShown] = useState(false);
  const [isRemoteContentReady, setIsRemoteContentReady] = useState(false);

  const activeContentItem =
    contentItems.length > 0
      ? contentItems[0]
      : isUserTriggeredContentShown && userTriggeredContentItems.length > 0
        ? userTriggeredContentItems[0]
        : undefined;

  const handleEvent = useCallback<EventHandler>(
    async (event) => {
      onContentDismissedCallback.current = undefined;

      if (event.type === 'session-started' && user.current?.id !== event.userId) {
        user.current = {
          id: event.userId,
          idVerification: event.userIdVerification,
          attributes: event.userAttributes,
        };
      } else if (event.type === 'session-ended') {
        user.current = undefined;
        setContentItems([]);
        setUserTriggeredContentItems([]);
      } else if (event.type === 'user-triggered-content') {
        if (userTriggeredContentItems.length > 0) {
          setIsUserTriggeredContentShown(true);
          onContentDismissedCallback.current = event.onContentDismissed;
        }
      } else if (event.type === 'trigger-point') {
        setContentItems([]);
        setUserTriggeredContentItems([]);
        onContentDismissedCallback.current = event.onContentDismissed;

        if (!user.current) {
          return;
        }

        const targetedContentResult = await recordEvent({
          type: 'trigger-point',
          organizationCode: props.organizationCode,
          userId: user.current.id,
          userIdVerification: user.current.idVerification,
          userAttributes: user.current.attributes,
          triggerPoint: event.triggerPoint,
        });
        if (!props.disablePopupContent) {
          setContentItems(targetedContentResult.content.filter((item: any) => item.presentationType === 'popup'));
        }
        setUserTriggeredContentItems(targetedContentResult.content.filter((item: any) => item.presentationType === 'button-triggered'));
      }
    },
    [props.organizationCode, recordEvent, user.current, userTriggeredContentItems]
  );

  const dismissContent = useCallback(() => {
    onContentDismissedCallback.current?.();
    setContentItems([]);
    setIsUserTriggeredContentShown(false);
    setIsRemoteContentReady(false);
  }, [onContentDismissedCallback.current]);

  return (
    <WaveCxContext.Provider
      value={{
        handleEvent,
        hasUserTriggeredContent: userTriggeredContentItems.length > 0,
      }}
    >
      {createPortal(
        <>
          {activeContentItem && (
            <dialog
              style={{
                opacity: activeContentItem.webModal?.opacity,
                boxShadow: activeContentItem?.webModal?.shadowCss,
                border: activeContentItem?.webModal?.borderCss,
                borderRadius: activeContentItem?.webModal?.borderRadiusCss,
                '--backdrop-filter': activeContentItem.webModal?.backdropFilterCss,
                height: activeContentItem.webModal?.heightCss,
                width: activeContentItem.webModal?.widthCss,
                margin: activeContentItem.webModal?.marginCss,
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
                  activeContentItem.webModal?.closeButton.style === 'text' ? styles.textButton : ''
                ].join(' ')}
                onClick={dismissContent}
                title={'Close'}
              >
                {activeContentItem.webModal?.closeButton.style === 'text'
                  ? activeContentItem.webModal.closeButton.label
                  : ''
                }
              </button>

              {!isRemoteContentReady && (
                <div className={styles.loadingView}>
                  <BusyIndicator
                    color={activeContentItem.loading?.color}
                    size={activeContentItem.loading?.size}
                    message={activeContentItem.loading?.message ?? 'Loading featured content'}
                  />
                </div>
              )}

              <iframe
                title={'Featured Content'}
                src={activeContentItem.viewUrl}
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