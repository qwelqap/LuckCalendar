
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
// NOTE:
// We intentionally do NOT auto-collapse the mobile browser address bar by default.
// Users asked to keep the phone top/bottom bars visible unless they explicitly
// enter immersive fullscreen via the Settings toggle.

const hidePwaSplash = () => {
  const el = document.getElementById('pwa-splash');
  if (!el) return;

  // Smoothly fade out, then remove from DOM.
  el.style.transition = 'opacity 220ms ease';
  el.style.opacity = '0';
  window.setTimeout(() => {
    try {
      el.remove();
    } catch {
      // ignore
    }
  }, 260);
};

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

// Hide the HTML splash as soon as React is mounted.
hidePwaSplash();

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
