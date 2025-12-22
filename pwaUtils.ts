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
