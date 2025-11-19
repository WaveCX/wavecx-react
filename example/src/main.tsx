import React from 'react';
import ReactDOM from 'react-dom/client';
import { WaveCxProvider, generateMockContent } from '@wavecx/wavecx-react';
import { ShowcaseApp } from './ShowcaseApp';
import { TRIGGER_POINTS } from './constants';
import './showcase.css';

// @ts-ignore -- we want this unused import so it can easily be used below
import { customMockContent } from './mockContent';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WaveCxProvider
      organizationCode={'demos'}
      debugMode={true}
      mockModeConfig={{
        enabled: true,
        networkDelay: 500,
        customContent: {
          ...generateMockContent([
            TRIGGER_POINTS['account-dashboard'].code, // will create popup and button-triggered mock content
            { triggerPoint: TRIGGER_POINTS['low-balance-alert'].code, presentationType: 'popup' },
            { triggerPoint: TRIGGER_POINTS['savings-promotion'].code, presentationType: 'popup' },
            { triggerPoint: TRIGGER_POINTS['credit-card-offer'].code, presentationType: 'popup' },
            { triggerPoint: TRIGGER_POINTS['investment-promotion'].code, presentationType: 'popup' },
            { triggerPoint: TRIGGER_POINTS['banking-services'].code, presentationType: 'popup' },
          ]),
          // Can also provide custom content for specific trigger points -- see mockContent.ts
          // ...customMockContent,
        },
      }}
    >
      <ShowcaseApp />
    </WaveCxProvider>
  </React.StrictMode>
);
