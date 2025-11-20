import { useEffect } from 'react';
import { useWaveCx } from '@wavecx/wavecx-react';
import { TRIGGER_POINTS } from '../constants';

const PRODUCTS = [
  {
    id: 'checking',
    icon: '💵',
    name: 'Premium Checking',
    description: 'No monthly fees',
    color: '#007AFF',
  },
  {
    id: 'savings',
    icon: '💰',
    name: 'High-Yield Savings',
    description: '4.5% APY',
    color: '#34C759',
  },
  {
    id: 'credit',
    icon: '💳',
    name: 'Credit Card',
    description: '0% intro APR',
    color: '#AF52DE',
  },
  {
    id: 'loan',
    icon: '🏠',
    name: 'Personal Loan',
    description: 'From 5.99%',
    color: '#FF9500',
  },
];

export const ServicesScreen = () => {
  const { handleEvent, hasContent } = useWaveCx();

  useEffect(() => {
    // Auto-trigger services on view load
    handleEvent({
      type: 'trigger-point',
      triggerPoint: TRIGGER_POINTS['banking-services'].code,
    });
  }, [handleEvent]);

  const hasInvestmentPromotion = hasContent(TRIGGER_POINTS['investment-promotion'].code, 'popup');

  return (
    <div className="screen-content">
      <div className="screen-header">
        <h1>Banking Products</h1>
      </div>

      <div className="products-grid">
        {PRODUCTS.map(product => (
          <div key={product.id} className="product-card">
            <div
              className="product-icon"
              style={{ backgroundColor: `${product.color}20` }}
            >
              <span style={{ fontSize: '32px' }}>{product.icon}</span>
            </div>
            <div className="product-name">{product.name}</div>
            <div className="product-description">{product.description}</div>
            <button className="product-button">Learn More</button>
          </div>
        ))}
      </div>

      {hasInvestmentPromotion && (
        <div className="section">
          <div className="special-offer-banner">
            <div className="offer-content">
              <div className="offer-title">New Investment Accounts</div>
              <div className="offer-subtitle">$200 bonus when you open an account</div>
            </div>
            <button
              className="offer-button"
              onClick={() => handleEvent({ type: 'trigger-point', triggerPoint: TRIGGER_POINTS['investment-promotion'].code })}
            >
              Learn More
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
