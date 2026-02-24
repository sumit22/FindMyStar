export interface Product {
  sku: string;
  title: string;
  description: string;
  price: string;
  planType: number;
  isSubscription: boolean;
}

export const PRODUCTS: Product[] = [
  {
    sku: 'findmystar_pro_lifetime',
    title: 'Lifetime Pro',
    description: 'One-time purchase. Unlock all Pro features forever.',
    price: '$9.99',
    planType: 1, // PlanType.Lifetime
    isSubscription: false,
  },
  {
    sku: 'findmystar_pro_monthly',
    title: 'Monthly Pro',
    description: 'Cancel anytime. All Pro features while subscribed.',
    price: '$2.99/mo',
    planType: 2, // PlanType.Subscription
    isSubscription: true,
  },
];

export type PurchaseResult =
  | { success: true; sku: string; planType: number; validUntilMs: number }
  | {
      success: false;
      error: 'cancelled' | 'already_owned' | 'network' | 'unknown';
      message: string;
    };

export type RestoreResult =
  | { found: true; sku: string; planType: number; validUntilMs: number }
  | { found: false };

export interface PurchaseAdapter {
  initialize(): Promise<void>;
  purchase(sku: string): Promise<PurchaseResult>;
  restorePurchases(): Promise<RestoreResult>;
  teardown(): void;
}
