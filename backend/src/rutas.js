'use strict';
// Tabla de rutas: independiente de Express. Cada manejador recibe {db, params, query, body, clienteId, usuario}
// y devuelve {estado, cuerpo} o {estado, binario, tipo}.
//   roles: undefined → ruta pública | [] → cualquier usuario con sesión | ['admin', ...] → solo esos roles
const { ErrorHttp } = require('./errores');
const { validarTicket, validarEdicion, validarContacto } = require('./validar');
const catalogos = require('./servicios/catalogos');
const tickets = require('./servicios/tickets');
const contacto = require('./servicios/contacto');
const auth = require('./servicios/auth');
const usuarios = require('./servicios/usuarios');

const rutas = [
  { metodo: 'GET', ruta: '/api/health', manejador: async ({ db }) => {
      await db.consultar('SELECT 1 AS ok');
      return { estado: 200, cuerpo: { ok: true, baseDeDatos: db.dialecto } };
  } },

  // ----- Autenticación -----
  { metodo: 'POST', ruta: '/api/auth/registro', manejador: async ({ db, body }) =>
      ({ estado: 201, cuerpo: await auth.registrar(db, body) }) },
  { metodo: 'POST', ruta: '/api/auth/login', manejador: async ({ db, body }) =>
      ({ estado: 200, cuerpo: await auth.login(db, body) }) },
  { metodo: 'POST', ruta: '/api/auth/logout', roles: [], manejador: async ({ db, token }) =>
      ({ estado: 200, cuerpo: await auth.logout(db, token) }) },
  { metodo: 'GET', ruta: '/api/auth/yo', roles: [], manejador: async ({ usuario }) =>
      ({ estado: 200, cuerpo: { usuario } }) },

  // ----- Administración de usuarios (solo admin) -----
  { metodo: 'GET', ruta: '/api/admin/usuarios', roles: ['admin'], manejador: async ({ db }) =>
      ({ estado: 200, cuerpo: await usuarios.listar(db) }) },
  { metodo: 'POST', ruta: '/api/admin/usuarios', roles: ['admin'], manejador: async ({ db, body }) =>
      ({ estado: 201, cuerpo: await usuarios.crear(db, body) }) },
  { metodo: 'PATCH', ruta: '/api/admin/usuarios/:id', roles: ['admin'], manejador: async ({ db, params, body, usuario }) =>
      ({ estado: 200, cuerpo: await usuarios.actualizar(db, params.id, body, usuario) }) },

  // ----- Catálogos, tickets, estadísticas y contacto (todos requieren sesión) -----
  { metodo: 'GET', ruta: '/api/catalogos', roles: [], manejador: async ({ db }) => ({ estado: 200, cuerpo: await catalogos.cargar(db) }) },

  // Cada rol ve lo suyo: admin todos, técnico los asignados, usuario los que creó
  { metodo: 'GET', ruta: '/api/tickets', roles: [], manejador: async ({ db, query, clienteId, usuario }) =>
      ({ estado: 200, cuerpo: await tickets.listar(db, query, clienteId, alcanceDe(usuario)) }) },
  { metodo: 'POST', ruta: '/api/tickets', roles: [], manejador: async ({ db, body, clienteId }) => {
      const datos = validarTicket(body, await catalogos.cargar(db));
      return { estado: 201, cuerpo: await tickets.crear(db, datos, clienteId) };
  } },
  { metodo: 'GET', ruta: '/api/tickets/:folio', roles: [], manejador: async ({ db, params, clienteId, usuario }) => {
      await tickets.acceso(db, params.folio, usuario);
      return { estado: 200, cuerpo: await tickets.obtener(db, params.folio, clienteId) };
  } },
  { metodo: 'GET', ruta: '/api/tickets/:folio/foto', roles: [], manejador: async ({ db, params, usuario }) => {
      await tickets.acceso(db, params.folio, usuario);
      return { estado: 200, binario: await tickets.foto(db, params.folio), tipo: 'image/jpeg' };
  } },
  { metodo: 'GET', ruta: '/api/tickets/:folio/historial', roles: [], manejador: async ({ db, params, usuario }) => {
      await tickets.acceso(db, params.folio, usuario);
      return { estado: 200, cuerpo: await tickets.historial(db, params.folio) };
  } },
  // Edita el reporte: su dueño, el técnico asignado o el admin
  { metodo: 'PATCH', ruta: '/api/tickets/:folio', roles: [], manejador: async ({ db, params, body, clienteId, usuario }) => {
      await tickets.acceso(db, params.folio, usuario);
      return { estado: 200, cuerpo: await tickets.editar(db, params.folio, validarEdicion(body), clienteId) };
  } },
  // Solo el técnico asignado o el admin avanzan el estado
  { metodo: 'PATCH', ruta: '/api/tickets/:folio/estado', roles: ['tecnico', 'admin'], manejador: async ({ db, params, body, clienteId, usuario }) => {
      await tickets.acceso(db, params.folio, usuario, true);
      return { estado: 200, cuerpo: await tickets.avanzar(db, params.folio, body && body.estado, clienteId) };
  } },
  // Borra el dueño (usuario) o el admin
  { metodo: 'DELETE', ruta: '/api/tickets/:folio', roles: ['usuario', 'admin'], manejador: async ({ db, params, clienteId, usuario }) =>
      ({ estado: 200, cuerpo: await tickets.borrar(db, params.folio, clienteId, usuario.rol === 'admin') }) },
  { metodo: 'GET', ruta: '/api/estadisticas', roles: [], manejador: async ({ db }) => ({ estado: 200, cuerpo: await tickets.estadisticas(db) }) },
  { metodo: 'POST', ruta: '/api/contacto', roles: [], manejador: async ({ db, body }) =>
      ({ estado: 201, cuerpo: await contacto.guardar(db, validarContacto(body)) }) }
];

