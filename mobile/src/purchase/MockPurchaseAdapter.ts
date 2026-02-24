import type { PurchaseAdapter, PurchaseResult, RestoreResult } from './PurchaseAdapter';
import { PRODUCTS } from './PurchaseAdapter';

export interface MockConfig {
  /** Simulated delay in ms before purchase resolves. */
  delayMs: number;
  /** Force a specific error on next purchase. Resets to null after use. */
  forceError: 'cancelled' | 'already_owned' | 'network' | 'unknown' | null;
  /** For subscriptions: validity duration in ms. */
  subscriptionDurationMs: number;
}

/** Module-level mutable config — tweakable from DevSettingsPanel at runtime. */
export const mockConfig: MockConfig = {
  delayMs: 1500,
  forceError: null,
  subscriptionDurationMs: 5 * 60 * 1000,
};

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function createMockPurchaseAdapter(): PurchaseAdapter {
  return {
    async initialize(): Promise<void> {
      await delay(200);
    },

    async purchase(sku: string): Promise<PurchaseResult> {
      await delay(mockConfig.delayMs);

      if (mockConfig.forceError) {
        const error = mockConfig.forceError;
        mockConfig.forceError = null;
        return { success: false, error, message: `Mock forced error: ${error}` };
      }

      const product = PRODUCTS.find(p => p.sku === sku);
      if (!product) {
        return { success: false, error: 'unknown', message: `Unknown SKU: ${sku}` };
      }

      const validUntilMs = product.isSubscription
        ? Date.now() + mockConfig.subscriptionDurationMs
        : 0;

      return { success: true, sku, planType: product.planType, validUntilMs };
    },

    async restorePurchases(): Promise<RestoreResult> {
      await delay(mockConfig.delayMs);
      return { found: false };
    },

    teardown(): void {},
  };
}
