import { create } from 'zustand';

export interface CelestialObject {
  id: number;
  name: string;
  commonName: string | null;
  type: 'star' | 'planet' | 'nebula' | 'galaxy' | 'cluster' | 'planetary_nebula' | 'moon' | 'sun';
  ra: number | null;
  dec: number | null;
  magnitude: number;
  hipId: number | null;
  planetId: number | null;
  distanceLy: number | null;
  description: string | null;
}

interface CatalogState {
  objects: CelestialObject[];
  searchQuery: string;
  filterType: string | null;
  loading: boolean;
  error: string | null;

  setSearchQuery: (query: string) => void;
  setFilterType: (type: string | null) => void;
  loadCatalog: () => Promise<void>;
}

function applyFilters(
  objects: CelestialObject[],
  query: string,
  filterType: string | null,
): CelestialObject[] {
  let result = objects;
  if (query.length > 0) {
    const q = query.toLowerCase();
    result = result.filter(
      o =>
        o.name.toLowerCase().includes(q) ||
        (o.commonName && o.commonName.toLowerCase().includes(q)),
    );
  }
  if (filterType) {
    result = result.filter(o => o.type === filterType);
  }
  return result;
}

export const useCatalogStore = create<CatalogState>((set) => ({
  objects: [],
  searchQuery: '',
  filterType: null,
  loading: false,
  error: null,

  setSearchQuery: (query: string) => set({ searchQuery: query }),

  setFilterType: (type: string | null) => set({ filterType: type }),

  loadCatalog: async () => {
    set({ loading: true, error: null });
    try {
      // Will be implemented by DATA-006 CatalogRepository
      const objects: CelestialObject[] = [];
      set({ objects, loading: false });
    } catch (e) {
      set({ loading: false, error: e instanceof Error ? e.message : 'Failed to load catalog' });
    }
  },
}));

// Derived selector: filtered objects (computed outside store to avoid stale closures)
export function useFilteredObjects(): CelestialObject[] {
  const objects = useCatalogStore(s => s.objects);
  const query = useCatalogStore(s => s.searchQuery);
  const filterType = useCatalogStore(s => s.filterType);
  return applyFilters(objects, query, filterType);
}
