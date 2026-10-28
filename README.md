# wavecx-react
Add WaveCX to your React application.

## Installation
`npm i @wavecx/wavecx-react`

## Quickstart
1. Import the WaveCX provider with `import { WaveCxProvider } from '@wavecx/wavecx-react';`
2. Wrap your application or component subtree where WaveCX is used in `WaveCxProvider` and provide your organization code.
3. Import WaveCX styles with `import '@wavecx/wavecx-react/styles.css';`.
4. In your inner components `import { useWaveCx } from '@wavecx/wavecx-react';`
5. Use `const {handleEvent} = useWaveCx()` to access the WaveCX context and raise events.

### Example
```tsx
import * as React from 'react';
import { useEffect } from 'react';
import { HmacSHA256 } from 'crypto-js';

import { WaveCxProvider, useWaveCx } from '@wavecx/wavecx-react';
import '@wavecx/wavecx-react/styles.css';

export const App = () => (
  <WaveCxProvider organizationCode={'your-org-code'}>
    <Main />
  </WaveCxProvider>
);

const Main = () => {
  const { handleEvent } = useWaveCx();

  useEffect(() => {
    handleEvent({
      type: 'session-started',
      userId: 'user-id',
      userIdVerification: createUserIdVerification('user-id'),
      userAttributes: {
        creditScore: 800,
      },
    });
  }, []);

  return (
    <button
      title={'Trigger Point'}
      onClick={() => {
        handleEvent({
          type: 'trigger-point',
          triggerPoint: 'trigger-point-code',
        });
      }}
    />
  );
};

// WARNING: User ID verification should NOT be performed on client.
// This is here only for brevity of example.
const createUserIdVerification = (userId: string) =>
  HmacSHA256(userId, 'your-signing-secret').toString()
```

## Usage
WaveCX follows an event-driven architecture, only needing events
raised as they occur within your application.

### Session Started Events
Because WaveCX content is targeted and tracked per user,
a "session started" event is required upon user authentication.

```ts
handleEvent({
  type: 'session-started',
  userId: 'user-id',
  userIdVerification: createUserIdVerification('user-id'),
  userAttribute: {
    // your user attributes
  },
});
```

#### User ID Verification
The user ID verification parameter is an HMACSHA256 hash of the
provided user ID, signed with a signing secret specific to your
organization. This is used to prevent user ID spoofing and
ensure that requests to WaveCX are from authorized sources.

The signing secret should be stored only in a protected environment
(i.e. a backend service) which your client application can
communicate with in order to retrieve ID verification hashes.

**Never send or store the signing secret to the client application.**

### Trigger Point Events

```ts
handleEvent({
  type: 'trigger-point',
  triggerPoint: 'trigger-point-code',
  onContentDismissed: () => {
    // optional callback when content is closed by user
  }
});
```

A trigger point is an event within your application
that content can be attached to.

When a trigger-point event is raised, WaveCX will check for and
present any content set for that trigger point that is relevant
for the current user.

### Checking for Available Content
The WaveCX context provides a `hasContent()` function to check if content
is available for a specific trigger point and presentation type.

```ts
const { handleEvent, hasContent } = useWaveCx();

// Check if any content is available for a trigger point
const hasAnyContent = hasContent('your-trigger-point');

// Check for specific presentation types
const hasPopup = hasContent('your-trigger-point', 'popup');
const hasButtonContent = hasContent('your-trigger-point', 'button-triggered');

if (hasPopup) {
  // your conditional logic for popup content available
}
```

**Deprecated:** `hasPopupContentForTriggerPoint()` is deprecated. Use `hasContent(triggerPoint, 'popup')` instead.

### User-Triggered Content
You can check for button-triggered content availability and display
a button or UI element to let users access it on demand:

