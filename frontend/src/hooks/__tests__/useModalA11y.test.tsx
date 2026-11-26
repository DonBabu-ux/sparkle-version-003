// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React from 'react';

vi.mock('../../components/AppScreen', () => ({
  lockScroll: vi.fn(),
  unlockScroll: vi.fn(),
}));

const { lockScroll, unlockScroll } = await import('../../components/AppScreen');
const { useModalA11y } = await import('../useModalA11y');

afterEach(() => {
  cleanup();
  vi.mocked(lockScroll).mockClear();
  vi.mocked(unlockScroll).mockClear();
});

// jsdom has no layout: offsetParent is always null, which the hook's
// visibility filter reads. Present every element as visible so the focus
// trap sees the buttons.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  get() { return document.body; },
  configurable: true,
});

const Harness: React.FC<{ open: boolean; onClose?: () => void }> = ({ open, onClose }) => {
  const ref = useModalA11y(open, onClose);
  return (
    <div ref={ref} role="dialog" aria-modal="true">
      <button type="button">First</button>
      <button type="button">Last</button>
    </div>
  );
};

describe('useModalA11y', () => {
  it('locks scroll and focuses the first focusable element when open', async () => {
    const view = render(<Harness open />);

    await act(async () => {});
    expect(vi.mocked(lockScroll)).toHaveBeenCalledTimes(1);
    const first = view.container.querySelector('button');
    expect(document.activeElement).toBe(first);
  });

  it('does not lock scroll while closed', async () => {
    render(<Harness open={false} />);
    await act(async () => {});
    expect(vi.mocked(lockScroll)).not.toHaveBeenCalled();
  });

  it('calls onClose on Escape', async () => {
    const onClose = vi.fn();
    const view = render(<Harness open onClose={onClose} />);

    await act(async () => {
      view.container.dispatchEvent(
        new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      );
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('unlocks scroll and restores focus when the modal closes', async () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    const view = render(<Harness open />);
    await act(async () => {});
    expect(vi.mocked(lockScroll)).toHaveBeenCalledTimes(1);

    await act(async () => {
      view.rerender(<Harness open={false} />);
    });
    expect(vi.mocked(unlockScroll)).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(outside);

    outside.remove();
  });

  it('wraps Tab from the last element back to the first', async () => {
    const view = render(<Harness open />);
    await act(async () => {});

    const buttons = view.container.querySelectorAll('button');
    buttons[1].focus();
    expect(document.activeElement).toBe(buttons[1]);

    const tab = new window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    await act(async () => { document.dispatchEvent(tab); });

    expect(document.activeElement).toBe(buttons[0]);
    expect(tab.defaultPrevented).toBe(true);
  });

  it('wraps Shift+Tab from the first element to the last', async () => {
    const view = render(<Harness open />);
    await act(async () => {});

    const buttons = view.container.querySelectorAll('button');
    buttons[0].focus();

    const tab = new window.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    await act(async () => { document.dispatchEvent(tab); });

    expect(document.activeElement).toBe(buttons[1]);
  });
});