// Service worker : rend l'application installable et rapide à ouvrir.
// Si tu modifies des fichiers, change le numéro de version ci-dessous.
const VERSION = "nettoyage-v1";
const FICHIERS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./textes.js",
  "./config.js",
  "./manifest.json",
  "./icones/residents-192.png",
  "./icones/residents-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Réseau d'abord (toujours la dernière version), copie locale en secours.
// Les vidéos et Supabase ne passent pas par le cache.
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin || url.pathname.includes("/videos/")) return;
  e.respondWith(
    fetch(e.request)
      .then((rep) => {
        const copie = rep.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copie));
        return rep;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