```tsx
const { handleEvent, hasContent } = useWaveCx();

// Check if button-triggered content is available for a specific trigger point
const hasButtonContent = hasContent('your-trigger-point', 'button-triggered');

// in render
{hasButtonContent && (
  <Button
    title={'View Content'}
    onClick={() => handleEvent({
      type: 'user-triggered-content',
      triggerPoint: 'your-trigger-point',
      onContentDismissed: () => {
        // optional callback when content is closed by user
      }
    })}
  />
)}
```

**Deprecated:** `hasUserTriggeredContent` boolean is deprecated. Use `hasContent(triggerPoint, 'button-triggered')` instead.
The old flag only reflected the most recently fired trigger point and didn't indicate which one.

### Content Loading State
The WaveCX context provides an `isContentLoading` flag that indicates when
the SDK is fetching content from the API. This is useful for showing loading
indicators during the initial content fetch:

```tsx
const { handleEvent, isContentLoading, hasContent } = useWaveCx();

// in render
{isContentLoading ? (
  <div className="loading-spinner">Loading content...</div>
) : hasContent('your-trigger-point', 'popup') && (
  <div>Content is available!</div>
)}
```

The loading state is automatically set to `true` when a session starts and
remains `true` until the content fetch completes.

### Session Ended Events
If trigger points may still be reached in your application
after the user is no longer authenticated, a session ended
event must be raised to notify WaveCX that trigger points
should no longer be handled for a previously identified user.

```ts
handleEvent({ type: 'session-ended' });
```

### useWaveCx Hook
The `useWaveCx()` hook provides access to the WaveCX context and returns the following:

| Property | Type | Description |
|----------|------|-------------|
| `handleEvent` | `EventHandler` | Function to raise WaveCX events (session-started, trigger-point, etc.) |
| `hasContent` | `(triggerPoint: string, presentationType?: 'popup' \| 'button-triggered') => boolean` | Check if content is available for a trigger point, optionally filtered by presentation type |
| `isContentLoading` | `boolean` | Indicates if the SDK is currently loading content from the API |
| `hasPopupContentForTriggerPoint` | `(triggerPoint: string) => boolean` | **DEPRECATED** - Use `hasContent(triggerPoint, 'popup')` instead |
| `hasUserTriggeredContent` | `boolean` | **DEPRECATED** - Use `hasContent(triggerPoint, 'button-triggered')` instead |

## API

