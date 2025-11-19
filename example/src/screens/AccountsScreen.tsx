import { useEffect } from 'react';
import { useWaveCx } from '@wavecx/wavecx-react';
import { TRIGGER_POINTS } from '../constants';
import type { DemoUser } from '../types';

type AccountsScreenProps = {
  user: DemoUser;
};

export const AccountsScreen = ({ user }: AccountsScreenProps) => {
  const { handleEvent, hasContent } = useWaveCx();
  const totalBalance = user.balance.checking + user.balance.savings;

  useEffect(() => {
    // Auto-trigger dashboard on view load
    handleEvent({
      type: 'trigger-point',
      triggerPoint: TRIGGER_POINTS['account-dashboard'].code,
    });
  }, [handleEvent]);

  // Check if there's button-triggered content available for the dashboard
  const hasDashboardContent = hasContent(TRIGGER_POINTS['account-dashboard'].code, 'button-triggered');

  const allTriggerButtons = [
    TRIGGER_POINTS['low-balance-alert'],
    TRIGGER_POINTS['savings-promotion'],
    TRIGGER_POINTS['credit-card-offer'],
  ];

  // Filter to only show buttons with available popup content
  const triggerButtons = allTriggerButtons.filter(trigger =>
    hasContent(trigger.code, 'popup')
  );

  return (
    <div className="screen-content">
      <div className="screen-header">
        <h1>Accounts</h1>
        {hasDashboardContent && (
          <button
            className="user-triggered-button"
            onClick={() => handleEvent({ type: 'user-triggered-content', triggerPoint: TRIGGER_POINTS['account-dashboard'].code })}
          >
            📌 Content
          </button>
        )}
      </div>

      <div className="balance-card">
        <div className="balance-label">Total Balance</div>
        <div className="balance-amount">
          ${totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="balance-details">
          <div className="balance-item">
            <span className="balance-type">Checking</span>
            <span className="balance-value">
              ${user.balance.checking.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
          <div className="balance-item">
            <span className="balance-type">Savings</span>
            <span className="balance-value">
              ${user.balance.savings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="section">
        <h2>Alerts & Notifications</h2>
        {triggerButtons.length > 0 ? (
          <div className="trigger-buttons">
            {triggerButtons.map(trigger => (
              <button
                key={trigger.code}
                className="trigger-button"
                onClick={() => handleEvent({ type: 'trigger-point', triggerPoint: trigger.code })}
                style={{ borderColor: trigger.color }}
              >
                <span className="trigger-icon">{trigger.icon}</span>
                <span className="trigger-label">{trigger.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📭</div>
            <div className="empty-state-text">No content available</div>
          </div>
        )}
      </div>

      <div className="info-box">
        <p>
          <strong>💡 Smart Notifications</strong><br />
          Tap buttons above to trigger targeted content based on your account activity.
        </p>
      </div>
    </div>
  );
};
