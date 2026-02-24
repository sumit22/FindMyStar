import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { usePurchaseAdapter } from './PurchaseProvider';
import { useEntitlementStore } from '../store/entitlementStore';
import type { Product } from './PurchaseAdapter';

interface PurchaseHook {
  loading: boolean;
  purchase: (product: Product) => Promise<boolean>;
  restore: () => Promise<boolean>;
}

export function usePurchase(): PurchaseHook {
  const adapter = usePurchaseAdapter();
  const activateEntitlement = useEntitlementStore(s => s.activateEntitlement);
  const [loading, setLoading] = useState(false);

  const purchase = useCallback(
    async (product: Product): Promise<boolean> => {
      setLoading(true);
      try {
        const result = await adapter.purchase(product.sku);
        if (result.success) {
          await activateEntitlement(result.planType, result.validUntilMs);
          return true;
        }
        if (result.error !== 'cancelled') {
          Alert.alert('Purchase Failed', result.message);
        }
        return false;
      } catch (e) {
        Alert.alert('Purchase Error', e instanceof Error ? e.message : 'Unexpected error');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [adapter, activateEntitlement],
  );

  const restore = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    try {
      const result = await adapter.restorePurchases();
      if (result.found) {
        await activateEntitlement(result.planType, result.validUntilMs);
        Alert.alert('Restored', 'Your Pro purchase has been restored.');
        return true;
      }
      Alert.alert('No Purchases Found', 'No previous Pro purchases were found for this account.');
      return false;
    } catch (e) {
      Alert.alert('Restore Error', e instanceof Error ? e.message : 'Unexpected error');
      return false;
    } finally {
      setLoading(false);
    }
  }, [adapter, activateEntitlement]);

  return { loading, purchase, restore };
}
