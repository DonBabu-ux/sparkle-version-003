import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';

// H24 — the 5s startup failsafe must not bounce a valid session to /login
// when the DB blip merely makes boot slow. Source-level spec (browser
// automation unavailable by user decision), same pattern as sidebarLayout.
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');

describe('App.tsx startup failsafe watchdog (H24)', () => {
    const watchdogIdx = appSource.indexOf('Startup timeout reached');
    const watchdogBlock = appSource.slice(watchdogIdx, watchdogIdx + 500);

    it('watchdog exists', () => {
        expect(watchdogIdx).toBeGreaterThan(-1);
    });

    it('navigates based on session state, not unconditionally to /login', () => {
        expect(watchdogBlock).toContain(
            "performStartupNavigation(useUserStore.getState().isAuthenticated ? '/dashboard' : '/login')"
        );
    });

    it('does not log the timeout as console.error (it is a transient condition)', () => {
        expect(watchdogBlock).not.toContain('console.error("Startup timeout reached")');
    });
});
