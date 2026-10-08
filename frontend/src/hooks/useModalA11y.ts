import { useEffect, useRef } from 'react';
import { lockScroll, unlockScroll } from '../components/AppScreen';

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

function getFocusable(root: HTMLElement | null): HTMLElement[] {
    if (!root) return [];
    return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        el => !el.hasAttribute('aria-hidden') && el.offsetParent !== null,
    );
}

/**
 * Shared modal accessibility (§3 P2-2): Escape-to-close, Tab focus trap,
 * initial focus, focus restore, and scroll lock (body + real scroller).
 *
 * Attach the returned ref to the modal's outermost element (typically the
 * `fixed inset-0` root) together with `role="dialog" aria-modal="true"`.
 * Must be called unconditionally near the top of the component that renders
 * the modal (before any early `return`s).
 *
 * @param open    whether the modal is currently shown
 * @param onClose invoked on Escape (should run the modal's close action)
 */
export function useModalA11y(open: boolean, onClose?: () => void) {
    const ref = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);
    onCloseRef.current = onClose;

    useEffect(() => {
        if (!open) return;
        const node = ref.current;
        const prevFocus = document.activeElement as HTMLElement | null;

        lockScroll();

        const focusables = () => getFocusable(node);
        const initial = focusables()[0] ?? node;
        initial?.focus?.();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                e.preventDefault();
                onCloseRef.current?.();
                return;
            }
            if (e.key !== 'Tab' || !node) return;
            const els = focusables();
            if (els.length === 0) {
                e.preventDefault();
                node.focus();
                return;
            }
            const first = els[0];
            const last = els[els.length - 1];
            const active = document.activeElement;
            if (e.shiftKey && (active === first || active === node)) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && active === last) {
                e.preventDefault();
                first.focus();
            }
        };

        document.addEventListener('keydown', onKey, true);

        return () => {
            document.removeEventListener('keydown', onKey, true);
            unlockScroll();
            if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) {
                prevFocus.focus();
            }
        };
    }, [open]);

    return ref;
}

export default useModalA11y;
