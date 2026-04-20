import { create } from 'zustand';

type ModalType = 'post' | 'moment' | 'listing' | 'poll' | 'event' | 'confession' | 'settings' | 'afterglow' | 'share' | 'reshare' | null;

interface ModalState {
  activeModal: ModalType;
  modalData: any;
  onSuccess: (() => void) | null;
  refreshCounter: number;
  setActiveModal: (type: ModalType, onSuccess?: (() => void) | null, data?: any) => void;
  closeModal: () => void;
  triggerSuccess: () => void;
  triggerRefresh: () => void;
}

export const useModalStore = create<ModalState>((set, get) => ({
  activeModal: null,
  modalData: null,
  onSuccess: null,
  refreshCounter: 0,
  setActiveModal: (type, onSuccess = null, data = null) => set({ activeModal: type, onSuccess, modalData: data }),
  closeModal: () => set({ activeModal: null, onSuccess: null, modalData: null }),
  triggerRefresh: () => set((state) => ({ refreshCounter: state.refreshCounter + 1 })),
  triggerSuccess: () => {
    const { onSuccess } = get();
    if (onSuccess) onSuccess();
    get().triggerRefresh();
    set({ activeModal: null, onSuccess: null });
  }
}));
