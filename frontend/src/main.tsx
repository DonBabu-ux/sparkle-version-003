import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';
import OtaService from './services/OtaService';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

(async () => {
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
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );
})();
