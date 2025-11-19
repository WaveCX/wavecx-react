import { useState, useCallback } from 'react';
import { useWaveCx } from '@wavecx/wavecx-react';
import type { DemoUser, AnalyticsEvent, Screen } from './types';
import {createUserIdVerification} from './user-id-verification.ts';

export const useShowcaseState = () => {
  const { handleEvent } = useWaveCx();

  const [currentUser, setCurrentUser] = useState<DemoUser | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEvent[]>([]);
  const [debugMode, setDebugMode] = useState(true);

  const logEvent = useCallback((type: string, details?: Record<string, any>) => {
    const event: AnalyticsEvent = {
      id: `${Date.now()}-${Math.random()}`,
      type,
      timestamp: new Date(),
      details,
    };
    setAnalyticsEvents(prev => [...prev, event]);

    if (debugMode) {
      console.log(`[WaveCx Analytics] ${type}`, details);
    }
  }, [debugMode]);

  const startSession = useCallback(async (user: DemoUser) => {
    setCurrentUser(user);
    setCurrentScreen('accounts');

    logEvent('Session Started', {
      userId: user.id,
      userType: user.type,
      platform: 'web',
    });

    await handleEvent({
      type: 'session-started',
      userId: user.id,
      userIdVerification: createUserIdVerification(user.id), // In production, this should come from backend
      userAttributes: {
        userType: user.type,
        platform: 'web',
        balance: user.balance.checking + user.balance.savings,
      },
    });
  }, [handleEvent, logEvent]);

  const endSession = useCallback(async () => {
    logEvent('Session Ended', {
      userId: currentUser?.id,
    });

    await handleEvent({ type: 'session-ended' });
    setCurrentUser(null);
    setCurrentScreen('login');
  }, [handleEvent, logEvent, currentUser]);

  const clearAnalytics = useCallback(() => {
    setAnalyticsEvents([]);
    logEvent('Analytics Cleared');
  }, [logEvent]);

  return {
    currentUser,
    currentScreen,
    setCurrentScreen,
    analyticsEvents,
    debugMode,
    setDebugMode,
    startSession,
    endSession,
    clearAnalytics,
  };
};
