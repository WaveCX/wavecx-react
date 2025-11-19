import { TargetedContent } from './targeted-content';

export type MockModeConfig = {
  enabled: boolean;
  networkDelay?: number; // milliseconds
  customContent?: Record<string, TargetedContent[]>;
};

export const defaultMockModeConfig: MockModeConfig = {
  enabled: false,
};

/**
 * Converts a string to base64, handling UTF-8 characters properly
 */
function toBase64(str: string): string {
  // Encode to UTF-8 bytes, then to base64
  // This handles emoji and other non-Latin1 characters
  const utf8Bytes = new TextEncoder().encode(str);
  const binaryString = Array.from(utf8Bytes, byte => String.fromCharCode(byte)).join('');
  return btoa(binaryString);
}

/**
 * Generates default mock HTML content for a trigger point
 */
function generateMockHtml(triggerPoint: string, presentationType: 'popup' | 'button-triggered'): string {
  const typeIcon = presentationType === 'popup' ? '⚡' : '🔘';
  const typeLabel = presentationType === 'popup' ? 'Automatic Popup' : 'Button-Triggered';
  const gradientColors = presentationType === 'popup'
    ? ['#667eea', '#764ba2'] // Purple gradient for popup
    : ['#f093fb', '#f5576c']; // Pink gradient for button-triggered

  return `<!DOCTYPE html>
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
            background: linear-gradient(135deg, ${gradientColors[0]} 0%, ${gradientColors[1]} 100%);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            padding: 20px;
        }

        .container {
            text-align: center;
            color: white;
            max-width: 500px;
        }

        h1 {
            font-size: 32px;
            font-weight: 700;
            margin-bottom: 16px;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .trigger-point {
            font-size: 18px;
            font-weight: 600;
            background: rgba(255, 255, 255, 0.2);
            padding: 12px 24px;
            border-radius: 24px;
            margin: 16px auto;
            display: inline-block;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
        }

        .type-indicator {
            font-size: 16px;
            font-weight: 500;
            margin: 20px 0;
            opacity: 0.95;
        }

        .subtitle {
            font-size: 14px;
            opacity: 0.9;
            margin-top: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎭 WaveCX Mock Mode</h1>
        <div class="trigger-point">${triggerPoint}</div>
        <div class="type-indicator">${typeIcon} ${typeLabel}</div>
        <div class="subtitle">Simulated content for testing</div>
    </div>
</body>
</html>`;
}

/**
 * Generates default mock content for a trigger point
 */
function generateDefaultMockContent(triggerPoint: string): TargetedContent[] {
  const closeButton = { style: 'text' as const, label: 'Close' };
  const webModal = {
    opacity: 1,
    backdropFilterCss: 'blur(10px)',
    shadowCss: '0 10px 40px rgba(0, 0, 0, 0.3)',
    borderCss: 'none',
    borderRadiusCss: '16px',
    heightCss: '80vh',
    widthCss: '90vw',
    marginCss: 'auto',
    closeButton,
  };

  return [
    // Popup content (auto-display)
    {
      triggerPoint,
      type: 'featurette',
      presentationType: 'popup',
      viewUrl: `data:text/html;base64,${toBase64(generateMockHtml(triggerPoint, 'popup'))}`,
      webModal,
      loading: {
        color: '#667eea',
        size: '40px',
        message: 'Loading mock content...',
      },
    },
    // Button-triggered content
    {
      triggerPoint,
      type: 'featurette',
      presentationType: 'button-triggered',
      viewUrl: `data:text/html;base64,${toBase64(generateMockHtml(triggerPoint, 'button-triggered'))}`,
      webModal,
      loading: {
        color: '#f093fb',
        size: '40px',
        message: 'Loading mock content...',
      },
    },
  ];
}

/**
 * Gets initial mock content based on config
 */
export function getInitialMockContent(config: MockModeConfig): TargetedContent[] {
  if (!config.enabled) {
    return [];
  }

  // If custom content provided, use it
  if (config.customContent) {
    return Object.values(config.customContent).flat();
  }

  return [];
}

type TriggerPointSpec =
  | string
  | { triggerPoint: string; presentationType?: 'popup' | 'button-triggered' };

/**
 * Generates mock content for multiple trigger points.
 *
 * Use this helper to quickly create mock content for testing your integration.
 *
 * @param triggerPoints - Array of trigger point codes, or objects specifying trigger point and presentation type
 * @returns Dictionary mapping trigger point codes to mock content arrays
 *
 * @example
 * ```typescript
 * // Generate mock content for all presentation types
 * generateMockContent(['home', 'checkout', 'profile'])
 *
 * // Generate only popup content
 * generateMockContent([
 *   { triggerPoint: 'home', presentationType: 'popup' },
 *   { triggerPoint: 'checkout', presentationType: 'popup' }
 * ])
 *
 * // Mix presentation types
 * generateMockContent([
 *   'home', // generates both popup and button-triggered
 *   { triggerPoint: 'checkout', presentationType: 'popup' }, // only popup
 *   { triggerPoint: 'profile', presentationType: 'button-triggered' } // only button-triggered
 * ])
 * ```
 */
export function generateMockContent(
  triggerPoints: TriggerPointSpec[]
): Record<string, TargetedContent[]> {
  const result: Record<string, TargetedContent[]> = {};

  for (const spec of triggerPoints) {
    const triggerPoint = typeof spec === 'string' ? spec : spec.triggerPoint;
    const presentationType = typeof spec === 'string' ? undefined : spec.presentationType;

    const allContent = generateDefaultMockContent(triggerPoint);

    // Filter by presentation type if specified
    const content = presentationType
      ? allContent.filter(c => c.presentationType === presentationType)
      : allContent;

    result[triggerPoint] = content;
  }

  return result;
}

/**
 * Simulates network delay if configured
 */
export function simulateNetworkDelay(config: MockModeConfig): Promise<void> {
  if (!config.enabled || !config.networkDelay) {
    return Promise.resolve();
  }

  return new Promise(resolve => setTimeout(resolve, config.networkDelay));
}
