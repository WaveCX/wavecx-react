import {useEffect, useState} from 'react';

import {useWaveCx} from '@wavecx/wavecx-react';

import './app.css';

type View = 'sign-in' | 'trigger-one' | 'trigger-two' | 'trigger-three';

const triggerCodeForView = (view: View) =>
  view === 'trigger-one' ? import.meta.env.VITE_TRIGGER_ONE ?? 'account-view' :
  view === 'trigger-two' ? import.meta.env.VITE_TRIGGER_TWO ?? 'financial-wellness' :
  view === 'trigger-three' ? import.meta.env.VITE_TRIGGER_THREE ?? 'payments' : undefined;

export const App = () => {
  const {handleEvent} = useWaveCx();

  const [view, setView] = useState<View>('sign-in');
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [userIdInput, setUserIdInput] = useState('');

  useEffect(() => {
    if (userId) {
      handleEvent({
        type: 'session-started',
        userId,
      });
      setView('trigger-one');
    } else {
      handleEvent({type: 'session-ended'});
      setUserIdInput('');
    }
  }, [userId]);

  useEffect(() => {
    handleEvent({
      type: 'trigger-point',
      triggerPoint: triggerCodeForView(view),
    });
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
              Account View
            </button>
          </li>
          <li aria-current={view === 'trigger-two' ? 'page' : undefined}>
            <button onClick={() => setView('trigger-two')}>
              Financial Wellness
            </button>
          </li>
          <li aria-current={view === 'trigger-three' ? 'page' : undefined}>
            <button onClick={() => setView('trigger-three')}>
              Payments
            </button>
          </li>
          <li>
            <button onClick={() => setUserId(undefined)}>Sign Out</button>
          </li>
        </ul>
      </>
    );
  }
};
