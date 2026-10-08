import { create } from 'zustand';

/**
 * Imperative confirm/prompt dialogs (S8 — no more native `confirm()`/`prompt()`).
 * Callable from anywhere (handlers, stores) — returns a Promise the caller awaits.
 */

export type PendingDialog =
  | {
      kind: 'confirm';
      message: string;
      title?: string;
      confirmLabel?: string;
      danger?: boolean;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'prompt';
      message: string;
      title?: string;
      defaultValue?: string;
      confirmLabel?: string;
      resolve: (value: string | null) => void;
    };

interface DialogState {
  pending: PendingDialog | null;
  open: (pending: PendingDialog) => void;
  dismiss: () => void;
}

export const useDialogStore = create<DialogState>((set) => ({
  pending: null,
  open: (pending) => set({ pending }),
  dismiss: () => set({ pending: null }),
}));

function open<T extends PendingDialog>(
  build: (resolve: (value: T extends { kind: 'confirm' } ? boolean : string | null) => void) => T
): Promise<T extends { kind: 'confirm' } ? boolean : string | null> {
  return new Promise((resolve) => {
    useDialogStore.getState().open(build(resolve as never));
  });
}

/** Promise-based replacement for `window.confirm`. */
export function confirmDialog(
  message: string,
  opts?: { title?: string; confirmLabel?: string; danger?: boolean }
): Promise<boolean> {
  return open<boolean>((resolve) => ({
    kind: 'confirm',
    message,
    title: opts?.title,
    confirmLabel: opts?.confirmLabel,
    danger: opts?.danger ?? true,
    resolve,
  }));
}

/** Promise-based replacement for `window.prompt` (resolves null on cancel). */
export function promptDialog(
  message: string,
  opts?: { title?: string; defaultValue?: string; confirmLabel?: string }
): Promise<string | null> {
  return open<string | null>((resolve) => ({
    kind: 'prompt',
    message,
    title: opts?.title,
    defaultValue: opts?.defaultValue ?? '',
    confirmLabel: opts?.confirmLabel,
    resolve,
  }));
}

/** Settle the pending dialog (used by the host on confirm/cancel/Escape). */
export function settleDialog(value: boolean | string | null): void {
  const pending = useDialogStore.getState().pending;
  if (!pending) return;
  useDialogStore.getState().dismiss();
  pending.resolve(value as never);
}
