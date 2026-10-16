/* Sesión de CampusCare (window.CampusAuth)
   Se carga en el <head> de cada página protegida: si no hay sesión, manda a login.html. */
(() => {
  'use strict';
  const KEY = 'campuscare.sesion.v1';
  const base = String((window.CAMPUSCARE_CONFIG || {}).API_URL || '').replace(/\/+$/, '');
  const api = (ruta) => (base ? base + '/' : '') + 'api/' + ruta;
  const ROLES = { admin: 'Administrador', tecnico: 'Técnico', usuario: 'Usuario' };

  let memoria = null;                       // respaldo si localStorage no está disponible
  function leer() {
    try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return memoria; }
  }
  function guardar(sesion) {
    memoria = sesion;
    try { localStorage.setItem(KEY, JSON.stringify(sesion)); } catch { /* se queda en memoria */ }
  }
  function borrar() {
    memoria = null;
    try { localStorage.removeItem(KEY); } catch { /* ignorar */ }
  }

  const pagina = () => (location.pathname.split('/').pop() || 'index.html') + location.hash;
  function irALogin() {
    location.replace('login.html?volver=' + encodeURIComponent(pagina()));
  }

  // --- Acceso sin internet ---
  // Tras un login correcto con servidor se guarda en ESTE dispositivo un verificador de la
  // contraseña (PBKDF2 + sal aleatoria, nunca la contraseña). Sin conexión se compara contra él.
  const KEY_OFF = 'campuscare.offline.v1';
  const hex = (b) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
  const deHex = (h) => new Uint8Array(h.match(/../g).map((x) => parseInt(x, 16)));
  async function derivar(password, sal) {
    if (!(window.crypto && crypto.subtle)) throw new Error('Este navegador no permite guardar el acceso sin conexión (se requiere https o localhost).');
    const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: sal, iterations: 150000 }, llave, 256));
  }
  const leerOff = () => { try { return JSON.parse(localStorage.getItem(KEY_OFF)) || {}; } catch { return {}; } };
  async function recordarOffline(correo, password, usuario) {
    try {
      const sal = crypto.getRandomValues(new Uint8Array(16));
      const todos = leerOff();
      todos[String(correo).trim().toLowerCase()] = { sal: hex(sal), hash: await derivar(password, sal), usuario };
      localStorage.setItem(KEY_OFF, JSON.stringify(todos));
    } catch { /* sin crypto/storage: simplemente no habrá acceso offline */ }
  }
  async function entrarOffline(correo, password) {
    const reg = leerOff()[String(correo).trim().toLowerCase()];
    if (!reg) throw new Error('Sin conexión: esta cuenta aún no se ha usado en este dispositivo. Inicia sesión una vez con internet.');
    if ((await derivar(password, deHex(reg.sal))) !== reg.hash) throw new Error('Correo o contraseña incorrectos.');
    return { token: 'offline', usuario: reg.usuario };   // al volver la red, el servidor la valida o pide login
  }

  const Auth = {
    ROLES,
    recordarOffline,
    entrarOffline,
    sesion: leer,
    token: () => (leer() || {}).token || '',
    usuario: () => (leer() || {}).usuario || null,
    guardar,
    // ¿El servidor acepta el token guardado?
    validar: () => fetch(api('auth/yo'), { headers: { Authorization: 'Bearer ' + Auth.token() } }).then((r) => r.ok).catch(() => false),
    // Sesión vencida o rechazada por el servidor
    expirar() { borrar(); irALogin(); },
    async salir() {
      const t = Auth.token();
      if (t) { try { await fetch(api('auth/logout'), { method: 'POST', headers: { Authorization: 'Bearer ' + t } }); } catch { /* sin conexión */ } }
      borrar();
      location.replace('login.html');
    }
  };
  window.CampusAuth = Auth;

  // Esta página no se protege (login.html se marca con <html data-publica>)
  if (document.documentElement.hasAttribute('data-publica')) return;

  // 1) Sin sesión → al login (antes de mostrar la página)
  if (!Auth.token()) { irALogin(); return; }

  // 2) Con sesión: se oculta la página un instante mientras el servidor confirma el token
  const html = document.documentElement;
  html.classList.add('validando');
  const mostrar = () => html.classList.remove('validando');
  const respaldo = setTimeout(mostrar, 4000);

  fetch(api('auth/yo'), { headers: { Authorization: 'Bearer ' + Auth.token() } })
    .then(async (r) => {
      if (r.status === 401) { Auth.expirar(); return; }          // token vencido o falso
      if (r.ok) { const d = await r.json(); guardar({ token: Auth.token(), usuario: d.usuario }); }
      mostrar();
    })
    .catch(mostrar)                                              // sin servidor (modo sin conexión): se deja pasar
    .finally(() => clearTimeout(respaldo));

  // 3) Nombre del usuario y botón "Salir" dentro del menú
  document.addEventListener('DOMContentLoaded', () => {
    const lista = document.querySelector('#menu ul');
    const u = Auth.usuario();
    if (!lista || !u) return;
    const li = document.createElement('li');
    li.className = 'usuario-menu';
    const quien = document.createElement('span');
    quien.textContent = `👤 ${u.nombre} · ${ROLES[u.rol] || u.rol}`;
    const salir = document.createElement('a');
    salir.href = 'login.html';
    salir.id = 'btn-salir';
    salir.textContent = 'Salir';
    salir.addEventListener('click', (e) => { e.preventDefault(); Auth.salir(); });
        li.append(quien, ' ', salir);
    if (u.rol === 'admin') {   // enlace al panel de administración (solo para el admin)
      const enlace = document.createElement('li');
      const a = document.createElement('a');
      a.href = 'admin.html';
      a.textContent = '👥 Usuarios';
      enlace.append(a);
      lista.append(enlace);
    }
    lista.append(li);
  });
})();