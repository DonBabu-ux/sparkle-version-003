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

(async () => {
  logger.log('APP STARTED');
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
})();
