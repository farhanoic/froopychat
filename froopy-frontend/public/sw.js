// Froopy Chat Service Worker v1.0
const CACHE_NAME = 'froopy-chat-v1';

// Install event - happens once when SW is first registered
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  // Force the waiting service worker to become active
  self.skipWaiting();
});

// Activate event - happens when SW takes control
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activated');
  // Take control of all pages immediately
  event.waitUntil(clients.claim());
});

// Fetch event - for now, just pass through all requests
self.addEventListener('fetch', (event) => {
  // Don't cache anything yet - just fetch normally
  event.respondWith(fetch(event.request));
});