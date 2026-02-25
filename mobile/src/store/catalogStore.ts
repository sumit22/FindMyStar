import { create } from 'zustand';
import * as CatalogRepo from '../data/CatalogRepository';

// Re-export the canonical CelestialObject type from the repository
export type { CelestialObject } from '../data/CatalogRepository';

// Note: Pro objects are always included in search results and catalog listings.
// The entitlement gate is at the UI layer (lock badge on SearchScreen,
// upgrade prompt on ObjectInfoScreen). This maximizes discoverability.
import type { CelestialObject } from '../data/CatalogRepository';

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let searchRequestId = 0;
const SEARCH_DEBOUNCE_MS = 300;

interface CatalogState {
  objects: CelestialObject[];
  searchResults: CelestialObject[];
  searchQuery: string;
  filterType: string | null;
  loading: boolean;
  error: string | null;

  setSearchQuery: (query: string) => void;
  setFilterType: (type: string | null) => void;
  loadCatalog: () => Promise<void>;
  searchObjects: (query: string) => void;
  getObjectById: (id: number) => Promise<CelestialObject | null>;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  objects: [],
  searchResults: [],
  searchQuery: '',
  filterType: null,
  loading: false,
  error: null,

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setFilterType: (type: string | null) => {
    set({ filterType: type });
    // Re-run search with new filter
    const q = get().searchQuery;
    if (q.length > 0) {
      get().searchObjects(q);
    }
  },

  loadCatalog: async () => {
    set({ loading: true, error: null });
    try {
      const objects = await CatalogRepo.getAllObjects();
      set({ objects, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load catalog' });
    }
  },

  searchObjects: (query: string) => {
    set({ searchQuery: query });

    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    if (query.length === 0) {
      set({ searchResults: [] });
      return;
    }

    searchDebounceTimer = setTimeout(async () => {
      const requestId = ++searchRequestId;
      set({ loading: true });
      try {
        const results = await CatalogRepo.search(query, 50);
        // Discard stale results if a newer search was fired while awaiting
        if (requestId !== searchRequestId) {
          return;
        }
        const filterType = get().filterType;
        const filtered = filterType ? results.filter(o => o.type === filterType) : results;
        set({ searchResults: filtered, loading: false });
      } catch (e) {
        if (requestId !== searchRequestId) {
          return;
        }
        set({ loading: false, error: e instanceof Error ? e.message : 'Search failed' });
      }
    }, SEARCH_DEBOUNCE_MS);
  },

  getObjectById: async (id: number) => {
    return CatalogRepo.getById(id);
  },
}));

// Derived selector: filtered objects for browsing (non-search)
export function useFilteredObjects(): CelestialObject[] {
  const objects = useCatalogStore(s => s.objects);
  const filterType = useCatalogStore(s => s.filterType);
  if (!filterType) {
    return objects;
  }
  return objects.filter(o => o.type === filterType);
}
