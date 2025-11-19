import type { TargetedContent } from '@wavecx/wavecx-react';
import { TRIGGER_POINTS } from './constants';

// Helper function to convert string to base64, handling UTF-8 characters (like emojis)
const toBase64 = (str: string): string => {
  const utf8Bytes = new TextEncoder().encode(str);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binaryString);
};

// Helper function to create base64 encoded HTML
const createMockHtml = (title: string, message: string, color: string) => {
  const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            background: linear-gradient(135deg, ${color} 0%, #667eea 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 40px 20px;
            color: white;
        }
        .container {
            text-align: center;
            max-width: 500px;
        }
        h1 {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 24px;
            text-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }
        p {
            font-size: 18px;
            line-height: 1.6;
            opacity: 0.95;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>${title}</h1>
        <p>${message}</p>
    </div>
</body>
</html>`;
  return `data:text/html;base64,${toBase64(html)}`;
};

/**
 * Custom mock content for the showcase app.
 * These provide more detailed/styled content than the default generateMockContent() helper.
 */
export const customMockContent: Record<string, TargetedContent[]> = {
  [TRIGGER_POINTS['account-dashboard'].code]: [
    {
      triggerPoint: TRIGGER_POINTS['account-dashboard'].code,
      type: 'featurette',
      presentationType: 'button-triggered',
      viewUrl: createMockHtml(
        '📊 Account Dashboard',
        'View your account summary, recent transactions, and personalized financial insights.',
        '#007AFF'
      ),
      webModal: {
        opacity: 1,
        backdropFilterCss: 'blur(10px)',
        shadowCss: '0 10px 40px rgba(0, 0, 0, 0.3)',
        borderCss: 'none',
        borderRadiusCss: '16px',
        heightCss: '500px',
        widthCss: '600px',
        marginCss: 'auto',
        closeButton: { style: 'text', label: 'Close' },
      },
    },
  ],
  [TRIGGER_POINTS['low-balance-alert'].code]: [
    {
      triggerPoint: TRIGGER_POINTS['low-balance-alert'].code,
      type: 'featurette',
      presentationType: 'popup',
      viewUrl: createMockHtml(
        '⚠️ Low Balance Alert',
        'Your checking account balance is below $500. Consider transferring funds from your savings account.',
        '#FF9500'
      ),
      webModal: {
        opacity: 1,
        backdropFilterCss: 'blur(10px)',
        shadowCss: '0 10px 40px rgba(0, 0, 0, 0.3)',
        borderCss: 'none',
        borderRadiusCss: '16px',
        heightCss: '400px',
        widthCss: '500px',
        marginCss: 'auto',
        closeButton: { style: 'text', label: 'Close' },
      },
    },
  ],
  [TRIGGER_POINTS['savings-promotion'].code]: [
    {
      triggerPoint: TRIGGER_POINTS['savings-promotion'].code,
      type: 'featurette',
      presentationType: 'popup',
      viewUrl: createMockHtml(
        '💰 Special Savings Offer',
        'Earn 4.5% APY on your savings! Open a new high-yield savings account today and watch your money grow.',
        '#34C759'
      ),
      webModal: {
        opacity: 1,
        backdropFilterCss: 'blur(10px)',
        shadowCss: '0 10px 40px rgba(0, 0, 0, 0.3)',
        borderCss: 'none',
        borderRadiusCss: '16px',
        heightCss: '400px',
        widthCss: '500px',
        marginCss: 'auto',
        closeButton: { style: 'text', label: 'Close' },
      },
    },
  ],
  [TRIGGER_POINTS['credit-card-offer'].code]: [
    {
      triggerPoint: TRIGGER_POINTS['credit-card-offer'].code,
      type: 'featurette',
      presentationType: 'popup',
      viewUrl: createMockHtml(
        '💳 Premium Credit Card',
        'You\'re pre-approved! Get 0% intro APR for 12 months plus 2% cash back on all purchases.',
        '#AF52DE'
      ),
      webModal: {
        opacity: 1,
        backdropFilterCss: 'blur(10px)',
        shadowCss: '0 10px 40px rgba(0, 0, 0, 0.3)',
        borderCss: 'none',
        borderRadiusCss: '16px',
        heightCss: '400px',
        widthCss: '500px',
        marginCss: 'auto',
        closeButton: { style: 'text', label: 'Close' },
      },
    },
  ],
  [TRIGGER_POINTS['investment-promotion'].code]: [
    {
      triggerPoint: TRIGGER_POINTS['investment-promotion'].code,
      type: 'featurette',
      presentationType: 'popup',
      viewUrl: createMockHtml(
        '📈 Investment Opportunity',
        'Start investing today and receive a $200 bonus when you open a new investment account with a minimum deposit of $1,000.',
        '#5856D6'
      ),
      webModal: {
        opacity: 1,
        backdropFilterCss: 'blur(10px)',
        shadowCss: '0 10px 40px rgba(0, 0, 0, 0.3)',
        borderCss: 'none',
        borderRadiusCss: '16px',
        heightCss: '400px',
        widthCss: '500px',
        marginCss: 'auto',
        closeButton: { style: 'text', label: 'Close' },
      },
    },
  ],
};
