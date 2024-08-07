import {createContext, useMemo, useState, useCallback, useContext} from 'react';
import type {ReactNode} from 'react';

import { composeFireTargetedContentEventViaApi } from './targeted-content';
import type { FireTargetedContentEvent } from './targeted-content';
import styles from './wavecx.module.css';

type EventHandler = (
  event:
    | { type: 'session-started'; userId: string; userIdVerification?: string; userAttributes?: object }
    | { type: 'session-ended' }
    | { type: 'trigger-point'; triggerPoint: string }
    | { type: 'user-triggered-content' }
) => void;

type WaveCxContext = {
  handleEvent: EventHandler;
  hasUserTriggeredContent: boolean;
};

const WaveCxContext = createContext<WaveCxContext | undefined>(undefined);

export const WaveCxProvider = (props: {
  organizationCode: string;
  children?: ReactNode;
  apiBaseUrl?: string;
  recordEvent?: FireTargetedContentEvent;
}) => {
  const recordEvent = useMemo(
    () =>
      props.recordEvent ??
      composeFireTargetedContentEventViaApi({
        apiBaseUrl: props.apiBaseUrl ?? 'https://api.wavecx.com',
      }),
    [props.recordEvent, props.apiBaseUrl]
  );

  const [user, setUser] = useState<
    undefined | { id: string; idVerification?: string; attributes?: object }
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
      if (event.type === 'session-started' && user?.id !== event.userId) {
        setUser({
          id: event.userId,
          idVerification: event.userIdVerification,
          attributes: event.userAttributes,
        });
      } else if (event.type === 'session-ended') {
        setUser(undefined);
        setContentItems([]);
        setUserTriggeredContentItems([]);
      } else if (event.type === 'user-triggered-content') {
        setIsUserTriggeredContentShown(true);
      } else if (event.type === 'trigger-point') {
        setContentItems([]);
        setUserTriggeredContentItems([]);

        if (!user) {
          return;
        }

        const targetedContentResult = await recordEvent({
          type: 'trigger-point',
          organizationCode: props.organizationCode,
          userId: user.id,
          userIdVerification: user.idVerification,
          triggerPoint: event.triggerPoint,
          userAttributes: user.attributes,
        });
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
    [props.organizationCode, recordEvent, user]
  );

  return (
    <WaveCxContext.Provider
      value={{
        handleEvent,
        hasUserTriggeredContent: userTriggeredContentItems.length > 0,
      }}
    >
      {activeContentItem && (
        <div
          className={styles.modalContainer}
          onClick={(e) => {
            if (e.currentTarget === e.target) {
              setContentItems([]);
              setIsUserTriggeredContentShown(false);
            }
          }}
        >
          <div className={styles.modal}>
            <iframe src={activeContentItem.url} className={styles.webview} />
          </div>
        </div>
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
