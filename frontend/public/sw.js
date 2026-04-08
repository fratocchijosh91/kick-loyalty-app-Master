/**
 * KickLoyalty Service Worker
 * Phase 5 - PWA Support with offline capabilities
 * 
 * Features:
 * - Static asset caching
 * - API response caching for offline access
 * - Background sync for offline actions
 * - Push notification handling
 */

const CACHE_NAME = 'kickloyalty-v1';
const STATIC_CACHE = 'kickloyalty-static-v1';
const API_CACHE = 'kickloyalty-api-v1';

// Static assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/offline.html',
  '/src/main.jsx',
  '/src/App.jsx'
];

// API endpoints that can be cached
const CACHEABLE_API_ENDPOINTS = [
  '/api/mobile/dashboard',
  '/api/mobile/sync',
  '/api/rewards',
  '/api/mobile/rewards/nearby'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Skip waiting');
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error('[SW] Install failed:', err);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('kickloyalty-') && 
                     name !== STATIC_CACHE && 
                     name !== API_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and browser extensions
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleAPIRequest(request));
    return;
  }
  
  // Handle static assets
  if (isStaticAsset(url.pathname)) {
    event.respondWith(handleStaticRequest(request));
    return;
  }
  
  // Default: network first with cache fallback
  event.respondWith(
    fetch(request)
      .catch(() => caches.match(request))
  );
});

// API request handler with caching strategy
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  
  // Check if this endpoint should be cached
  const shouldCache = CACHEABLE_API_ENDPOINTS.some(endpoint => 
    url.pathname.includes(endpoint)
  );
  
  if (!shouldCache) {
    // Don't cache, just fetch
    try {
      return await fetch(request);
    } catch (error) {
      // Return offline response for API
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Offline - Please check your connection',
          offline: true 
        }),
        { 
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }
  
  // Try network first, then cache
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Add header to indicate cached response
      const headers = new Headers(cachedResponse.headers);
      headers.set('X-Cached', 'true');
      headers.set('X-Cached-Time', new Date().toISOString());
      
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers
      });
    }
    
    // No cache available
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Offline - No cached data available',
        offline: true 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Static asset handler - cache first
async function handleStaticRequest(request) {
  const cached = await caches.match(request);
  
  if (cached) {
    return cached;
  }
  
  try {
    const response = await fetch(request);
    
    if (response.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, response.clone());
    }
    
    return response;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      return caches.match('/offline.html');
    }
    
    throw error;
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = [
    '.js', '.jsx', '.css', '.png', '.jpg', '.jpeg', 
    '.gif', '.svg', '.ico', '.woff', '.woff2', 
    '.ttf', '.eot', '.json'
  ];
  
  return staticExtensions.some(ext => pathname.endsWith(ext));
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-offline-actions') {
    event.waitUntil(syncOfflineActions());
  }
});

// Sync offline actions with server
async function syncOfflineActions() {
  try {
    const db = await openDB('kickloyalty-offline', 1);
    const actions = await db.getAll('actions');
    
    if (actions.length === 0) return;
    
    // Send batched actions to server
    const response = await fetch('/api/mobile/sync/offline-actions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await getAuthToken()}`
      },
      body: JSON.stringify({ actions })
    });
    
    if (response.ok) {
      const result = await response.json();
      
      // Clear successfully synced actions
      const tx = db.transaction('actions', 'readwrite');
      for (const actionResult of result.results) {
        if (actionResult.status === 'success') {
          await tx.store.delete(actionResult.clientId);
        }
      }
      await tx.done;
      
      // Notify clients
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          processed: result.processed
        });
      });
    }
  } catch (error) {
    console.error('[SW] Sync failed:', error);
  }
}

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push received:', event);
  
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = {
      title: 'KickLoyalty',
      body: event.data.text(),
      icon: '/icons/icon-192x192.png'
    };
  }
  
  const options = {
    body: data.body || data.message || 'New notification',
    icon: data.icon || '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: data.tag || 'default',
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    requireInteraction: data.requireInteraction || false,
    vibrate: [200, 100, 200]
  };
  
  event.waitUntil(
    self.registration.showNotification(
      data.title || 'KickLoyalty',
      options
    )
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click:', event);
  
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data;
  
  if (action === 'dismiss') {
    return;
  }
  
  // Default action: open app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window
        const url = notificationData.url || '/';
        return self.clients.openWindow(url);
      })
  );
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_ASSETS') {
    cacheAssets(event.data.assets);
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    clearCache();
  }
});

// Helper: Cache additional assets
async function cacheAssets(assets) {
  const cache = await caches.open(STATIC_CACHE);
  await cache.addAll(assets);
}

// Helper: Clear all caches
async function clearCache() {
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}

// Helper: Open IndexedDB
function openDB(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'clientId' });
      }
    };
  });
}

// Helper: Get auth token from IndexedDB
async function getAuthToken() {
  try {
    const db = await openDB('kickloyalty-auth', 1);
    const tx = db.transaction('tokens', 'readonly');
    const store = tx.objectStore('tokens');
    const token = await store.get('authToken');
    return token?.value;
  } catch (e) {
    return null;
  }
}

console.log('[SW] Service Worker loaded');
