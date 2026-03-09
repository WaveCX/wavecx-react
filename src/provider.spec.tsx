import {useEffect} from 'react';
import {describe, it, expect, beforeAll, beforeEach} from 'vitest';
import {render, screen, waitFor, type waitForOptions} from '@testing-library/react';
import '@testing-library/jest-dom/vitest'

import {useWaveCx, WaveCxProvider} from './provider';
import {resetCoreState} from './core';

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
    this.dispatchEvent(new Event('close'));
  };
};

describe(WaveCxProvider.name, () => {
  beforeAll(() => {
    setupMockHtmlDialogElement();
  });

  beforeEach(() => {
    resetCoreState();
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
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
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
            triggerPoint: 'trigger-point',
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

  it('provides isContentLoading flag during content fetch', async () => {
    let resolveApi!: (value: any) => void;
    const apiPromise = new Promise(r => { resolveApi = r; });

    const Consumer = () => {
      const {handleEvent, isContentLoading} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
      }, [handleEvent]);

      return (
        <span data-testid="loading-status">{isContentLoading ? 'loading' : 'ready'}</span>
      );
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => {
          await apiPromise;
          return {
            content: [{
              type: 'featurette',
              presentationType: 'popup',
              triggerPoint: 'test',
              viewUrl: 'https://mock.content.com/embed',
            }],
          };
        }}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    // Should be loading while API hasn't resolved
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('loading');
    });

    // Resolve the API call
    resolveApi(undefined);

    // Eventually should finish loading
    await waitFor(() => {
      expect(screen.getByTestId('loading-status')).toHaveTextContent('ready');
    });
  });

  it('shares content state across multiple providers', async () => {
    const ConsumerA = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
      }, []);

      return <span data-testid="consumer-a">A</span>;
    };

    const ConsumerB = () => {
      const {hasContent} = useWaveCx();
      return (
        <span data-testid="consumer-b">
          {hasContent('trigger-point', 'button-triggered') ? 'has-content' : 'no-content'}
        </span>
      );
    };

    render(
      <>
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
          <ConsumerA/>
        </WaveCxProvider>
        <WaveCxProvider organizationCode={'org'}>
          <ConsumerB/>
        </WaveCxProvider>
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('consumer-b')).toHaveTextContent('has-content');
    });
  });

  it('shares loading state across multiple providers', async () => {
    let resolveApi!: (value: any) => void;
    const apiPromise = new Promise(r => { resolveApi = r; });

    const ConsumerA = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
      }, []);

      return <span data-testid="consumer-a">A</span>;
    };

    const ConsumerB = () => {
      const {isContentLoading} = useWaveCx();
      return (
        <span data-testid="consumer-b-loading">
          {isContentLoading ? 'loading' : 'ready'}
        </span>
      );
    };

    render(
      <>
        <WaveCxProvider
          organizationCode={'org'}
          recordEvent={async () => {
            await apiPromise;
            return {content: []};
          }}
        >
          <ConsumerA/>
        </WaveCxProvider>
        <WaveCxProvider organizationCode={'org'}>
          <ConsumerB/>
        </WaveCxProvider>
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('consumer-b-loading')).toHaveTextContent('loading');
    });

    resolveApi(undefined);

    await waitFor(() => {
      expect(screen.getByTestId('consumer-b-loading')).toHaveTextContent('ready');
    });
  });

  it('shares content state across multiple providers', async () => {
    const ConsumerA = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
      }, []);

      return <span data-testid="consumer-a">A</span>;
    };

    const ConsumerB = () => {
      const {hasContent} = useWaveCx();
      return (
        <span data-testid="consumer-b">
          {hasContent('trigger-point', 'button-triggered') ? 'has-content' : 'no-content'}
        </span>
      );
    };

    render(
      <>
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
          <ConsumerA/>
        </WaveCxProvider>
        <WaveCxProvider organizationCode={'org'}>
          <ConsumerB/>
        </WaveCxProvider>
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('consumer-b')).toHaveTextContent('has-content');
    });
  });

  it('shares loading state across multiple providers', async () => {
    let resolveApi!: (value: any) => void;
    const apiPromise = new Promise(r => { resolveApi = r; });

    const ConsumerA = () => {
      const {handleEvent} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
      }, []);

      return <span data-testid="consumer-a">A</span>;
    };

    const ConsumerB = () => {
      const {isContentLoading} = useWaveCx();
      return (
        <span data-testid="consumer-b-loading">
          {isContentLoading ? 'loading' : 'ready'}
        </span>
      );
    };

    render(
      <>
        <WaveCxProvider
          organizationCode={'org'}
          recordEvent={async () => {
            await apiPromise;
            return {content: []};
          }}
        >
          <ConsumerA/>
        </WaveCxProvider>
        <WaveCxProvider organizationCode={'org'}>
          <ConsumerB/>
        </WaveCxProvider>
      </>
    );

    await waitFor(() => {
      expect(screen.getByTestId('consumer-b-loading')).toHaveTextContent('loading');
    });

    resolveApi(undefined);

    await waitFor(() => {
      expect(screen.getByTestId('consumer-b-loading')).toHaveTextContent('ready');
    });
  });

  it('hasUserTriggeredContent is false when active trigger point has no button-triggered content', async () => {
    const Consumer = () => {
      const {handleEvent, hasUserTriggeredContent} = useWaveCx();

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
              triggerPoint: 'with-content',
            })}
          >With Content</button>

          <button
            onClick={() => handleEvent({
              type: 'trigger-point',
              triggerPoint: 'without-content',
            })}
          >Without Content</button>

          <span data-testid="has-user-triggered">
            {hasUserTriggeredContent ? 'yes' : 'no'}
          </span>
        </>
      );
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => ({
          content: [{
            type: 'featurette',
            presentationType: 'button-triggered',
            triggerPoint: 'with-content',
            viewUrl: 'https://mock.content.com/embed',
          }],
        })}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    // Fire trigger point that has button-triggered content
    screen.getByText('With Content').click();
    await waitFor(() => {
      expect(screen.getByTestId('has-user-triggered')).toHaveTextContent('yes');
    });

    // Fire trigger point that does NOT have button-triggered content
    screen.getByText('Without Content').click();
    await waitFor(() => {
      expect(screen.getByTestId('has-user-triggered')).toHaveTextContent('no');
    });

    // Fire the first trigger point again — should go back to true
    screen.getByText('With Content').click();
    await waitFor(() => {
      expect(screen.getByTestId('has-user-triggered')).toHaveTextContent('yes');
    });
  });

  it('sets isContentLoading to true during session start and false after', async () => {
    let resolveApi!: (value: any) => void;
    const apiPromise = new Promise(r => { resolveApi = r; });

    const Consumer = () => {
      const {handleEvent, isContentLoading} = useWaveCx();

      useEffect(() => {
        handleEvent({
          type: 'session-started',
          userId: 'test-id',
        });
      }, [handleEvent]);

      return (
        <input
          type="checkbox"
          data-testid="is-loading"
          checked={isContentLoading}
          readOnly
        />
      );
    };

    render(
      <WaveCxProvider
        organizationCode={'org'}
        recordEvent={async () => {
          await apiPromise;
          return {content: []};
        }}
      >
        <Consumer/>
      </WaveCxProvider>
    );

    // Should be loading while API hasn't resolved
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).toBeChecked();
    });

    // Resolve the API call
    resolveApi(undefined);

    // Should finish loading
    await waitFor(() => {
      expect(screen.getByTestId('is-loading')).not.toBeChecked();
    });
  });
});