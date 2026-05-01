import { create } from 'zustand';

interface MarketplaceState {
  searchQuery: string;
  category: string;
  location: { 
    lat: number; 
    lng: number; 
    name: string;
    source?: 'gps' | 'ip' | 'manual' | 'default';
    accuracy?: number | null;
  };
  radiusKm: number;
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: 'recommended' | 'price_asc' | 'price_desc' | 'distance_asc' | 'newest';
  activeModal: 'categories' | 'location' | 'distance' | 'filters' | 'sort' | 'inbox' | null;

  setFilters: (filters: Partial<MarketplaceState>) => void;
  setActiveModal: (modal: MarketplaceState['activeModal']) => void;
  resetFilters: () => void;
}

const initialState = {
  searchQuery: '',
  category: 'all',
  location: { 
    lat: -1.2921, 
    lng: 36.8219, 
    name: 'Nairobi, Kenya',
    source: 'default'
  }, // Default to Nairobi or user's location
  radiusKm: 15,
  minPrice: null,
  maxPrice: null,
  sortBy: 'recommended' as const,
  activeModal: null as MarketplaceState['activeModal'],
};

export const useMarketplaceStore = create<MarketplaceState>((set) => ({
  ...initialState,
  setFilters: (filters) => set((state) => ({ ...state, ...filters })),
  setActiveModal: (modal) => set({ activeModal: modal }),
  resetFilters: () => set(initialState),
}));
