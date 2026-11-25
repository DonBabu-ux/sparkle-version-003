import { create } from 'zustand';

type ModalType = 'post' | 'feeling' | 'post_comments' | 'moment' | 'listing' | 'poll' | 'event' | 'confession' | 'afterglow' | 'share' | 'reshare' | 'creation_hub' | 'media_preview' | 'highlight' | 'highlight_player' | 'archive' | 'post_options' | 'skill_offer' | 'skill_detail' | 'note_editor' | null;


/**
 * Modal payload bag: each modal receives a deliberately different shape
 * (a Post for reshare/post_options, { title, stories, … } for the highlight
 * player, note contents for note_editor…). Typing it to any single shape is
 * wrong for all the others, so the store stays untyped and each consumer
 * narrows what it needs. This is the documented escape hatch — per-consumer
 * casts would scatter the same `any` across a dozen call sites.
 */
type ModalPayload = any;

interface ModalState {
  activeModal: ModalType;
  modalData: ModalPayload;
  onSuccess: (() => void) | null;
  refreshCounter: number;
  setActiveModal: (type: ModalType, onSuccess?: (() => void) | null, data?: ModalPayload) => void;
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
