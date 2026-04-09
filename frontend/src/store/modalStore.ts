import { create } from 'zustand';

type ModalType = 'post' | 'moment' | 'listing' | 'poll' | 'event' | 'confession' | 'settings' | 'afterglow' | 'share' | null;

interface ModalState {
  activeModal: ModalType;
  onSuccess: (() => void) | null;
  refreshCounter: number;
  setActiveModal: (type: ModalType, onSuccess?: (() => void) | null) => void;
  closeModal: () => void;
  triggerSuccess: () => void;
  triggerRefresh: () => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  activeModal: null,
  onSuccess: null,
  refreshCounter: 0,
  setActiveModal: (type, onSuccess = null) => set({ activeModal: type, onSuccess }),
  closeModal: () => set({ activeModal: null, onSuccess: null }),
  triggerRefresh: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),
  triggerSuccess: () => {
    const { onSuccess } = get();
    if (onSuccess) onSuccess();
    get().triggerRefresh();
    set({ activeModal: null, onSuccess: null });
  }
}));
