import {createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState} from 'react';
import {createPortal} from 'react-dom';

import {composeFireTargetedContentEventViaApi, FireTargetedContentEvent} from './targeted-content';
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

  const [contentItems, setContentItems] = useState<
    { url: string; presentationStyle: string }[]
  >([]);
  const [userTriggeredContentItems, setUserTriggeredContentItems] = useState<
    { url: string; presentationStyle: string }[]
  >([]);
  const [isUserTriggeredContentShown, setIsUserTriggeredContentShown] = useState(false);

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
          setContentItems(
            targetedContentResult.content
              .filter((item: any) => item.presentationType === 'popup')
              .map((item: any) => ({
                presentationStyle: item.presentationStyle,
                url: item.viewUrl,
                slides:
                  item.presentationStyle !== 'native'
                    ? []
                    : item.content
                      .sort((a: any, b: any) =>
                        a.sortIndex < b.sortIndex ? -1 : 1
                      )
                      .map((c: any) => ({
                        content: c.hasBlockContent
                          ? {
                            type: 'blocks',
                            blocks: c.smallAspectContentBlocks,
                          }
                          : {
                            type: 'basic',
                            bodyHtml: c.smallAspectFeatureBody,
                            imageUrl: c.smallAspectPreviewImage?.url,
                          },
                      })),
              }))
          );
        }
        setUserTriggeredContentItems(
          targetedContentResult.content
            .filter((item: any) => item.presentationType === 'button-triggered')
            .map((item: any) => ({
              presentationStyle: item.presentationStyle,
              url: item.viewUrl,
              slides:
                item.presentationStyle !== 'native'
                  ? []
                  : item.content
                    .sort((a: any, b: any) =>
                      a.sortIndex < b.sortIndex ? -1 : 1
                    )
                    .map((c: any) => ({
                      content: c.hasBlockContent
                        ? {
                          type: 'blocks',
                          blocks: c.smallAspectContentBlocks,
                        }
                        : {
                          type: 'basic',
                          bodyHtml: c.smallAspectFeatureBody,
                          imageUrl: c.smallAspectPreviewImage?.url,
                        },
                    })),
            }))
        );
      }
    },
    [props.organizationCode, recordEvent, user.current, userTriggeredContentItems]
  );

  const dismissContent = useCallback(() => {
    onContentDismissedCallback.current?.();
    setContentItems([]);
    setIsUserTriggeredContentShown(false);
  }, [onContentDismissedCallback.current]);

  const escapeCallback = useCallback((event: {key: string}) => {
    if (
      event.key === "Escape" &&
      (contentItems.length > 0 || isUserTriggeredContentShown)
    ) {
      dismissContent();
    }
  }, [contentItems, isUserTriggeredContentShown, dismissContent]);

  useEffect(() => {
    document.addEventListener("keydown", escapeCallback, false);
    return () => {
      document.removeEventListener("keydown", escapeCallback, false);
    };
  }, [escapeCallback]);

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
            <div
              className={styles.modalContainer}
              onClick={(e) => {
                if (e.currentTarget === e.target) {
                  dismissContent();
                }
              }}
            >
              <div className={styles.modal}>
                <button
                  className={styles.modalCloseButton}
                  onClick={dismissContent}
                  title={'Close'}
                />
                <iframe
                  title={'Featured Content'}
                  src={activeContentItem.url}
                  className={styles.webview}
                />
              </div>
            </div>
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