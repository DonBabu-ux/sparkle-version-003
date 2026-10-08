import React from 'react';
import { useModalA11y } from '../../hooks/useModalA11y';

interface ModalShellProps {
    /** Whether the modal is shown (also gates rendering). */
    open: boolean;
    /** Close action — wired to Escape (via useModalA11y) and scrim clicks. */
    onClose: () => void;
    /** Accessible name for the dialog (aria-label). */
    label?: string;
    /** Classes for the scrim (`fixed inset-0` layer). */
    overlayClassName?: string;
    /** Classes for the dialog panel. */
    className?: string;
    /** Close when the scrim itself (not the panel) is clicked. Default true. */
    closeOnScrim?: boolean;
    children: React.ReactNode;
}

/**
 * Shared modal shell (§3 P2-2): dialog role, aria-modal, Escape, focus trap,
 * scroll lock and `--z-modal` stacking in one place. New modals should use
 * this; existing modals are retrofitted with `useModalA11y` directly.
 */
export function ModalShell({
    open,
    onClose,
    label,
    overlayClassName = '',
    className = '',
    closeOnScrim = true,
    children,
}: ModalShellProps) {
    const a11yRef = useModalA11y(open, onClose);

    if (!open) return null;

    return (
        <div
            className={`fixed inset-0 z-(--z-modal) ${overlayClassName}`}
            onClick={closeOnScrim ? (e: React.MouseEvent) => { if (e.target === e.currentTarget) onClose(); } : undefined}
        >
            <div
                ref={a11yRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                className={`outline-none ${className}`}
            >
                {children}
            </div>
        </div>
    );
}

export default ModalShell;
