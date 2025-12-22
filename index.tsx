
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { enableAutoHideBrowserBar } from './pwaUtils';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Best-effort: auto-collapse mobile browser address bar (no-op in standalone PWA)
enableAutoHideBrowserBar();

// Register Service Worker for PWA (production only)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

      // If there's an updated SW waiting, activate it ASAP.
      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // When a new SW is installed, prompt activation.
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      console.log('Service Worker registered:', registration);
    } catch (error) {
      console.log('Service Worker registration failed:', error);
    }
  });
}
