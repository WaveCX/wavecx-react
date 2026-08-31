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
