
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

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

// Register Service Worker for PWA
registerSW({
  onNeedRefresh() {
    // In autoUpdate mode, this might not be called if we don't handle it,
    // but we can keep it for manual refresh if we change the strategy later.
    if (confirm('New content available. Reload?')) {
      window.location.reload();
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline');
  },
});