### WaveCxProvider
`WaveCxProvider` provides a context for WaveCX events to be raised.
`WaveCxProvider` should be placed as high as possible in the
application tree.
#### Props
| name                 | type                                | description                                                                                                                     | required | default                                                         |
|----------------------|-------------------------------------|---------------------------------------------------------------------------------------------------------------------------------|----------|-----------------------------------------------------------------|
| organizationCode     | string                              | code identifying your organization in WaveCX (i.e. the "slug" of your API URL -- "your-org" in https://api.wavecx.com/your-org) | true     |                                                                 |
| apiBaseUrl           | string                              | base URL which API calls are made to                                                                                            | false    | https://api.wavecx.com                                          |
| recordEvent          | function (FireTargetedContentEvent) | function to record a raised event, returning relevant content                                                                   | false    | fireTargetedContentEventViaApi (makes real calls to WaveCX API) |
| disablePopupContent  | boolean                             | disables pop-up content; only user-triggered content will be presented                                                          | false    | false                                                           |
| contentFetchStrategy | ContentFetchStrategy                | **DEPRECATED** - no longer has any effect; content is always fetched at session start                                           | false    | session-start                                                   |
| debugMode            | boolean                             | enables debug logging to console for troubleshooting                                                                            | false    | false                                                           |
| retryConfig          | RetryConfig                         | configures retry behavior for API calls (maxAttempts, delays)                                                                   | false    | `{maxAttempts: 3, initialDelay: 1000, maxDelay: 32000, multiplier: 2.0}` |
| requestTimeoutMs     | number                              | time limit for each API request attempt, in milliseconds; timed out attempts are retried; not used with a custom `recordEvent`   | false    | 10000                                                           |
| mockModeConfig       | MockModeConfig                      | enables mock mode for testing without API calls, generating simulated content                                                   | false    | `{enabled: false}`                                              |
| onError              | function (ErrorHandler)             | called when starting a session or fetching content fails, after retries are exhausted; see [Error Handling](#error-handling)     | false    |                                                                 |

#### Types
```ts
type TargetedContent = {
  triggerPoint: string;
  type: 'featurette';
  presentationType: 'popup' | 'button-triggered';
  viewUrl: string;
};

type FireTargetedContentEvent = (options: {
  type: 'session-started' | 'trigger-point';
  triggerPoint?: string;
  organizationCode: string;
  userId: string;
  userIdVerification?: string;
  userAttributes?: object;
}) => Promise<{ content: TargetedContent[] }>;

type ContentFetchStrategy =
  | 'session-start'
  | 'trigger-point';

type RetryConfig = {
  maxAttempts: number;      // Number of retry attempts (default: 3)
  initialDelay: number;     // Initial delay in milliseconds (default: 1000)
  maxDelay: number;         // Maximum delay cap in milliseconds (default: 32000)
  multiplier: number;       // Exponential backoff multiplier (default: 2.0)
};

type MockModeConfig = {
  enabled: boolean;                            // Enable/disable mock mode (default: false)
  networkDelay?: number;                       // Simulate network latency in milliseconds
  contentStrategy?: MockContentStrategy;       // Which trigger points get content
  customContent?: Record<string, TargetedContent[]>;  // Custom content per trigger point
};

type MockContentStrategy =
  | { type: 'all-trigger-points' }             // Generate content for any trigger point
  | { type: 'specific-trigger-points'; triggerPoints: string[] };  // Only specific points

type ErrorHandler = (error: WaveCxError) => void | Promise<void>;

class WaveCxError extends Error {
  type: WaveCxErrorType;
  message: string;
  httpCode?: number;   // HTTP status, for SERVER_ERROR
  cause?: unknown;     // the original error, when this wraps one
}

type WaveCxErrorType =
  | 'NETWORK_UNAVAILABLE'
  | 'NETWORK_TIMEOUT'
  | 'NETWORK_ERROR'
  | 'SERVER_ERROR'
  | 'PARSE_ERROR'
  | 'SSL_ERROR'
  | 'UNKNOWN';
```

### Network Retry
The SDK automatically retries failed API calls using exponential backoff. By default, it will:
- Retry up to 3 times
- Use delays of 1s, 2s, 4s between attempts
- Cap maximum delay at 32 seconds

Each attempt times out after 10 seconds, which you can change with the `requestTimeoutMs` prop. Only failures that might succeed on another attempt
are retried: network failures and timeouts, 5xx responses, and 408 and 429 responses. Other 4xx responses and unparseable responses are
reported straight away.

You can customize this behavior using the `retryConfig` prop:

```tsx
<WaveCxProvider
  organizationCode={'your-org-code'}
  retryConfig={{
    maxAttempts: 5,
    initialDelay: 500,  // 500ms, 1s, 2s, 4s, 8s
    maxDelay: 10000,    // cap at 10 seconds
    multiplier: 2.0,
  }}
>
  <App />
</WaveCxProvider>
```

### Error Handling
Pass an `onError` callback to be notified when the SDK fails to start a session or fetch
content, for example to send failures to your own logging or monitoring:

```tsx
import {WaveCxProvider, type WaveCxError} from '@wavecx/wavecx-react';

const handleWaveCxError = (error: WaveCxError) => {
  logger.error('WaveCX error', {
    type: error.type,
    message: error.message,
    httpCode: error.httpCode,
  });
};

<WaveCxProvider organizationCode={'your-org-code'} onError={handleWaveCxError}>
  <App />
</WaveCxProvider>
```

`onError` is called once per failed session start, after loading has finished and after all
[retries](#network-retry) are exhausted. A custom `recordEvent` is not retried, so its
failures are reported on the first attempt. A session start issued while another is still
loading is skipped and is not reported. The session continues without content, as it does
without an `onError` callback. Errors thrown from `onError`, and rejections from an async
`onError`, are caught and do not affect the SDK.

If the API rejects a stored session token with a 401 or 403, the SDK discards it and starts a
new session. Only a failure of that new session is reported.

Session state is shared by every mounted `WaveCxProvider`, so each failure is reported to the
`onError` of every mounted provider, whichever provider started the session. A handler passed
to more than one provider is called once, as long as it is the same function, rather than a
new inline function on each render.

| type                  | when                                                                                   |
|-----------------------|----------------------------------------------------------------------------------------|
| `NETWORK_UNAVAILABLE` | the request failed while the browser reports being offline                             |
| `NETWORK_ERROR`       | the request failed without a response (DNS, connection, CORS or TLS failure)           |
| `NETWORK_TIMEOUT`     | the request, including reading its response, took longer than `requestTimeoutMs`       |
| `SERVER_ERROR`        | the API responded with a non-2xx status; `httpCode` holds the status (e.g. 400, 404, 500) |
| `PARSE_ERROR`         | the API response was received in full but could not be parsed                          |
| `UNKNOWN`             | any other failure, including errors thrown by a custom `initiateSession` or `recordEvent`; `cause` holds the original error |

The error types match `WaveCxErrorType` in the WaveCX Android SDK, so the same handling can
be shared across platforms. Differences on the web:
- `SSL_ERROR` is never reported. Browsers don't distinguish TLS failures from other network
  failures, so these are reported as `NETWORK_ERROR`.
- Errors are not reported in mock mode, for trigger points, or for content that fails to load
  inside the modal. This matches the mobile SDKs.

A custom `recordEvent` or `initiateSession` can throw a `WaveCxError` itself to control how
its failures are reported.

### Mock Mode
Mock mode allows you to test WaveCX integration without making real API calls. When enabled, the SDK generates simulated content locally for testing purposes.

#### Basic Mock Mode
Enable mock mode to automatically generate content for all trigger points:

```tsx
<WaveCxProvider
  organizationCode={'your-org-code'}
  mockModeConfig={{
    enabled: true,
  }}
>
  <App />
</WaveCxProvider>
```

#### Mock Mode with Network Delay
Simulate network latency for more realistic testing:

```tsx
<WaveCxProvider
  organizationCode={'your-org-code'}
  mockModeConfig={{
    enabled: true,
    networkDelay: 1000,  // 1 second delay
  }}
>
  <App />
</WaveCxProvider>
```

#### Specific Trigger Points Only
Generate content only for specific trigger points:

```tsx
<WaveCxProvider
  organizationCode={'your-org-code'}
  mockModeConfig={{
    enabled: true,
    contentStrategy: {
      type: 'specific-trigger-points',
      triggerPoints: ['home-screen', 'checkout-page'],
    },
  }}
>
  <App />
</WaveCxProvider>
```

#### Custom Mock Content
Provide your own custom content for testing:

```tsx
<WaveCxProvider
  organizationCode={'your-org-code'}
  mockModeConfig={{
    enabled: true,
    customContent: {
      'home-screen': [
        {
          triggerPoint: 'home-screen',
          type: 'featurette',
          presentationType: 'popup',
          viewUrl: 'https://example.com/announcement',
          webModal: {
            opacity: 0.3,
            borderRadiusCss: '16px',
            heightCss: '80vh',
            widthCss: '600px',
            closeButton: { style: 'text', label: 'Close' },
          },
        },
      ],
    },
  }}
>
  <App />
</WaveCxProvider>
```

**Note:** Mock mode generates two content items per trigger point by default:
- **Popup content** (automatic display) with a purple gradient
- **Button-triggered content** (user-initiated) with a pink gradient

## Example Application
An example application is available at https://github.com/WaveCX/wavecx-react/tree/main/example

### Running the Example Application
- Clone this repository
- In the root directory, run `npm install`
- Copy file `./example/.env.local.example` to `./example/.env.local`
- Update `./example/.env.local` with your organizations information
- In the root directory, run `npm run example`
  - Sign in with any User ID to view content