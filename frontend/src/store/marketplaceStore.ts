import { create } from 'zustand';
import type { Listing } from '../types/listing';

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
  activeModal: 'categories' | 'location' | 'distance' | 'filters' | 'sort' | 'inbox' | 'offer' | 'share' | 'more' | null;
  selectedListing: Listing | null;
  reportedListings: string[];

  setFilters: (filters: Partial<MarketplaceState>) => void;
  setActiveModal: (modal: MarketplaceState['activeModal']) => void;
  setSelectedListing: (listing: Listing | null) => void;
  reportListing: (id: string) => void;
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
  }, 
  radiusKm: 15,
  minPrice: null,
  maxPrice: null,
  sortBy: 'recommended' as const,
  activeModal: null as MarketplaceState['activeModal'],
  selectedListing: null as Listing | null,
  reportedListings: [] as string[],
};

export const useMarketplaceStore = create<MarketplaceState>((set) => ({
  ...initialState,
  setFilters: (filters) => set((state) => ({ ...state, ...filters })),
  setActiveModal: (modal) => set({ activeModal: modal }),
  setSelectedListing: (listing) => set({ selectedListing: listing }),
  reportListing: (id) => set((state) => ({ reportedListings: [...state.reportedListings, id] })),
  resetFilters: () => set(initialState),
}));
