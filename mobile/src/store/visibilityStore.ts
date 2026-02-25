import { create } from 'zustand';
import type { CelestialObject } from '../data/CatalogRepository';
import * as CatalogRepo from '../data/CatalogRepository';
import * as VisibilityService from '../services/VisibilityService';
import * as VisibilityCacheService from '../services/VisibilityCacheService';

export interface VisibleNowItem {
  obj: CelestialObject;
  altitude: number;
  azimuth: number;
}

export interface ComingUpItem {
  obj: CelestialObject;
  riseMs: number;
}

interface VisibilityState {
  visibleNow: VisibleNowItem[];
  comingUp: ComingUpItem[];
  loading: boolean;
  lastRefreshedMs: number | null;

  /** Read cached windows from DB, compute live altAz for visible items only. */
  loadFromCache: (lat: number, lon: number) => Promise<void>;

  /** Full background recompute, then reload from cache. */
  refreshCache: (lat: number, lon: number) => Promise<void>;

  /** Re-evaluate buckets from cache using current time (no FFI calls). */
  tick: () => Promise<void>;
}

/** Stashed location from last loadFromCache so tick() can refresh altAz. */
let lastLat = 0;
let lastLon = 0;

export const useVisibilityStore = create<VisibilityState>((set, get) => ({
  visibleNow: [],
  comingUp: [],
  loading: false,
  lastRefreshedMs: null,

  loadFromCache: async (lat: number, lon: number) => {
    lastLat = lat;
    lastLon = lon;
    set({ loading: true });

    try {
      const now = Date.now();
      const TWENTY_FOUR_HOURS = 24 * 3600 * 1000;

      const [visibleRows, comingUpRows] = await Promise.all([
        CatalogRepo.getVisibleNowFromCache(now),
        CatalogRepo.getComingUpFromCache(now, TWENTY_FOUR_HOURS),
      ]);

      // Compute live altAz only for "visible now" items (parallel, ~5-10 calls)
      const visibleWithAltAz = await Promise.all(
        visibleRows.map(async row => {
          try {
            const aa = await VisibilityService.getCurrentAltAz(row.obj, lat, lon);
            return { obj: row.obj, altitude: aa.altitude, azimuth: aa.azimuth };
          } catch {
            return { obj: row.obj, altitude: 0, azimuth: 0 };
          }
        }),
      );

      // Sort by altitude descending, take top 5
      visibleWithAltAz.sort((a, b) => b.altitude - a.altitude);

      const comingUp: ComingUpItem[] = comingUpRows.map(row => ({
        obj: row.obj,
        riseMs: row.riseMs,
      }));

      set({
        visibleNow: visibleWithAltAz.slice(0, 5),
        comingUp,
        loading: false,
        lastRefreshedMs: now,
      });
    } catch {
      set({ loading: false });
    }
  },

  refreshCache: async (lat: number, lon: number) => {
    set({ loading: true });
    try {
      await VisibilityCacheService.refreshCache();
      await get().loadFromCache(lat, lon);
    } catch {
      set({ loading: false });
    }
  },

  tick: async () => {
    // Re-read cache with updated time — handles items shifting between buckets.
    // Only refreshes altAz for visible items if the set changed.
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 3600 * 1000;

    try {
      const [visibleRows, comingUpRows] = await Promise.all([
        CatalogRepo.getVisibleNowFromCache(now),
        CatalogRepo.getComingUpFromCache(now, TWENTY_FOUR_HOURS),
      ]);

      const prev = get().visibleNow;
      const prevIds = new Set(prev.map(v => v.obj.id));
      const newIds = new Set(visibleRows.map(r => r.obj.id));

      // Only recompute altAz if the visible set changed
      const setChanged = prevIds.size !== newIds.size || [...newIds].some(id => !prevIds.has(id));

      let visibleNow: VisibleNowItem[];
      if (setChanged) {
        const items = await Promise.all(
          visibleRows.map(async row => {
            try {
              const aa = await VisibilityService.getCurrentAltAz(row.obj, lastLat, lastLon);
              return { obj: row.obj, altitude: aa.altitude, azimuth: aa.azimuth };
            } catch {
              return { obj: row.obj, altitude: 0, azimuth: 0 };
            }
          }),
        );
        items.sort((a, b) => b.altitude - a.altitude);
        visibleNow = items.slice(0, 5);
      } else {
        visibleNow = prev;
      }

      set({
        visibleNow,
        comingUp: comingUpRows.map(r => ({ obj: r.obj, riseMs: r.riseMs })),
      });
    } catch {
      // Silent — tick failures shouldn't disrupt the UI
    }
  },
}));
