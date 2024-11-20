import {useEffect} from 'react';
import {describe, it, expect, beforeAll} from 'vitest';
import {render, screen, waitFor, type waitForOptions} from '@testing-library/react';
import '@testing-library/jest-dom/vitest'

import {useWaveCx, WaveCxProvider} from './provider';

const verifyNeverOccurs = async (negativeAssertionFn: () => unknown, options?: waitForOptions) => {
  await expect(
    waitFor(negativeAssertionFn, options),
  ).rejects.toThrow();
};

const setupMockHtmlDialogElement = () => {
  // jest-dom does not fully support dialog elements,
  // so we need to mock these methods for testing dialogs.

  HTMLDialogElement.prototype.show = function mock(
    this: HTMLDialogElement
  ) {
    this.open = true;
  };

  HTMLDialogElement.prototype.showModal = function mock(
    this: HTMLDialogElement
  ) {
    this.open = true;
  };

  HTMLDialogElement.prototype.close = function mock(
    this: HTMLDialogElement
  ) {
    this.open = false;
  };
};

describe(WaveCxProvider.name, () => {
  beforeAll(() => {
    setupMockHtmlDialogElement();
  });

  it('renders provided child elements', () => {
    render(
      <WaveCxProvider organizationCode={'org'}>
        <h1>Children</h1>
        <p>Always rendered</p>
      </WaveCxProvider>
    );
    expect(screen.getByText('Children')).toBeVisible();
    expect(screen.getByText('Always rendered')).toBeVisible();
  });

  it('renders popup content when received', async () => {
    const Consumer = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
        handleEvent({
          type: 'trigger-point',
          triggerPoint: 'trigger-point',
        });
      }, []);

      return <></>;
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => ({
          content: [{
            type: 'featurette',
            presentationType: 'popup',
            triggerPoint: 'trigger-point',
            viewUrl: 'https://mock.content.com/embed',
          }],
        })}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });
  });

  it('dismisses popup content when a different trigger point is fired', async () => {
    const Consumer = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
      }, []);

      return (
        <>
          <button
            onClick={() => handleEvent({
              type: 'trigger-point',
              triggerPoint: 'trigger-point',
            })}
          >Trigger Point
          </button>

          <button
            onClick={() => handleEvent({
              type: 'trigger-point',
              triggerPoint: 'other',
            })}
          >Other</button>
        </>
      );
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => ({
          content: [{
            type: 'featurette',
            presentationType: 'popup',
            triggerPoint: 'trigger-point',
            viewUrl: 'https://mock.content.com/embed',
          }],
        })}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    screen.getByText('Trigger Point').click();
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    screen.getByText('Other').click();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('renders a received piece of pop-up content only once per session', async () => {
    const Consumer = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
      }, []);

      return (
        <>
          <button
            onClick={() => handleEvent({
              type: 'trigger-point',
              triggerPoint: 'trigger-point',
            })}
          >Trigger Point
          </button>

          <button
            onClick={() => handleEvent({
              type: 'trigger-point',
              triggerPoint: 'other',
            })}
          >Other</button>
        </>
      );
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => ({
          content: [
            {
              type: 'featurette',
              presentationType: 'popup',
              triggerPoint: 'trigger-point',
              viewUrl: 'https://mock.content.com/embed',
            },
            {
              type: 'featurette',
              presentationType: 'popup',
              triggerPoint: 'other',
              viewUrl: 'https://mock.content.com/other-embed',
            },
          ],
        })}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    screen.getByText('Trigger Point').click();
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    screen.getByText('Other').click();
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    screen.getByText('Trigger Point').click();
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('does not render pop-up content if disabled', async () => {
    const Consumer = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
        handleEvent({
          type: 'trigger-point',
          triggerPoint: 'trigger-point',
        });
      }, []);

      return <></>;
    };

    render(
      <WaveCxProvider
        disablePopupContent={true}
        organizationCode={'org'}
        recordEvent={async () => ({
          content: [{
            type: 'featurette',
            presentationType: 'popup',
            triggerPoint: 'trigger-point',
            viewUrl: 'https://mock.content.com/embed',
          }],
        })}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    await verifyNeverOccurs(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
      expect(screen.getByTitle('Featured Content')).toBeVisible();
    });
  });

  it('provides a user-triggered-content status flag', async () => {
    const Consumer = () => {
      const {handleEvent, hasUserTriggeredContent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
        handleEvent({
          type: 'trigger-point',
          triggerPoint: 'trigger-point',
        });
      }, []);

      return (
        <label>
          Has user-triggered content
          <input
            name={'has-user-triggered-content'}
            type={'checkbox'}
            checked={hasUserTriggeredContent}
            onChange={() => undefined}
          />
        </label>
      );
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => ({
          content: [{
            type: 'featurette',
            presentationType: 'button-triggered',
            triggerPoint: 'trigger-point',
            viewUrl: 'https://mock.content.com/embed',
          }],
        })}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Has user-triggered content')).toBeChecked();
    });
  });

  it('invokes an optional callback when popup content is dismissed', async () => {
    let wasCallbackInvoked = false;

    const Consumer = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
        handleEvent({
          type: 'trigger-point',
          triggerPoint: 'trigger-point',
          onContentDismissed: () => {
            wasCallbackInvoked = true;
          }
        });
      }, []);

      return <></>;
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => ({
          content: [{
            type: 'featurette',
            presentationType: 'popup',
            triggerPoint: 'trigger-point',
            viewUrl: 'https://mock.content.com/embed',
          }],
        })}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    screen.getByTitle('Close').click();
    expect(wasCallbackInvoked).toEqual(true);
  });

  it('invokes an optional callback when user-triggered content is dismissed', async () => {
    let wasCallbackInvoked = false;

    const Consumer = () => {
      const {handleEvent, hasUserTriggeredContent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
        handleEvent({
          type: 'trigger-point',
          triggerPoint: 'trigger-point',
        });
      }, []);

      return !hasUserTriggeredContent ? <></> : (
        <button
          onClick={() => handleEvent({
            type: 'user-triggered-content',
            onContentDismissed: () => {
              wasCallbackInvoked = true;
            }
          })}
        >Show Content</button>
      );
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => ({
          content: [{
            type: 'featurette',
            presentationType: 'button-triggered',
            triggerPoint: 'trigger-point',
            viewUrl: 'https://mock.content.com/embed',
          }],
        })}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Show Content')).toBeVisible();
      screen.getByText('Show Content').click();
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeVisible();
    });

    screen.getByTitle('Close').click();
    expect(wasCallbackInvoked).toEqual(true);
  });
});