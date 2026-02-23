import { create } from 'zustand';
import * as AlarmScheduler from '../services/AlarmScheduler';
import * as ObjectTracker from '../services/ObjectTrackingService';
import * as CatalogRepo from '../data/CatalogRepository';
import type { CelestialObject } from '../data/CatalogRepository';

export interface TrackedObjectInfo {
  id: number;
  objectId: number;
  objectName: string;
  enabled: boolean;
  lat: number;
  lon: number;
  minAltitude: number;
  notifyBeforeMinutes: number;
  nextRiseMs: number | null;
  nextSetMs: number | null;
  isRecurring: boolean;
}

interface ARState {
  altitude: number;
  azimuth: number;
  angularDistance: number;
  isLocked: boolean;
}

interface TrackingState {
  trackedObjects: TrackedObjectInfo[];
  activeTrackingId: number | null;
  ar: ARState | null;
  loading: boolean;
  error: string | null;

  // Sync actions
  updateAR: (state: ARState) => void;
  clearError: () => void;

  // Async actions
  loadAlarms: () => Promise<void>;
  createAlarm: (objectId: number, config?: Partial<CatalogRepo.AlarmConfig>) => Promise<void>;
  deleteAlarm: (alarmId: number) => Promise<void>;
  toggleAlarm: (alarmId: number) => Promise<void>;
  refreshAlarms: () => Promise<void>;
  startTracking: (obj: CelestialObject) => Promise<void>;
  stopTracking: () => void;
}

export const useTrackingStore = create<TrackingState>((set, get) => ({
  trackedObjects: [],
  activeTrackingId: null,
  ar: null,
  loading: false,
  error: null,

  updateAR: (ar) => set({ ar }),
  clearError: () => set({ error: null }),

  loadAlarms: async () => {
    set({ loading: true, error: null });
    try {
      const alarms = await AlarmScheduler.listAlarms();
      const trackedObjects: TrackedObjectInfo[] = [];
      for (const alarm of alarms) {
        const obj = await CatalogRepo.getById(alarm.objectId);
        trackedObjects.push({
          id: alarm.id,
          objectId: alarm.objectId,
          objectName: obj?.commonName ?? obj?.name ?? `Object #${alarm.objectId}`,
          enabled: alarm.enabled,
          lat: alarm.lat,
          lon: alarm.lon,
          minAltitude: alarm.minAltitude,
          notifyBeforeMinutes: alarm.notifyBeforeMinutes,
          nextRiseMs: alarm.nextRiseMs,
          nextSetMs: alarm.nextSetMs,
          isRecurring: alarm.isRecurring,
        });
      }
      set({ trackedObjects, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load alarms' });
    }
  },

  createAlarm: async (objectId, config) => {
    try {
      await AlarmScheduler.createAlarm(objectId, config);
      await get().loadAlarms();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to create alarm' });
    }
  },

  deleteAlarm: async (alarmId) => {
    try {
      await AlarmScheduler.deleteAlarm(alarmId);
      set((state) => ({
        trackedObjects: state.trackedObjects.filter(o => o.id !== alarmId),
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to delete alarm' });
    }
  },

  toggleAlarm: async (alarmId) => {
    const obj = get().trackedObjects.find(o => o.id === alarmId);
    if (!obj) return;
    try {
      await AlarmScheduler.toggleAlarm(alarmId, !obj.enabled);
      set((state) => ({
        trackedObjects: state.trackedObjects.map(o =>
          o.id === alarmId ? { ...o, enabled: !o.enabled } : o,
        ),
      }));
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to toggle alarm' });
    }
  },

  refreshAlarms: async () => {
    try {
      await AlarmScheduler.recalculateAll();
      await get().loadAlarms();
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to refresh alarms' });
    }
  },

  startTracking: async (obj) => {
    set({ error: null });
    try {
      await ObjectTracker.initialize(obj);
      set({ activeTrackingId: obj.id });

      // Subscribe to tracking updates
      ObjectTracker.onTrackingUpdate((frame) => {
        set({
          ar: {
            altitude: frame.altitude,
            azimuth: frame.azimuth,
            angularDistance: frame.angularDistance,
            isLocked: frame.isLocked,
          },
        });
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Failed to start tracking' });
    }
  },

  stopTracking: () => {
    ObjectTracker.stop();
    set({ activeTrackingId: null, ar: null });
  },
}));
