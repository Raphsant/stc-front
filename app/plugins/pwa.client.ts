// Registra el service worker que hace la app instalable (ver public/sw.js).
// Solo en producción: en desarrollo los recursos de /_nuxt/ no llevan hash y
// un SW con caché rompería el HMR, así que además se limpia cualquiera previo.
export default defineNuxtPlugin(() => {
  if (!('serviceWorker' in navigator)) return

  if (import.meta.dev) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => r.unregister()))
      .catch(() => {})
    return
  }

  const { public: { appVersion } } = useRuntimeConfig()
  const register = () => {
    navigator.serviceWorker
      .register(`/sw.js?v=${encodeURIComponent(String(appVersion))}`, { scope: '/' })
      .catch(err => console.warn('[pwa] No se pudo registrar el service worker', err))
  }

  // Tras la carga, para no competir con la hidratación.
  if (document.readyState === 'complete') register()
  else window.addEventListener('load', register, { once: true })
})
