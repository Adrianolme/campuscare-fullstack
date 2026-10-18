/* Cliente de la API de CampusCare (window.CampusAPI) */
(() => {
  'use strict';
  const base = String((window.CAMPUSCARE_CONFIG || {}).API_URL || '').replace(/\/+$/, '');
  const url = (ruta) => (base ? base + '/' : '') + 'api/' + ruta;
  const token = () => (window.CampusAuth ? window.CampusAuth.token() : '');

  async function pedir(metodo, ruta, cuerpo, tiempo) {
    const ctl = new AbortController();
    const t = tiempo ? setTimeout(() => ctl.abort(), tiempo) : null;
    try {
      const res = await fetch(url(ruta), {
        method: metodo,
        headers: Object.assign(
          token() ? { Authorization: 'Bearer ' + token() } : {},
          cuerpo ? { 'Content-Type': 'application/json' } : {}),
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal: ctl.signal
      });
      let datos = null;
      try { datos = await res.json(); } catch { /* respuesta sin JSON */ }
      if (!res.ok) {
        // 401 en una ruta protegida = la sesión venció: se vuelve al login
        if (res.status === 401 && !ruta.startsWith('auth/login') && window.CampusAuth) window.CampusAuth.expirar();
        const det = datos && datos.detalles ? ' (' + [].concat(datos.detalles).join('; ') + ')' : '';
        const e = new Error(((datos && datos.error) || 'Error ' + res.status) + det);
        e.estado = res.status;
        throw e;
      }
      return datos;
    } finally { if (t) clearTimeout(t); }
  }

  // API → forma que usa la interfaz
  function aFront(t) {
    return {
      folio: t.folio, desc: t.descripcion, cat: t.categoria, icono: t.icono, sev: t.severidad,
      zona: t.zona, espacio: t.espacio, ubicacion: t.ubicacion, origen: t.origen, estado: t.estado,
      fecha: t.fecha, tecnico: t.tecnico, tecnicoNombre: t.tecnicoNombre, motivo: t.motivo, mio: t.mio,
      tieneFoto: !!t.tieneFoto, foto: ''
    };
  }

  // Las fotos están protegidas: se piden con el token y se muestran como "blob"
  const fotos = new Map();
  async function cargarFoto(folio) {
    if (fotos.has(folio)) return fotos.get(folio);
    try {
      const res = await fetch(url('tickets/' + encodeURIComponent(folio) + '/foto'), { headers: { Authorization: 'Bearer ' + token() } });
      if (!res.ok) return '';
      const u = URL.createObjectURL(await res.blob());
      fotos.set(folio, u);
      return u;
    } catch { return ''; }
  }

  let inicio = null;
  function iniciar() {
    if (!inicio) {
      inicio = pedir('GET', 'health', null, 3500)
        .then((d) => ({ disponible: !!(d && d.ok), baseDeDatos: d && d.baseDeDatos }))
        .catch(() => ({ disponible: false }));
    }
    return inicio;
  }

  window.CampusAPI = {
    estadisticas: () => pedir('GET', 'estadisticas'),
    iniciar,
    cargarFoto,
    login: (correo, password) => pedir('POST', 'auth/login', { correo, password }),
    registro: (nombre, correo, password) => pedir('POST', 'auth/registro', { nombre, correo, password }),
    listarTickets: async () => (await pedir('GET', 'tickets?limite=200')).map(aFront),
    crearTicket: async (b) => aFront(await pedir('POST', 'tickets', {
      descripcion: b.desc, categoria: b.cat, severidad: b.sev, zona: b.zona, espacio: b.espacio,
      ubicacion: b.ubicacion, foto: b.foto || undefined, origen: b.origen, sensor: b.sensor
    })),
    avanzarTicket: async (folio, estado) => aFront(await pedir('PATCH', 'tickets/' + encodeURIComponent(folio) + '/estado', { estado })),
    editarTicket: async (folio, cambios) => aFront(await pedir('PATCH', 'tickets/' + encodeURIComponent(folio), cambios)),
    borrarTicket: (folio) => pedir('DELETE', 'tickets/' + encodeURIComponent(folio)),
    enviarContacto: (c) => pedir('POST', 'contacto', c)
  };
})();