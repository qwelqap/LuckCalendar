/**
 * IndexedDB Storage Manager for LuckCalendar
 * Handles all database operations for storing and retrieving entries
 */

import { Entry } from './types';

const DB_NAME = 'LuckCalendarDB';
const DB_VERSION = 1;
const STORE_NAME = 'entries';

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB database
 */
export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (db) {
      resolve(db);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onblocked = () => {
      // Happens when another tab still has the old version open.
      console.warn('IndexedDB open request is blocked. Close other LuckCalendar tabs and retry.');
    };

    request.onerror = () => {
      console.error('Failed to open IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;

      // If another tab upgrades the DB, this connection becomes stale.
      db.onversionchange = () => {
        console.warn('IndexedDB version change detected. Closing existing connection.');
        try {
          db?.close();
        } finally {
          db = null;
        }
      };

      console.log('IndexedDB initialized successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      const objectStore = database.objectStoreNames.contains(STORE_NAME)
        ? (request.transaction as IDBTransaction).objectStore(STORE_NAME)
        : database.createObjectStore(STORE_NAME, { keyPath: 'id' });

      // Ensure index exists (covers future schema fixes without bumping DB name)
      if (!objectStore.indexNames.contains('date')) {
        objectStore.createIndex('date', 'date', { unique: false });
      }
    };
  });
};

/**
 * Get all entries from IndexedDB
 */
export const getAllEntries = async (): Promise<Entry[]> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.getAll();

    request.onerror = () => {
      console.error('Failed to get entries:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      // Sort by date in descending order (newest first)
      const entries = request.result.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      resolve(entries);
    };
  });
};

/**
 * Add or update a single entry
 */
export const saveEntry = async (entry: Entry): Promise<number> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.put(entry);

    request.onerror = () => {
      console.error('Failed to save entry:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('Entry saved successfully:', entry.id);
      resolve(request.result as number);
    };
  });
};

/**
 * Add multiple entries at once
 */
export const saveEntries = async (entries: Entry[]): Promise<void> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);

    entries.forEach(entry => {
      objectStore.put(entry);
    });

    transaction.onerror = () => {
      console.error('Failed to save entries:', transaction.error);
      reject(transaction.error);
    };

    transaction.oncomplete = () => {
      console.log('All entries saved successfully');
      resolve();
    };
  });
};

/**
 * Delete an entry by ID
 */
export const deleteEntry = async (id: number): Promise<void> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(id);

    request.onerror = () => {
      console.error('Failed to delete entry:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('Entry deleted successfully:', id);
      resolve();
    };
  });
};

/**
 * Clear all entries from the database
 */
export const clearAllEntries = async (): Promise<void> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.clear();

    request.onerror = () => {
      console.error('Failed to clear entries:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      console.log('All entries cleared successfully');
      resolve();
    };
  });
};

/**
 * Get entries by date range
 */
export const getEntriesByDateRange = async (startDate: Date, endDate: Date): Promise<Entry[]> => {
  const database = await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const objectStore = transaction.objectStore(STORE_NAME);
    const dateIndex = objectStore.index('date');
    
    const startDateStr = startDate.toISOString();
    const endDateStr = endDate.toISOString();
    const range = IDBKeyRange.bound(startDateStr, endDateStr);
    
    const request = dateIndex.getAll(range);

    request.onerror = () => {
      console.error('Failed to get entries by date range:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      const entries = request.result.sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      resolve(entries);
    };
  });
};

/**
 * Export all entries as JSON
 */
export const exportEntriesAsJSON = async (): Promise<string> => {
  const entries = await getAllEntries();
  return JSON.stringify(entries, null, 2);
};

/**
 * Import entries from JSON
 */
export const importEntriesFromJSON = async (jsonData: string): Promise<void> => {
  try {
    const entries = JSON.parse(jsonData) as Entry[];
    
    // Validate entries
    if (!Array.isArray(entries)) {
      throw new Error('Invalid JSON format: expected an array of entries');
    }

    await saveEntries(entries);
  } catch (error) {
    console.error('Failed to import entries:', error);
    throw error;
  }
};

/**
 * Get database statistics
 */
export const getDBStats = async (): Promise<{ totalEntries: number; oldestDate: string | null; newestDate: string | null }> => {
  const entries = await getAllEntries();
  
  if (entries.length === 0) {
    return {
      totalEntries: 0,
      oldestDate: null,
      newestDate: null
    };
  }

  return {
    totalEntries: entries.length,
    oldestDate: entries[entries.length - 1].date,
    newestDate: entries[0].date
  };
};
