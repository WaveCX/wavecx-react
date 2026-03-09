import {
  composeFireTargetedContentEventViaApi,
  type FireTargetedContentEvent,
  type TargetedContent,
} from './targeted-content';
import {clearSessionToken, type InitiateSession, readSessionToken, storeSessionToken} from './sessions';
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

export type ContentFetchStrategy =
  | 'session-start'
  | 'trigger-point';

export type CoreConfig = {
  organizationCode: string;
  apiBaseUrl?: string;
  recordEvent?: FireTargetedContentEvent;
  initiateSession?: InitiateSession;
  disablePopupContent?: boolean;
  debugMode?: boolean;
  retryConfig?: RetryConfig;
  mockModeConfig?: MockModeConfig;
};

type DebugLog = (message: string, data?: any) => void;

const createDebugLogger = (debugMode: boolean): DebugLog => {
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
    if (mockModeEnabled && parsed.protocol === 'data:') {
      return true;
    }
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
};

// --- Shared state ---

let contentCache: TargetedContent[] = [];
let isContentLoading = false;
let eventQueue: Event[] = [];
let activeTriggerPoint: string | undefined = undefined;

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function getContentCache(): TargetedContent[] {
  return contentCache;
}

export function getIsContentLoading(): boolean {
  return isContentLoading;
}

export function hasContent(triggerPoint: string, presentationType?: 'popup' | 'button-triggered'): boolean {
  return contentCache.some((c) =>
    c.triggerPoint === triggerPoint
    && (presentationType === undefined || c.presentationType === presentationType)
  );
}

export function hasPopupContentForTriggerPoint(triggerPoint: string): boolean {
  return hasContent(triggerPoint, 'popup');
}

export function getActiveTriggerPoint(): string | undefined {
  return activeTriggerPoint;
}

// --- Modal rendering ---

let modalContainer: HTMLElement | null = null;
let currentDismissCallback: (() => void) | undefined = undefined;
let cleanupOutsideClickListener: (() => void) | undefined = undefined;

function getModalContainer(): HTMLElement {
  if (!modalContainer) {
    modalContainer = document.createElement('div');
    modalContainer.setAttribute('data-wavecx-modal-container', '');
    document.body.appendChild(modalContainer);
  }
  return modalContainer;
}

function renderModal(content: TargetedContent, debugLog: DebugLog) {
  const container = getModalContainer();
  container.innerHTML = '';

  const dialog = document.createElement('dialog');
  dialog.className = '__wcx_modal';
  if (content.webModal?.backdropFilterCss) {
    dialog.style.setProperty('--backdrop-filter', content.webModal.backdropFilterCss);
  }

  const modalContent = document.createElement('div');
  modalContent.className = '__wcx_modalContent';
  if (content.webModal) {
    if (content.webModal.opacity !== undefined) modalContent.style.opacity = String(content.webModal.opacity);
    if (content.webModal.shadowCss) modalContent.style.boxShadow = content.webModal.shadowCss;
    if (content.webModal.borderCss) modalContent.style.border = content.webModal.borderCss;
    if (content.webModal.borderRadiusCss) modalContent.style.borderRadius = content.webModal.borderRadiusCss;
    if (content.webModal.heightCss) modalContent.style.height = content.webModal.heightCss;
    if (content.webModal.widthCss) modalContent.style.width = content.webModal.widthCss;
    if (content.webModal.marginCss) modalContent.style.margin = content.webModal.marginCss;
  }

  const form = document.createElement('form');
  form.method = 'dialog';
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    dialog.close();
  });

  const closeButton = document.createElement('button');
  closeButton.className = '__wcx_modalCloseButton';
  closeButton.title = 'Close';
  if (content.webModal?.closeButton.style === 'text') {
    closeButton.className += ' __wcx_textButton';
    closeButton.textContent = content.webModal.closeButton.label;
  }
  form.appendChild(closeButton);
  modalContent.appendChild(form);

  const loadingView = document.createElement('div');
  loadingView.className = '__wcx_loadingView';
  const busy = document.createElement('span');
  busy.className = '__wcx_busy';
  busy.setAttribute('aria-label', content.loading?.message ?? 'Loading featured content');
  const bar = document.createElement('span');
  bar.className = '__wcx_bar';
  if (content.loading?.size) bar.style.setProperty('--size', content.loading.size);
  if (content.loading?.color) bar.style.setProperty('--color', content.loading.color);
  busy.appendChild(bar);
  loadingView.appendChild(busy);
  modalContent.appendChild(loadingView);

  const iframe = document.createElement('iframe');
  iframe.title = 'Featured Content';
  iframe.src = content.viewUrl;
  const sandboxPermissions = [
    'allow-scripts',
    'allow-same-origin',
    'allow-forms',
    'allow-popups',
    'allow-popups-to-escape-sandbox',
    'allow-top-navigation-by-user-activation',
  ].join(' ');
  iframe.setAttribute('sandbox', sandboxPermissions);
  iframe.className = '__wcx_webview';
  iframe.style.display = 'none';
  iframe.addEventListener('load', () => {
    debugLog('Content iframe loaded', { viewUrl: content.viewUrl });
    loadingView.style.display = 'none';
    iframe.style.display = '';
  });
  modalContent.appendChild(iframe);

  dialog.appendChild(modalContent);

  dialog.addEventListener('close', () => {
    dismissModal();
  });

  // Close on outside click
  const handleOutsideClick = (e: MouseEvent) => {
    if (e.target === dialog) {
      dialog.close();
    }
  };
  cleanupOutsideClickListener?.();
  document.addEventListener('mousedown', handleOutsideClick);
  cleanupOutsideClickListener = () => {
    document.removeEventListener('mousedown', handleOutsideClick);
  };

  const handleCancel = (e: globalThis.Event) => {
    e.preventDefault();
    dialog.close();
  };
  dialog.addEventListener('cancel', handleCancel);

  container.appendChild(dialog);

  try {
    dialog.showModal();
    dialog.focus();
  } catch (err) {
    debugLog('Failed to open modal', { error: err });
  }
}

