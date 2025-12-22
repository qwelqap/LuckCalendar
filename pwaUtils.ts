/**
 * PWA Service Worker Update Manager
 * Handles checking for updates and notifying users
 */

export interface SwUpdateEvent {
  type: 'update-available' | 'update-installed' | 'offline';
  message: string;
}

export type UpdateCallback = (event: SwUpdateEvent) => void;

let updateCallback: UpdateCallback | null = null;

export const registerUpdateCallback = (callback: UpdateCallback) => {
  updateCallback = callback;
};

export const checkForUpdates = async () => {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      console.log('Service Worker update checked');
    }
  } catch (error) {
    console.error('Failed to check for updates:', error);
  }
};

export const enableOfflineMode = () => {
  if (updateCallback) {
    updateCallback({
      type: 'offline',
      message: 'You are offline. Using cached content.'
    });
  }
};

/**
 * Returns true when the app is running in an installed/standalone display mode.
 * (In that case there is no browser address bar to hide.)
 */
export const isStandalonePwa = (): boolean => {
  if (typeof window === 'undefined') return false;

  // Standard
  if (window.matchMedia?.('(display-mode: standalone)')?.matches) return true;

  // iOS Safari legacy
  return (navigator as any).standalone === true;
};

/**
 * Best-effort “auto hide browser bar” behavior for mobile browsers.
 * Note: Modern iOS Safari limits programmatic address-bar hiding. This still:
 *  - sets a stable viewport CSS var to reduce layout jumps
 *  - nudges scroll a tiny amount to trigger bar collapse where supported
 */
export const enableAutoHideBrowserBar = (): (() => void) => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  // If the app is installed (standalone), there's no browser chrome to hide.
  if (isStandalonePwa()) {
    return () => {};
  }

  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (!isMobile) {
    return () => {};
  }

  const setViewportCssVar = () => {
    // Use innerHeight (not 100vh) to avoid iOS “rubber band” / URL bar resize issues.
    const vh = window.innerHeight * 0.01;
    document.documentElement.style.setProperty('--app-vh', `${vh}px`);
  };

  const tryHide = () => {
    setViewportCssVar();

    // Only attempt when at the top; otherwise don't disrupt user scroll.
    if (window.scrollY <= 0) {
      try {
        window.scrollTo({ top: 1, left: 0, behavior: 'auto' });
      } catch {
        // Older browsers might not support scrollTo options.
        window.scrollTo(0, 1);
      }
    }
  };

  const schedule = () => {
    // Multiple passes catch async layout/keyboard/URL-bar transitions.
    requestAnimationFrame(() => {
      setTimeout(tryHide, 0);
      setTimeout(tryHide, 150);
      setTimeout(tryHide, 400);
    });
  };

  window.addEventListener('load', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('orientationchange', schedule, { passive: true } as any);

  // visualViewport provides better signals on mobile when the URL bar expands/collapses.
  const vv = window.visualViewport;
  vv?.addEventListener('resize', schedule, { passive: true });
  vv?.addEventListener('scroll', schedule, { passive: true });

  // Initial attempt
  schedule();

  return () => {
    window.removeEventListener('load', schedule as any);
    window.removeEventListener('resize', schedule as any);
    window.removeEventListener('orientationchange', schedule as any);
    vv?.removeEventListener('resize', schedule as any);
    vv?.removeEventListener('scroll', schedule as any);
  };
};

// Listen for Service Worker updates
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateCallback) {
      updateCallback({
        type: 'update-installed',
        message: 'New version available! Please reload the app.'
      });
    }
  });

  // Check for updates periodically (every 30 minutes)
  setInterval(() => {
    checkForUpdates();
  }, 30 * 60 * 1000);
}

// Listen for offline/online events
window.addEventListener('offline', () => {
  enableOfflineMode();
});

window.addEventListener('online', () => {
  if (updateCallback) {
    updateCallback({
      type: 'update-available',
      message: 'Back online!'
    });
  }
});
