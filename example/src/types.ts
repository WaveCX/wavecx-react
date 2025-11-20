export type DemoUser = {
  id: string;
  name: string;
  type: 'Premium Member' | 'New Customer' | 'Business Account';
  balance: {
    checking: number;
    savings: number;
  };
};

export type AnalyticsEvent = {
  id: string;
  type: string;
  timestamp: Date;
  details?: Record<string, any>;
};

export type TriggerPointConfig = {
  code: string;
  label: string;
  icon: string;
  color: string;
};

export type Screen = 'login' | 'accounts' | 'services' | 'settings';
