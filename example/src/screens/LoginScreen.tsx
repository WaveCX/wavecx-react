import { useState } from 'react';
import { DEMO_USERS } from '../constants';
import type { DemoUser } from '../types';

type LoginScreenProps = {
  onLogin: (user: DemoUser) => void;
};

export const LoginScreen = ({ onLogin }: LoginScreenProps) => {
  const [customUserId, setCustomUserId] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleDemoUserLogin = async (user: DemoUser) => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300)); // Brief loading state
    onLogin(user);
    setIsLoading(false);
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customUserId.trim()) return;

    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 300));

    const customUser: DemoUser = {
      id: customUserId.trim(),
      name: customUserId.trim(),
      type: 'New Customer',
      balance: { checking: 0, savings: 0 },
    };

    onLogin(customUser);
    setIsLoading(false);
  };

  return (
    <div className="login-screen">
      <div className="login-container">
        <div className="login-header">
          <div className="bank-icon">🏦</div>
          <h1>WaveBank</h1>
          <p className="subtitle">Showcase Demo</p>
        </div>

        <div className="login-section">
          <h2>Quick Login</h2>
          <div className="demo-users">
            {DEMO_USERS.map(user => (
              <button
                key={user.id}
                className="demo-user-button"
                onClick={() => handleDemoUserLogin(user)}
                disabled={isLoading}
              >
                <div className="user-avatar">{user.name.charAt(0)}</div>
                <div className="user-info">
                  <div className="user-name">{user.name}</div>
                  <div className="user-type">{user.type}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="login-divider">
          <span>or</span>
        </div>

        <div className="login-section">
          <h2>Custom Login</h2>
          <form onSubmit={handleCustomLogin}>
            <input
              type="text"
              placeholder="Enter User ID"
              value={customUserId}
              onChange={(e) => setCustomUserId(e.target.value)}
              disabled={isLoading}
              className="custom-user-input"
            />
            <button
              type="submit"
              className="login-button"
              disabled={isLoading || !customUserId.trim()}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        </div>

        <div className="login-footer">
          <p>This is a demonstration app showcasing WaveCX SDK features</p>
        </div>
      </div>
    </div>
  );
};
