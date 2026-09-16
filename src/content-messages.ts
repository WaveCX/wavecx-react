export const contentMessageSource = 'wavecx';

export type DismissContentMessage = {
  source: typeof contentMessageSource;
  type: 'dismiss-content';
  reason?: 'no-show-again' | 'view-later' | 'user-closed';
  suppressForSession?: boolean;
};

export type ContentMessage = DismissContentMessage;

export const isDismissContentMessage = (data: unknown): data is DismissContentMessage => {
  if (typeof data !== 'object' || data === null) {
    return false;
  }
  const message = data as Partial<DismissContentMessage>;
  return message.source === contentMessageSource && message.type === 'dismiss-content';
};

/**
 * The origin a given content URL is expected to post from, or undefined when the
 * URL has an opaque origin (`data:`/`blob:`, used in mock mode) and origin
 * comparison isn't meaningful. Callers must still verify the sending window.
 */
export const expectedContentOrigin = (viewUrl: string): string | undefined => {
  try {
    const {origin} = new URL(viewUrl);
    return origin === 'null' ? undefined : origin;
  } catch {
    return undefined;
  }
};

/**
 * Query param content reads to learn which content messages this SDK acts on, so it can hide
 * controls an older SDK would ignore (e.g. a close button). Shared contract with the React
 * Native SDK.
 */
export const contentCapabilitiesParam = 'wcxCapabilities';
export const contentCapabilities = ['dismiss-content'] as const;

/**
 * Appends this SDK's capabilities to a content URL. Apply it when loading content, never to
 * the cached URL: session suppression matches cache entries on the exact viewUrl. URLs that
 * aren't http(s) (mock-mode `data:` content) are returned unchanged.
 */
export const withContentCapabilities = (viewUrl: string): string => {
  if (!/^https?:\/\//i.test(viewUrl)) {
    return viewUrl;
  }
  const hashIndex = viewUrl.indexOf('#');
  const base = hashIndex === -1 ? viewUrl : viewUrl.slice(0, hashIndex);
  const hash = hashIndex === -1 ? '' : viewUrl.slice(hashIndex);
  const separator = !base.includes('?') ? '?' : /[?&]$/.test(base) ? '' : '&';
  const value = encodeURIComponent(contentCapabilities.join(','));
  return `${base}${separator}${contentCapabilitiesParam}=${value}${hash}`;
};
