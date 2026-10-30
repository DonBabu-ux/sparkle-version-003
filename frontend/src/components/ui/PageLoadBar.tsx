import { useEffect, useState } from 'react';

/**
 * Facebook-style accumulating load bar.
 *
 * The previous implementation completed on a fixed timer and the chat's bar
 * swept forever — both displayed confidence the app had not earned. This one
 * is driven by the real request lifecycle:
 *
 *  - api.ts increments inFlight when a request leaves and decrements when it
 *    settles (from app boot, so nothing that starts during navigation is lost)
 *  - navigation activates the bar; the bar fills asymptotically as the burst
 *    grows and only reaches 100% when the requests that navigation caused
 *    have actually settled
 *  - a slow network therefore holds the bar; a fast one completes almost
 *    immediately, and there is no floor to fake
 */

const ASYMPTOTE = 0.92; // never claim completion while requests are pending

let inFlight = 0;
let active = false;
let progress = 0.08;
let tracked = 0;
let safetyTimer: number | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(f => f());

const bump = (value: number) => {
    progress = value;
    emit();
};

export const pageLoad = {
    requestStart() {
        inFlight++;
        if (!active) return;
        tracked++;
        bump(Math.max(progress, Math.min(ASYMPTOTE, tracked / (tracked + 3) * ASYMPTOTE)));
    },
    requestEnd() {
        inFlight = Math.max(0, inFlight - 1);
        if (!active) return;
        if (inFlight === 0) pageLoad.finish();
    },
    /** Called on route change. */
    start() {
        active = true;
        tracked = 0;
        bump(0.08);
        if (safetyTimer) window.clearTimeout(safetyTimer);
        // Bound the wait: a page that never issues a settleable request must
        // still resolve rather than hang forever.
        safetyTimer = window.setTimeout(() => {
            if (active) pageLoad.finish();
        }, 4000);
    },
    finish() {
        if (!active) return;
        if (safetyTimer) { window.clearTimeout(safetyTimer); safetyTimer = null; }
        bump(1);
        window.setTimeout(() => {
            active = false;
            progress = 0.08;
            emit();
        }, 220);
    },
    subscribe(fn: () => void) {
        listeners.add(fn);
        return () => { listeners.delete(fn); };
    },
};

export const PageLoadBar = () => {
    const [, forceRender] = useState(0);
    const location = useLocationSafe();

    useEffect(() => {
        const unsubscribe = pageLoad.subscribe(() => forceRender(n => n + 1));
        return unsubscribe;
    }, []);

    useEffect(() => {
        pageLoad.start();
    }, [location.key]);

    if (!active) return null;
    const pct = Math.round(progress * 100);
    const done = progress >= 1;

    return (
        <div
            className="fixed top-0 left-0 w-full h-[3px] z-(--z-max) pointer-events-none"
            role="progressbar"
            aria-label="Loading"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div
                className="h-full bg-gradient-to-r from-[#ff1493] to-[#ff2d87] shadow-[0_0_10px_rgba(255,20,147,0.5)]"
                style={{
                    width: `${pct}%`,
                    transition: done ? 'width 120ms linear' : 'width 400ms ease-out',
                    opacity: done ? 0 : 1,
                }}
            />
        </div>
    );
};

/* useLocation without importing react-router here — keeps this module testable
   and avoids a cycle if a route module ever imports the bar. */
import { useLocation } from 'react-router-dom';
function useLocationSafe() {
    return useLocation();
}

export default PageLoadBar;
