import { create } from 'zustand';

export interface TrackedObject {
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
  trackedObjects: TrackedObject[];
  activeTrackingId: number | null;
  ar: ARState | null;

  setTrackedObjects: (objects: TrackedObject[]) => void;
  addTrackedObject: (obj: TrackedObject) => void;
  removeTrackedObject: (id: number) => void;
  toggleTrackedObject: (id: number) => void;
  setActiveTracking: (id: number | null) => void;
  updateAR: (state: ARState) => void;
  updateRiseSets: (id: number, nextRiseMs: number | null, nextSetMs: number | null) => void;
}

export const useTrackingStore = create<TrackingState>((set) => ({
  trackedObjects: [],
  activeTrackingId: null,
  ar: null,

  setTrackedObjects: (objects) => set({ trackedObjects: objects }),

  addTrackedObject: (obj) =>
    set((state) => ({ trackedObjects: [...state.trackedObjects, obj] })),

  removeTrackedObject: (id) =>
    set((state) => ({
      trackedObjects: state.trackedObjects.filter((o) => o.id !== id),
    })),

  toggleTrackedObject: (id) =>
    set((state) => ({
      trackedObjects: state.trackedObjects.map((o) =>
        o.id === id ? { ...o, enabled: !o.enabled } : o,
      ),
    })),

  setActiveTracking: (id) => set({ activeTrackingId: id }),

  updateAR: (ar) => set({ ar }),

  updateRiseSets: (id, nextRiseMs, nextSetMs) =>
    set((state) => ({
      trackedObjects: state.trackedObjects.map((o) =>
        o.id === id ? { ...o, nextRiseMs, nextSetMs } : o,
      ),
    })),
}));
