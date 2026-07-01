// CRS CRM — Background Location Service Worker
// Runs even when tab is hidden. On Android Chrome, survives tab close too.

const LOCATION_INTERVAL = 2 * 60 * 1000; // 2 minutes
let locationTimer = null;
let authToken = null;
let baseUrl = self.location.origin;

// Receive auth token + start command from main thread
self.addEventListener("message", (event) => {
  if (event.data?.type === "START_LOCATION") {
    authToken = event.data.token || null;
    baseUrl   = event.data.baseUrl || self.location.origin;
    startTracking();
  }
  if (event.data?.type === "STOP_LOCATION") {
    stopTracking();
  }
});

function startTracking() {
  if (locationTimer) return; // already running
  sendLocation(); // immediate ping
  locationTimer = setInterval(sendLocation, LOCATION_INTERVAL);
}

function stopTracking() {
  if (locationTimer) { clearInterval(locationTimer); locationTimer = null; }
}

async function sendLocation() {
  try {
    // SW cannot access navigator.geolocation directly
    // So we post message to all clients (open tabs) to get location
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (clients.length > 0) {
      // At least one tab open — ask it for location
      clients[0].postMessage({ type: "GET_LOCATION" });
    } else {
      // No tab open — use last known coords stored in SW cache
      const cache = await caches.open("crs-location-v1");
      const resp  = await cache.match("last-location");
      if (resp) {
        const { latitude, longitude, address } = await resp.json();
        await pingServer(latitude, longitude, address);
      }
    }
  } catch {}
}

// Called from main thread with fresh coords
self.addEventListener("message", async (event) => {
  if (event.data?.type === "LOCATION_DATA") {
    const { latitude, longitude, address } = event.data;
    // Cache last known location
    const cache = await caches.open("crs-location-v1");
    await cache.put("last-location", new Response(JSON.stringify({ latitude, longitude, address })));
    await pingServer(latitude, longitude, address);
  }
});

async function pingServer(latitude, longitude, address) {
  try {
    await fetch(`${baseUrl}/api/location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // sends cookies (Clerk session)
      body: JSON.stringify({ latitude, longitude, address }),
    });
  } catch {}
}

self.addEventListener("install",  () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
