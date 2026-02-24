import React, { createContext, useContext, useEffect, useRef } from 'react';
import type { PurchaseAdapter } from './PurchaseAdapter';

function createAdapter(): PurchaseAdapter {
  if (__DEV__) {
    const { createMockPurchaseAdapter } = require('./MockPurchaseAdapter');
    return createMockPurchaseAdapter();
  }
  // Production stub — replaced with real billing adapter later
  return {
    initialize: async () => {},
    purchase: async () => ({
      success: false as const,
      error: 'unknown' as const,
      message: 'Purchases not yet available',
    }),
    restorePurchases: async () => ({ found: false as const }),
    teardown: () => {},
  };
}

const PurchaseContext = createContext<PurchaseAdapter | null>(null);

export function PurchaseProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const adapterRef = useRef<PurchaseAdapter>(createAdapter());

  useEffect(() => {
    const adapter = adapterRef.current;
    adapter.initialize();
    return () => adapter.teardown();
  }, []);

  return <PurchaseContext.Provider value={adapterRef.current}>{children}</PurchaseContext.Provider>;
}

export function usePurchaseAdapter(): PurchaseAdapter {
  const adapter = useContext(PurchaseContext);
  if (!adapter) {
    throw new Error('usePurchaseAdapter must be used within PurchaseProvider');
  }
  return adapter;
}
