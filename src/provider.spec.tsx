import {useEffect} from 'react';
import {describe, it, expect} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';

import {useWaveCx, WaveCxProvider} from './provider';

describe(WaveCxProvider.name, () => {
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
});