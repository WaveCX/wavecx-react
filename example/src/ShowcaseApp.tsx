import { LoginScreen } from './screens/LoginScreen';
import { AccountsScreen } from './screens/AccountsScreen';
import { ServicesScreen } from './screens/ServicesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { useShowcaseState } from './useShowcaseState';
import type { Screen } from './types';

export const ShowcaseApp = () => {
  const {
    currentUser,
    currentScreen,
    setCurrentScreen,
    analyticsEvents,
    debugMode,
    setDebugMode,
    startSession,
    endSession,
    clearAnalytics,
  } = useShowcaseState();

  if (!currentUser) {
    return <LoginScreen onLogin={startSession} />;
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'accounts':
        return <AccountsScreen user={currentUser} />;
      case 'services':
        return <ServicesScreen />;
      case 'settings':
        return (
          <SettingsScreen
            user={currentUser}
            debugMode={debugMode}
            onDebugModeChange={setDebugMode}
            analyticsEvents={analyticsEvents}
            onClearAnalytics={clearAnalytics}
            onSignOut={endSession}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="showcase-app">
      <div className="app-content">{renderScreen()}</div>

      <nav className="tab-bar">
        <TabButton
          screen="accounts"
          currentScreen={currentScreen}
          onClick={() => setCurrentScreen('accounts')}
          icon="💳"
          label="Accounts"
        />
        <TabButton
          screen="services"
          currentScreen={currentScreen}
          onClick={() => setCurrentScreen('services')}
          icon="🏦"
          label="Services"
        />
        <TabButton
          screen="settings"
          currentScreen={currentScreen}
          onClick={() => setCurrentScreen('settings')}
          icon="⚙️"
          label="More"
        />
      </nav>
    </div>
  );
};

type TabButtonProps = {
  screen: Screen;
  currentScreen: Screen;
  onClick: () => void;
  icon: string;
  label: string;
};

const TabButton = ({ screen, currentScreen, onClick, icon, label }: TabButtonProps) => (
  <button
    className={`tab-button ${currentScreen === screen ? 'active' : ''}`}
    onClick={onClick}
  >
    <span className="tab-icon">{icon}</span>
    <span className="tab-label">{label}</span>
  </button>
);
