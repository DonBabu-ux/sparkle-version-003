import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import OtaService from './services/OtaService';
import { defineCustomElements } from '@ionic/pwa-elements/loader';
import { ToastProvider } from './utils/toast';
import realtimeLogger from './utils/realtimeTrace';
import { logger } from './utils/logger';

// ── Global last-resort handlers ──────────────────────────────────────────────
// ErrorBoundary only catches render-phase errors. Unhandled promise rejections
// (failed fetches in event handlers, socket callbacks, etc.) and async crashes
// otherwise vanish as invisible white screens. Surface them instead.
window.addEventListener('error', (event) => {
  logger.error('Global error:', event.error || event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Unhandled promise rejection:', event.reason);
});

/** Static visible fallback shown if the React app itself fails to boot. */
const showBootFailure = (reason: unknown) => {
  logger.error('Fatal boot failure:', reason);
  const root = document.getElementById('root');
  if (!root) return;
  root.innerHTML = `
    <div style="min-height:100dvh;display:flex;align-items:center;justify-content:center;
                font-family:system-ui,-apple-system,sans-serif;background:#fff0f4;padding:24px">
      <div style="text-align:center;max-width:420px">
        <div style="font-size:48px;margin-bottom:16px">&#10024;</div>
        <h1 style="font-size:22px;font-weight:700;color:#2D3436;margin:0 0 10px">
          Sparkle needs a quick restart
        </h1>
        <p style="color:#636E72;line-height:1.6;margin:0 0 24px">
          Something interrupted startup. Reloading usually fixes it.
        </p>
        <button onclick="window.location.reload()"
          style="padding:12px 28px;border:none;border-radius:14px;cursor:pointer;font-weight:600;font-size:15px;
                 color:#fff;background:linear-gradient(135deg,#FF3D6D,#FF8E53)">
          Reload Sparkle
        </button>
      </div>
    </div>`;
};

(async () => {
  try {
    logger.log('APP STARTED');
    // Chunk-reload guard from lazyWithRetry only applies within one broken
    // session — clear it once the app boots successfully so the next deploy
    // skew can self-heal again.
    sessionStorage.removeItem('sparkle_chunk_reload');
    // Expose realtime logger globally for debugging
    (window as any).__realtimeLogger = realtimeLogger;

    // 1. Intercept boot to check for and load active dynamic OTA bundles
    const isInjected = await OtaService.bootstrap();
    if (isInjected) {
      return; // Exit early: Let the dynamically loaded bundle mount the application
    }

    // Initialize Capacitor PWA elements
    defineCustomElements(window);

    ReactDOM.createRoot(document.getElementById('root')!).render(
      <React.StrictMode>
        <ErrorBoundary>
          <Router>
            <App />
            <ToastProvider />
          </Router>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (err) {
    showBootFailure(err);
  }
})();