function dismissModal() {
  cleanupOutsideClickListener?.();
  cleanupOutsideClickListener = undefined;
  if (modalContainer) {
    modalContainer.innerHTML = '';
  }
  activeTriggerPoint = undefined;
  const callback = currentDismissCallback;
  currentDismissCallback = undefined;
  callback?.();
  notify();
}

// --- Event handling ---

export function createHandleEvent(config: CoreConfig): EventHandler {
  const debugLog = createDebugLogger(config.debugMode ?? false);
  const mockModeConfig = config.mockModeConfig ?? defaultMockModeConfig;
  const retryConfig = config.retryConfig ?? defaultRetryConfig;

  const recordEvent: FireTargetedContentEvent = config.recordEvent
    ?? composeFireTargetedContentEventViaApi({
      apiBaseUrl: config.apiBaseUrl ?? 'https://api.wavecx.com',
      retryFn: (fn) => retryWithBackoff(fn, retryConfig, debugLog),
    });

  const processQueuedEvents = async (handleEvent: EventHandler) => {
    if (eventQueue.length === 0) return;
    const queue = [...eventQueue];
    eventQueue = [];
    debugLog('Processing queued events', { queueLength: queue.length });
    for (const queuedEvent of queue) {
      try {
        await handleEvent(queuedEvent);
      } catch (error) {
        debugLog('Error processing queued event', { event: queuedEvent, error });
      }
    }
  };

  const handleEvent: EventHandler = async (event) => {
    debugLog('handleEvent called', { eventType: event.type });

    if (event.type === 'session-started') {
      if (isContentLoading) {
        debugLog('Session start already in progress, skipping');
        return;
      }

      debugLog('Starting session', { userId: event.userId });
      contentCache = [];
      notify();

      if (mockModeConfig.enabled) {
        debugLog('Mock mode enabled - using mock content instead of API call');
        isContentLoading = true;
        notify();
        await simulateNetworkDelay(mockModeConfig);
        contentCache = getInitialMockContent(mockModeConfig);
        debugLog('Mock content loaded', { mockContent: contentCache });
        isContentLoading = false;
        notify();
        await processQueuedEvents(handleEvent);
        return;
      }

      const sessionToken = readSessionToken();
      if (sessionToken) {
        debugLog('Existing session token found, refreshing session');
        try {
          isContentLoading = true;
          notify();
          const result = await recordEvent({
            organizationCode: config.organizationCode,
            type: 'session-refresh',
            sessionToken,
            userId: event.userId,
          });
          contentCache = result.content;
          debugLog('Session refreshed successfully', { content: result.content });
        } catch (error) {
          debugLog('Session refresh failed', { error });
        }
        isContentLoading = false;
        notify();
        await processQueuedEvents(handleEvent);
        return;
      }

      if (config.initiateSession) {
        debugLog('Using custom initiateSession function');
        try {
          isContentLoading = true;
          notify();
          const sessionResult = await config.initiateSession({
            organizationCode: config.organizationCode,
            userId: event.userId,
            userIdVerification: event.userIdVerification,
            userAttributes: event.userAttributes,
          });
          storeSessionToken(sessionResult.sessionToken, sessionResult.expiresIn ?? 3600);
          debugLog('Session initiated, fetching content');
          const result = await recordEvent({
            organizationCode: config.organizationCode,
            type: 'session-refresh',
            sessionToken: sessionResult.sessionToken,
            userId: event.userId,
          });
          contentCache = result.content;
          debugLog('Content fetched successfully', { content: result.content });
        } catch (error) {
          debugLog('Session initiation failed', { error });
        }
        isContentLoading = false;
        notify();
        await processQueuedEvents(handleEvent);
      } else {
        debugLog('Starting new session via API');
        isContentLoading = true;
        notify();
        try {
          const result = await recordEvent({
            type: 'session-started',
            organizationCode: config.organizationCode,
            userId: event.userId,
            userIdVerification: event.userIdVerification,
            userAttributes: event.userAttributes,
          });
          if (result.sessionToken) {
            storeSessionToken(result.sessionToken, result.expiresIn ?? 3600);
            debugLog('Session token stored');
          }
          contentCache = result.content;
          debugLog('Session started successfully', { content: result.content });
        } catch (error) {
          debugLog('Session start failed', { error });
        }
        isContentLoading = false;
        notify();
        await processQueuedEvents(handleEvent);
      }
    } else if (event.type === 'session-ended') {
      debugLog('Ending session');
      contentCache = [];
      dismissModal();
      clearSessionToken();
      notify();
      debugLog('Session ended successfully');
    } else if (event.type === 'user-triggered-content') {
      const triggerPoint = event.triggerPoint ?? activeTriggerPoint;
      debugLog('Showing user-triggered content', { triggerPoint });

      if (triggerPoint) {
        const content = contentCache.find((c) =>
          c.triggerPoint === triggerPoint
          && c.presentationType === 'button-triggered'
        );

        if (content) {
          if (isValidContentUrl(content.viewUrl, mockModeConfig.enabled)) {
            debugLog('User-triggered content found', { triggerPoint });
            currentDismissCallback = event.onContentDismissed;
            renderModal(content, debugLog);
          } else {
            debugLog('User-triggered content rejected - invalid URL', {
              triggerPoint, viewUrl: content.viewUrl,
            });
          }
        } else {
          debugLog('No user-triggered content found', { triggerPoint });
        }
      }
    } else if (event.type === 'trigger-point') {
      debugLog('Trigger point fired', { triggerPoint: event.triggerPoint });

      if (isContentLoading) {
        debugLog('Content is loading, queueing trigger point event');
        eventQueue.push(event);
        return;
      }

      // Don't dismiss if the same trigger point fires again (e.g. React strict mode double-invoke)
      if (activeTriggerPoint !== event.triggerPoint) {
        dismissModal();
      }
      activeTriggerPoint = event.triggerPoint;
      currentDismissCallback = event.onContentDismissed;

      if (!config.disablePopupContent) {
        const popupContent = contentCache.find((c) =>
          c.triggerPoint === event.triggerPoint
          && c.presentationType === 'popup'
        );

        if (popupContent) {
          if (isValidContentUrl(popupContent.viewUrl, mockModeConfig.enabled)) {
            debugLog('Popup content found for trigger point', { triggerPoint: event.triggerPoint });
            renderModal(popupContent, debugLog);
          } else {
            debugLog('Popup content rejected - invalid URL', {
              triggerPoint: event.triggerPoint, viewUrl: popupContent.viewUrl,
            });
          }
        }

        // Remove consumed popup content from cache
        contentCache = contentCache.filter((c) =>
          c.triggerPoint !== event.triggerPoint
          || c.presentationType !== 'popup'
        );
      }

      notify();
    }
  };

  debugLog('WaveCX core initialized', {
    organizationCode: config.organizationCode,
    apiBaseUrl: config.apiBaseUrl ?? 'https://api.wavecx.com',
    debugMode: config.debugMode ?? false,
    disablePopupContent: config.disablePopupContent ?? false,
    mockMode: mockModeConfig.enabled,
  });

  return handleEvent;
}

// For testing
export function resetCoreState(): void {
  contentCache = [];
  isContentLoading = false;
  eventQueue = [];
  activeTriggerPoint = undefined;
  listeners.clear();
  cleanupOutsideClickListener?.();
  cleanupOutsideClickListener = undefined;
  if (modalContainer) {
    modalContainer.remove();
    modalContainer = null;
  }
  currentDismissCallback = undefined;
}
