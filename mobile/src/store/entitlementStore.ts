import { create } from 'zustand';
import { Platform, NativeModules } from 'react-native';
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

/**
 * Returns a stable per-install device identifier.
 *
 * Uses the platform-provided device ID when available:
 *   - Android: Settings.Secure.ANDROID_ID (unique per app-signing key + device)
 *   - iOS: identifierForVendor (unique per vendor + device, resets on full uninstall)
 *
 * Falls back to a crypto-random UUID persisted in AsyncStorage if the native
 * ID is unavailable (e.g. emulator or missing native module).
 */
async function getDeviceId(): Promise<string> {
  let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    // Try platform-provided stable identifier first
    try {
      if (Platform.OS === 'android') {
        const { PlatformConstants } = NativeModules;
        const androidId = PlatformConstants?.getAndroidID?.() as string | undefined;
        if (androidId && androidId.length > 0) {
          id = `android-${androidId}`;
        }
      }
    } catch {
      // Fall through to crypto-random fallback
    }

    if (!id) {
      // Crypto-random UUID v4 fallback (much stronger than Math.random)
      const bytes = new Uint8Array(16);
      if (typeof globalThis.crypto?.getRandomValues === 'function') {
        globalThis.crypto.getRandomValues(bytes);
      } else {
        // Last resort: Math.random (only on very old RN versions)
        for (let i = 0; i < 16; i++) {
          bytes[i] = Math.floor(Math.random() * 256);
        }
      }
      // Set version (4) and variant (RFC 4122) bits
      // eslint-disable-next-line no-bitwise
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      // eslint-disable-next-line no-bitwise
      bytes[8] = (bytes[8] & 0x3f) | 0x80;

      const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
      id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }

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