// Qué tickets puede listar cada rol
function alcanceDe(u) {
  if (u.rol === 'admin') return {};
  if (u.rol === 'tecnico') return { tecnicoId: u.tecnicoId || '__ninguno__' };
  return { clienteId: 'u' + u.id };
}

// Busca la ruta que coincide con método + ruta; devuelve {manejador, roles, params} o null
function buscar(metodo, ruta) {
  const partes = ruta.split('/').filter(Boolean);
  for (const r of rutas) {
    if (r.metodo !== metodo) continue;
    const pr = r.ruta.split('/').filter(Boolean);
    if (pr.length !== partes.length) continue;
    const params = {};
    let ok = true;
    pr.forEach((seg, i) => {
      if (seg.startsWith(':')) { try { params[seg.slice(1)] = decodeURIComponent(partes[i]); } catch { ok = false; } }
      else if (seg !== partes[i]) ok = false;
    });
    if (ok) return { manejador: r.manejador, roles: r.roles, params };
  }
  return null;
}
const rutaExiste = ruta => ['GET', 'POST', 'PATCH', 'DELETE'].some(m => buscar(m, ruta));

// Ejecuta una ruta: comprueba sesión y rol, y convierte errores en respuestas {estado, cuerpo}
async function ejecutar(db, { metodo, ruta, query = {}, body, token }) {
  const r = buscar(metodo, ruta);
  if (!r) {
    return rutaExiste(ruta)
      ? { estado: 405, cuerpo: { error: 'Método no permitido' } }
      : { estado: 404, cuerpo: { error: 'Ruta no encontrada' } };
  }
  try {
    let usuario = null;
    if (r.roles !== undefined) {
      usuario = await auth.usuarioPorToken(db, token);
      if (!usuario) throw new ErrorHttp(401, 'Debes iniciar sesión');
      if (r.roles.length && !r.roles.includes(usuario.rol)) throw new ErrorHttp(403, 'No tienes permiso para esta acción');
    }
    // El dueño de un reporte se identifica por la sesión (ya no por X-Cliente-Id): 'u' + id del usuario
    const clienteId = usuario ? 'u' + usuario.id : '';
    return await r.manejador({ db, params: r.params, query, body, clienteId, usuario, token });
  } catch (e) {
    if (e instanceof ErrorHttp) return { estado: e.estado, cuerpo: { error: e.message, detalles: e.detalles } };
    console.error('[error]', e);
    return { estado: 500, cuerpo: { error: 'Error interno del servidor' } };
  }
}

module.exports = { rutas, buscar, ejecutar };