import ReactDOM from 'react-dom/client'

import { WaveCxProvider } from '@wavecx/wavecx-react';

import {App} from './app';

const organizationCode = import.meta.env.VITE_ORGANIZATION_CODE;
const apiUrl = import.meta.env.VITE_API_URL;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <WaveCxProvider
    organizationCode={organizationCode}
    apiBaseUrl={apiUrl}
    debugMode={true}
  >
    <App
      initialUserId={sessionStorage.getItem('userId') ?? undefined}
    />
  </WaveCxProvider>
);
