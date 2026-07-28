(() => {
  let deferredPrompt = null;
  const installBtn = document.getElementById('installBtn');
  const notify = message => {
    const toast = document.getElementById('toast');
    if (!toast) return alert(message);
    toast.textContent = message;
    toast.classList.remove('hidden');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => toast.classList.add('hidden'), 3500);
  };

  const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              notify('Nueva versión disponible. Cierra y vuelve a abrir la app para actualizar.');
            }
          });
        });
      } catch (error) {
        console.warn('No se pudo registrar el Service Worker:', error);
      }
    });
  }

  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPrompt = event;
    if (installBtn && !isStandalone()) installBtn.classList.remove('hidden');
    if (installBtn) installBtn.classList.add('grid');
  });

  installBtn?.addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.classList.add('hidden');
      installBtn.classList.remove('grid');
      return;
    }
    const isiOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    notify(isiOS
      ? 'En Safari toca Compartir y luego “Agregar a pantalla de inicio”.'
      : 'Abre el menú del navegador y selecciona “Instalar aplicación”.');
  });

  window.addEventListener('appinstalled', () => {
    installBtn?.classList.add('hidden');
    notify('NuestroEspacio se instaló correctamente.');
  });

  window.addEventListener('online', () => notify('Conexión recuperada.'));
  window.addEventListener('offline', () => notify('Modo sin conexión: tus cambios seguirán guardándose en este dispositivo.'));

  if (isStandalone()) {
    installBtn?.classList.add('hidden');
  }

  const hashView = location.hash.replace('#', '');
  if (hashView) {
    setTimeout(() => document.querySelector(`[data-view="${CSS.escape(hashView)}"]`)?.click(), 350);
  }
})();
