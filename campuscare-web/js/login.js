/* login.html: iniciar sesión y crear cuenta */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const API = window.CampusAPI, Auth = window.CampusAuth;

  // A dónde volver después de entrar (solo páginas propias, evita redirecciones a otros sitios)
  function destino() {
    const v = new URLSearchParams(location.search).get('volver') || '';
    return /^[A-Za-z0-9_-]+\.html(#[\w-]*)?$/.test(v) ? v : 'index.html';
  }

  // Si ya hay sesión válida, no se pide de nuevo. Sin red se confía en la sesión guardada.
  if (Auth.token()) {
    if (!navigator.onLine) location.replace(destino());
    else Auth.validar().then((ok) => { if (ok) location.replace(destino()); });
  }

  // Pestañas
  const pestanas = { entrar: $('pestana-entrar'), crear: $('pestana-crear') };
  const paneles = { entrar: $('form-login'), crear: $('form-registro') };
  function mostrar(cual) {
    Object.keys(paneles).forEach((k) => {
      paneles[k].hidden = k !== cual;
      pestanas[k].setAttribute('aria-selected', String(k === cual));
    });
    $('msg-login').textContent = '';
  }
  pestanas.entrar.addEventListener('click', () => mostrar('entrar'));
  pestanas.crear.addEventListener('click', () => mostrar('crear'));

  // accionOffline solo existe para el login (el registro de cuentas nuevas sí exige servidor)
  async function enviar(form, boton, accion, accionOffline, password) {
    const msg = $('msg-login');
    msg.textContent = 'Un momento...';
    boton.disabled = true;
    try {
      const est = navigator.onLine ? await API.iniciar() : { disponible: false };
      let r;
      if (est.disponible) {
        r = await accion();
        await Auth.recordarOffline(r.usuario.correo, password, r.usuario);   // para poder entrar sin internet después
      } else if (accionOffline) {
        r = await accionOffline();
      } else {
        throw new Error('No hay conexión con el servidor. Para crear una cuenta necesitas internet.');
      }
      Auth.guardar({ token: r.token, usuario: r.usuario });
      location.replace(destino());
    } catch (e) {
      msg.textContent = '⚠️ ' + e.message;
      boton.disabled = false;
    }
  }

  paneles.entrar.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    enviar(f, f.querySelector('button[type=submit]'), () => API.login(f.correo.value, f.password.value),
      () => Auth.entrarOffline(f.correo.value, f.password.value), f.password.value);
  });
  paneles.crear.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.password.value !== f.password2.value) { $('msg-login').textContent = '⚠️ Las contraseñas no coinciden.'; return; }
    enviar(f, f.querySelector('button[type=submit]'), () => API.registro(f.nombre.value, f.correo.value, f.password.value), null, f.password.value);
  });

  // --- Estado de red y de la caché (para comprobar que funciona sin internet) ---
  const caja = $('estado-cache');
  async function diagnostico() {
    const on = navigator.onLine;
    $('d-red').textContent = on ? 'En línea' : 'Sin conexión';
    $('estado-red').textContent = on ? '● En línea' : '● Sin conexión';
    $('estado-red').className = 'estado-red ' + (on ? 'on' : 'off');
    if (!('serviceWorker' in navigator)) { $('d-sw').textContent = 'No soportado'; return; }
    const reg = await navigator.serviceWorker.getRegistration();
    $('d-sw').textContent = reg && reg.active ? 'Activo ✅' : (reg ? 'Instalando…' : 'No registrado ❌');
    if (!('caches' in window)) return;
    const nombres = (await caches.keys()).filter((n) => n.startsWith('campuscare-'));
    let total = 0;
    for (const n of nombres) total += (await (await caches.open(n)).keys()).length;
    $('d-cache').textContent = nombres.length ? `${nombres.join(', ')} · ${total} archivos` : 'Vacía';
    $('d-login').textContent = (await caches.match('login.html')) ? 'Sí ✅' : 'No (recarga con internet)';
    let n = 0; try { n = Object.keys(JSON.parse(localStorage.getItem('campuscare.offline.v1')) || {}).length; } catch { /* nada */ }
    $('d-offline').textContent = n ? 'Sí ✅ (ya puedes entrar sin internet)' : 'No (inicia sesión una vez con internet)';
  }
  if (caja) {
    window.addEventListener('online', diagnostico);
    window.addEventListener('offline', diagnostico);
    diagnostico();
    setTimeout(diagnostico, 2500);   // el service worker termina de instalarse un instante después
  }
})();
