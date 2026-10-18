/* Modo sin conexión de los tickets (window.CampusOffline)
   - Guarda en el dispositivo la ÚLTIMA lista de tickets (y estadísticas) de cada usuario.
   - Guarda una COLA de cambios hechos sin internet (crear, avanzar estado, editar, borrar)
     para enviarlos al servidor cuando vuelva la conexión.
   Todo va por usuario (clave con su id), así que dos cuentas en el mismo equipo no se mezclan. */
(() => {
  'use strict';
  const A = window.CampusAuth;
  const uid = () => { const u = A && A.usuario && A.usuario(); return u ? u.id : 'anon'; };
  const K_CACHE = () => 'campuscare.cache.tickets.v1.' + uid();
  const K_COLA = () => 'campuscare.cola.v1.' + uid();

  let memoria = {};   // respaldo si localStorage falla (o se llena)
  const leer = (k, def) => {
    try { const r = localStorage.getItem(k); return r ? JSON.parse(r) : def; } catch { return k in memoria ? memoria[k] : def; }
  };
  const escribir = (k, v) => {
    try { localStorage.setItem(k, JSON.stringify(v)); delete memoria[k]; } catch { memoria[k] = v; }
  };

  const idOp = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID() : 'op' + Date.now() + Math.random().toString(16).slice(2));
  const esLocal = (folio) => String(folio).startsWith('LOCAL-');
  // Un error SIN código HTTP es un fallo de red (el servidor no respondió); con código = el servidor lo rechazó
  const esRed = (e) => !e || e.estado === undefined;

  // ---- Última lista conocida ----
  const guardarCache = (lista, stats) => escribir(K_CACHE(), { lista, stats, ts: Date.now() });
  const leerCache = () => leer(K_CACHE(), null);

  // ---- Cola de cambios pendientes ----
  const cola = () => leer(K_COLA(), []);
  const guardarCola = (c) => escribir(K_COLA(), c);
  const encolar = (op) => { const c = cola(); op.id = idOp(); op.ts = Date.now(); c.push(op); guardarCola(c); return op; };
  const quitar = (id) => guardarCola(cola().filter((o) => o.id !== id));
  const pendientes = () => cola().length;
  const foliosPendientes = () => new Set(cola().map((o) => o.folio));

  function folioLocal() {
    const n = leer('campuscare.cola.contador.v1', 0) + 1;
    escribir('campuscare.cola.contador.v1', n);
    return 'LOCAL-' + String(n).padStart(4, '0');
  }

  // Edición de un ticket que aún no se ha enviado: se fusiona dentro de su "crear"
  function fusionarCrear(folio, c) {
    const lista = cola();
    const op = lista.find((o) => o.tipo === 'crear' && o.folio === folio);
    if (!op) return false;
    if (c.descripcion !== undefined) op.datos.desc = op.ticket.desc = c.descripcion;
    if (c.severidad !== undefined) op.datos.sev = op.ticket.sev = c.severidad;
    if (c.espacio !== undefined) op.datos.espacio = op.ticket.espacio = c.espacio;
    if (c.ubicacion !== undefined) op.datos.ubicacion = op.ticket.ubicacion = c.ubicacion;
    guardarCola(lista);
    return true;
  }
  function encolarEditar(folio, cambios) {
    const lista = cola();
    const previa = lista.find((o) => o.tipo === 'editar' && o.folio === folio);
    if (previa) { Object.assign(previa.cambios, cambios); guardarCola(lista); return; }
    encolar({ tipo: 'editar', folio, cambios: Object.assign({}, cambios), etiqueta: 'Editar ' + folio });
  }
  function encolarBorrar(folio) {
    guardarCola(cola().filter((o) => o.folio !== folio));   // sus cambios previos ya no importan
    encolar({ tipo: 'borrar', folio, etiqueta: 'Eliminar ' + folio });
  }
  function quitarCrear(folio) { guardarCola(cola().filter((o) => !(o.tipo === 'crear' && o.folio === folio))); }

  // Lista del servidor + cambios pendientes aplicados encima (lo que ve la persona)
  function aplicar(base, ops) {
    let lista = (base || []).map((t) => Object.assign({}, t));
    const nuevos = [];
    for (const op of ops || cola()) {
      if (op.tipo === 'crear') { nuevos.unshift(Object.assign({}, op.ticket)); continue; }
      if (op.tipo === 'borrar') { lista = lista.filter((t) => t.folio !== op.folio); continue; }
      const t = lista.find((x) => x.folio === op.folio);
      if (!t) continue;
      if (op.tipo === 'estado') t.estado = op.estado;
      if (op.tipo === 'editar') {
        const c = op.cambios;
        if (c.descripcion !== undefined) t.desc = c.descripcion;
        if (c.severidad !== undefined) t.sev = c.severidad;
        if (c.espacio !== undefined) t.espacio = c.espacio;
        if (c.ubicacion !== undefined) t.ubicacion = c.ubicacion;
      }
    }
    return nuevos.concat(lista);
  }

  window.CampusOffline = {
    esLocal, esRed, guardarCache, leerCache, cola, encolar, quitar, pendientes, foliosPendientes,
    folioLocal, fusionarCrear, encolarEditar, encolarBorrar, quitarCrear, aplicar
  };
})();
