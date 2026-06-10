// Kill switch — unregister all service workers
self.addEventListener('install', () => {
  self.skipWaiting();
});
self.addEventListener('activate', () => {
  // Claim clients so this kill-switch page takes over
  clients.claim().then(() => {
    // Then unregister ourselves
    self.registration.unregister().then(() => {
      // Delete all caches
      caches.keys().then(names => {
        for (const n of names) {
          caches.delete(n);
        }
      });
    });
  });
});
