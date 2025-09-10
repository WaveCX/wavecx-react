import {useEffect, useState} from 'react';

import {useWaveCx} from '@wavecx/wavecx-react';

import {createUserIdVerification} from './user-id-verification';
import './app.css';

type View = 'sign-in' | 'trigger-one' | 'trigger-two' | 'trigger-three';

const triggerCodeForView = (view: View) =>
  view === 'trigger-one' ? import.meta.env.VITE_TRIGGER_ONE ?? 'account-view' :
  view === 'trigger-two' ? import.meta.env.VITE_TRIGGER_TWO ?? 'financial-wellness' :
  view === 'trigger-three' ? import.meta.env.VITE_TRIGGER_THREE ?? 'payments' : undefined;

const labelForView = (view: View) =>
  view === 'trigger-one' ? 'Account View' :
  view === 'trigger-two' ? 'Financial Wellness' :
  view === 'trigger-three' ? 'Payments' : '';

export const App = (props: {initialUserId?: string}) => {
  const {handleEvent, hasUserTriggeredContent} = useWaveCx();

  const [view, setView] = useState<View>('sign-in');
  const [userId, setUserId] = useState<string | undefined>(props.initialUserId);
  const [userIdInput, setUserIdInput] = useState('');

  useEffect(() => {
    if (userId) {
      sessionStorage.setItem('userId', userId);
      handleEvent({
        type: 'session-started',
        userId,
        userIdVerification: createUserIdVerification(userId),
        userAttributes: {
          creditScore: 800,
        },
      });
      setView('trigger-one');
    }
  }, [userId]);

  useEffect(() => {
    if (triggerCodeForView(view)) {
      handleEvent({
        type: 'trigger-point',
        triggerPoint: triggerCodeForView(view),
      });
    }
  }, [view]);

  if (!userId) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (userIdInput.trim().length > 0) {
            setUserId(userIdInput);
          }
        }}
      >
        <h1>WaveCX Example</h1>
        <input
          type={'text'}
          placeholder={'User ID'}
          autoFocus={true}
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
        />
        <br/>
        <br/>
        <button type={'submit'}>Sign In</button>
      </form>
    );
  } else {
    return (
      <>
        <h1>WaveCX Example</h1>
        <p>Signed in as {userId}</p>
        <ul className={'nav'}>
          <li aria-current={view === 'trigger-one' ? 'page' : undefined}>
            <button onClick={() => setView('trigger-one')}>
              {labelForView('trigger-one')}
            </button>
          </li>
          <li aria-current={view === 'trigger-two' ? 'page' : undefined}>
            <button onClick={() => setView('trigger-two')}>
              {labelForView('trigger-two')}
            </button>
          </li>
          <li aria-current={view === 'trigger-three' ? 'page' : undefined}>
            <button onClick={() => setView('trigger-three')}>
              {labelForView('trigger-three')}
            </button>
          </li>
          <li>
            <button
              onClick={() => {
                setUserId(undefined);
                setUserIdInput('');
                setView('sign-in');
                handleEvent({type: 'session-ended'});
                sessionStorage.removeItem('userId');
              }}
            >Sign Out</button>
          </li>
        </ul>

        {hasUserTriggeredContent && (
          <p>
            User-triggered content available:
            <button onClick={() => handleEvent({ type: 'user-triggered-content' })}>
              Show Content
            </button>
          </p>
        )}

        <div style={{height: '150vh', padding: 20, backgroundColor: 'lightgray'}}>
          <h1>{labelForView(view)}</h1>
          <p>This is the {labelForView(view)} page.</p>
        </div>
      </>
    );
  }
};
