import type { DemoUser, TriggerPointConfig } from './types';

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'sarah.johnson',
    name: 'Sarah Johnson',
    type: 'Premium Member',
    balance: {
      checking: 8234.12,
      savings: 4249.40,
    },
  },
  {
    id: 'michael.chen',
    name: 'Michael Chen',
    type: 'New Customer',
    balance: {
      checking: 1523.75,
      savings: 500.00,
    },
  },
  {
    id: 'emily.davis',
    name: 'Emily Davis',
    type: 'Business Account',
    balance: {
      checking: 25789.33,
      savings: 10000.00,
    },
  },
];

export const TRIGGER_POINTS: Record<string, TriggerPointConfig> = {
  'account-dashboard': {
    code: 'account-dashboard',
    label: 'Dashboard Updates',
    icon: '📊',
    color: '#007AFF',
  },
  'low-balance-alert': {
    code: 'low-balance-alert',
    label: 'Low Balance Alert',
    icon: '⚠️',
    color: '#FF9500',
  },
  'savings-promotion': {
    code: 'savings-promotion',
    label: 'Savings Account Promotion',
    icon: '💰',
    color: '#34C759',
  },
  'credit-card-offer': {
    code: 'credit-card-offer',
    label: 'Credit Card Offer',
    icon: '💳',
    color: '#AF52DE',
  },
  'banking-services': {
    code: 'banking-services',
    label: 'Banking Services',
    icon: '🏦',
    color: '#007AFF',
  },
  'investment-promotion': {
    code: 'investment-promotion',
    label: 'Investment Promotion',
    icon: '📈',
    color: '#34C759',
  },
};
