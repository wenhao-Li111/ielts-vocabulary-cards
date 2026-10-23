(() => {
  if (location.protocol === 'https:' && !window.AndroidBackup && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
})();
