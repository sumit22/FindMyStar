import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Core from '../native/FindMyStarCore';
import * as CatalogRepo from '../data/CatalogRepository';

const DEVICE_ID_KEY = '@findmystar/device_id';

export type PlanTypeName = 'free' | 'lifetime' | 'subscription';

interface EntitlementState {
  isPro: boolean;
  planType: PlanTypeName;
  validUntilMs: number | null;
  loaded: boolean;
  deviceId: string | null;

  loadEntitlement: () => Promise<void>;
  activateEntitlement: (planType: number, validUntilMs: number) => Promise<void>;
  clearEntitlement: () => Promise<void>;
}

function planTypeToName(n: number): PlanTypeName {
  switch (n) {
    case Core.PlanType.Lifetime:
      return 'lifetime';
    case Core.PlanType.Subscription:
      return 'subscription';
    default:
      return 'free';
  }
}

/** Returns a stable per-install device identifier (UUID v4). */
async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    // Generate UUID v4 using Math.random (sufficient for device binding)
    id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      // eslint-disable-next-line no-bitwise
      const r = (Math.random() * 16) | 0;
      // eslint-disable-next-line no-bitwise
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
    await AsyncStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

export const useEntitlementStore = create<EntitlementState>((set, get) => ({
  isPro: false,
  planType: 'free',
  validUntilMs: null,
  loaded: false,
  deviceId: null,

  loadEntitlement: async () => {
    try {
      const deviceId = await getDeviceId();
      set({ deviceId });

      const payloadBase64 = await CatalogRepo.getEntitlementPayload();
      if (!payloadBase64) {
        set({ isPro: false, planType: 'free', validUntilMs: null, loaded: true });
        return;
      }

      const result = await Core.checkEntitlement(payloadBase64, deviceId, Date.now());
      if (result === Core.EntitlementStatus.ProActive) {
        // Read denormalized plan info from DB for display
        set({ isPro: true, loaded: true });
      } else {
        // Expired, invalid signature, or wrong device
        set({ isPro: false, planType: 'free', validUntilMs: null, loaded: true });
      }
    } catch {
      set({ isPro: false, planType: 'free', loaded: true });
    }
  },

  activateEntitlement: async (planType: number, validUntilMs: number) => {
    let deviceId = get().deviceId;
    if (!deviceId) {
      deviceId = await getDeviceId();
      set({ deviceId });
    }

    const payloadBase64 = await Core.createEntitlement(planType, validUntilMs, deviceId);
    await CatalogRepo.saveEntitlementPayload(
      payloadBase64,
      planType,
      validUntilMs === 0 ? null : validUntilMs,
    );

    set({
      isPro: true,
      planType: planTypeToName(planType),
      validUntilMs: validUntilMs === 0 ? null : validUntilMs,
    });
  },

  clearEntitlement: async () => {
    await CatalogRepo.deleteEntitlement();
    set({ isPro: false, planType: 'free', validUntilMs: null });
  },
}));
