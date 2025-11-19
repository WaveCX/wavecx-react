import { useState } from 'react';
import type { DemoUser, AnalyticsEvent } from '../types';

type SettingsScreenProps = {
  user: DemoUser;
  debugMode: boolean;
  onDebugModeChange: (enabled: boolean) => void;
  analyticsEvents: AnalyticsEvent[];
  onClearAnalytics: () => void;
  onSignOut: () => void;
};

export const SettingsScreen = ({
  user,
  debugMode,
  onDebugModeChange,
  analyticsEvents,
  onClearAnalytics,
  onSignOut,
}: SettingsScreenProps) => {
  const [showAnalytics, setShowAnalytics] = useState(false);

  const memberSince = new Date().toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="screen-content">
      <div className="screen-header">
        <h1>More</h1>
      </div>

      <div className="settings-section">
        <h2>Profile</h2>
        <div className="profile-card">
          <div className="profile-avatar">{user.name.charAt(0)}</div>
          <div className="profile-info">
            <div className="profile-name">{user.name}</div>
            <div className="profile-id">{user.id}</div>
            <div className="profile-meta">Member since {memberSince}</div>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Account Settings</h2>
        <div className="settings-list">
          <button className="settings-item">
            <span>🔒 Security & Privacy</span>
            <span className="chevron">›</span>
          </button>
          <button className="settings-item">
            <span>🔔 Notifications</span>
            <span className="chevron">›</span>
          </button>
          <button className="settings-item">
            <span>🔗 Linked Accounts</span>
            <span className="chevron">›</span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2>SDK Configuration</h2>
        <div className="settings-list">
          <div className="settings-item toggle-item">
            <span>Debug Mode</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={debugMode}
                onChange={(e) => onDebugModeChange(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
          <div className="settings-item info-item">
            <span>Organization</span>
            <span className="info-value">demo-org</span>
          </div>
        </div>
      </div>

      <div className="settings-section">
        <h2>Analytics & Events</h2>
        <div className="settings-list">
          <button
            className="settings-item"
            onClick={() => setShowAnalytics(true)}
          >
            <span>📊 Event Log</span>
            <span className="badge">{analyticsEvents.length}</span>
          </button>
          <button
            className="settings-item"
            onClick={onClearAnalytics}
            disabled={analyticsEvents.length === 0}
          >
            <span>🗑️ Clear Event Log</span>
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2>Banking Services</h2>
        <div className="settings-list">
          <button className="settings-item">
            <span>📄 Statements & Documents</span>
            <span className="chevron">›</span>
          </button>
          <button className="settings-item">
            <span>💸 Bill Pay</span>
            <span className="chevron">›</span>
          </button>
          <button className="settings-item">
            <span>📍 ATM & Branch Locations</span>
            <span className="chevron">›</span>
          </button>
        </div>
      </div>

      <button className="sign-out-button" onClick={onSignOut}>
        Sign Out
      </button>

      {showAnalytics && (
        <div className="modal-overlay" onClick={() => setShowAnalytics(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Event Log</h2>
              <button
                className="modal-close"
                onClick={() => setShowAnalytics(false)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              {analyticsEvents.length === 0 ? (
                <div className="empty-state">
                  <p>No events recorded yet</p>
                </div>
              ) : (
                <div className="events-list">
                  {analyticsEvents.map(event => (
                    <div key={event.id} className="event-item">
                      <div className="event-header">
                        <span className="event-type">{event.type}</span>
                        <span className="event-time">
                          {event.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                      {event.details && (
                        <div className="event-details">
                          {Object.entries(event.details).map(([key, value]) => (
                            <div key={key} className="event-detail">
                              <span className="detail-key">{key}:</span>
                              <span className="detail-value">
                                {typeof value === 'object'
                                  ? JSON.stringify(value)
                                  : String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
