/* ==========================================================
   service-worker.js · CampusCare
   Guarda archivos en caché para que el sitio cargue más rápido
   y siga funcionando cuando no hay conexión a internet.
   ========================================================== */

// 1) Configuración
const VERSION = 'v6';                       // cambia este valor cuando agregues o quites archivos
const CACHE = `campuscare-${VERSION}`;

const ARCHIVOS = [                          // archivos que se guardan al instalar
  './',
  'index.html',
  'innovacion.html',
  'login.html',
  'admin.html',
  'offline.html',
  'manifest.json',
  'css/style.css',
  'css/login.css',
  'css/admin.css',
  'js/menu.js',
  'js/innovacion.js',
  'js/lab.js',
  'js/sw-registro.js',
  'js/config.js',
  'js/auth.js',
  'js/login.js',
  'js/admin.js',
  'js/api.js',
  'js/contacto.js',
  'img/logo.png',
  'img/icon-192.png',
  'img/icon-512.png',
  'img/icon-maskable-512.png',
  'img/icon-monochrome-512.png',
  'img/aula.jpg',
  'img/alumnos.jpg',
  'img/administracion.jpg',
  'img/mantenimiento.jpg',
  'img/app-login.png',
  'img/app-nuevo-reporte.png',
  'img/app-detalle-ticket.png',
  'img/app-seguimiento.png',
  'img/app-cierre.png',
  'img/app-calificacion.png',
  'img/app-dashboard.png',
  'img/app-zonas.png',
  'img/app-asignar.png',
  'img/icono-checklist.png',
  'img/icono-estudiante.png',
  'img/icono-red.png',
  'img/icono-titulacion.png',
  'img/icono-web.png'
];

// 2) Instalación: se guardan los archivos principales
self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.allSettled(ARCHIVOS.map((archivo) => cache.add(archivo)))
    )
  );
  self.skipWaiting();                       // activa esta versión sin esperar
});

// 3) Activación: se borran las cachés de versiones anteriores
self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre.startsWith('campuscare-') && nombre !== CACHE)
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())     // toma el control de las páginas abiertas
  );
});

// 4) Fetch: decide de dónde sale cada respuesta
self.addEventListener('fetch', (evento) => {
  const peticion = evento.request;
  const url = new URL(peticion.url);

  if (peticion.method !== 'GET') return;            // solo se guardan peticiones GET
  if (url.origin !== self.location.origin) return;  // recursos de otros sitios (p. ej. Icons8) van directo a la red
  if (url.pathname.includes('/api/')) return;       // la API (base de datos) nunca se guarda en caché
  if (peticion.headers.has('range')) return;        // audio y video se piden por partes: no se guardan

  if (peticion.mode === 'navigate') {
    evento.respondWith(redPrimero(peticion));             // páginas HTML
  } else {
    evento.respondWith(cacheConActualizacion(peticion));  // CSS, JS e imágenes
  }
});

// 5) Estrategia "red primero": si falla la red, se usa la copia guardada
async function redPrimero(peticion) {
  try {
    const respuesta = await fetch(peticion);
    if (respuesta.ok) {
      const cache = await caches.open(CACHE);
      cache.put(peticion, respuesta.clone());
    }
    return respuesta;
  } catch (error) {
    // ignoreSearch: login.html?volver=... debe encontrar la copia de login.html
    return (await caches.match(peticion, { ignoreSearch: true })) || (await caches.match('offline.html'));
  }
}

// 6) Estrategia "caché primero con actualización": responde rápido y refresca en segundo plano
async function cacheConActualizacion(peticion) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(peticion);

  const actualizacion = fetch(peticion)
    .then((respuesta) => {
      if (respuesta.ok) cache.put(peticion, respuesta.clone());
      return respuesta;
    })
    .catch(() => guardada || Response.error());

  return guardada || actualizacion;
}
