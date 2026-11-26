import { describe, it, expect, beforeEach } from 'vitest';
import { confirmDialog, promptDialog, settleDialog, useDialogStore } from '../dialogStore';

const state = () => useDialogStore.getState();

beforeEach(() => {
  state().dismiss();
});

describe('promise-based confirm/prompt dialogs', () => {
  it('confirmDialog resolves true and dismisses the pending dialog', async () => {
    const p = confirmDialog('Delete this post?');
    expect(state().pending).toMatchObject({ kind: 'confirm', message: 'Delete this post?' });

    settleDialog(true);
    await expect(p).resolves.toBe(true);
    expect(state().pending).toBeNull();
  });

  it('confirmDialog defaults to the danger presentation', async () => {
    confirmDialog('Terminate account?');
    expect(state().pending).toMatchObject({ kind: 'confirm', danger: true });
    settleDialog(false);
  });

  it('confirmDialog honours explicit labels and danger=false', async () => {
    const p = confirmDialog('Follow?', { title: 'Follow user', confirmLabel: 'Follow', danger: false });
    expect(state().pending).toMatchObject({
      title: 'Follow user', confirmLabel: 'Follow', danger: false,
    });
    settleDialog(true);
    await p;
  });

  it('promptDialog resolves the entered value', async () => {
    const p = promptDialog('New name', { defaultValue: 'old' });
    expect(state().pending).toMatchObject({ kind: 'prompt', defaultValue: 'old' });

    settleDialog('new');
    await expect(p).resolves.toBe('new');
  });

  it('promptDialog resolves null on cancel', async () => {
    const p = promptDialog('Rename group');
    settleDialog(null);
    await expect(p).resolves.toBeNull();
  });

  it('settling twice is a no-op (the second settle finds nothing pending)', async () => {
    const p = confirmDialog('Sure?');
    settleDialog(true);
    expect(() => settleDialog(false)).not.toThrow();
    await expect(p).resolves.toBe(true);
  });

  it('settling with no dialog open is a no-op', () => {
    expect(() => settleDialog(true)).not.toThrow();
    expect(state().pending).toBeNull();
  });

  it('a second dialog replaces the first pending one', async () => {
    const first = confirmDialog('First');
    const second = promptDialog('Second');

    expect(state().pending).toMatchObject({ kind: 'prompt' });
    settleDialog('answer');

    await expect(second).resolves.toBe('answer');
    // The abandoned confirm promise is never settled — the host replaced it.
    let firstSettled = false;
    first.then(() => { firstSettled = true; }, () => {});
    await new Promise((r) => setTimeout(r, 0));
    expect(firstSettled).toBe(false);
  });
});