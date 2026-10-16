'use strict';
// Gestión de usuarios y técnicos (solo para el administrador)
const { ErrorHttp } = require('../errores');
const { ahoraUTC, aISO } = require('../tiempo');
const { hashPassword } = require('../seguridad');
const catalogos = require('./catalogos');

const ROLES = ['admin', 'tecnico', 'usuario'];
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SELECT = `
  SELECT u.id, u.nombre, u.correo, u.rol, u.tecnico_id, u.activo, u.creado_en,
         t.nombre AS tec_nombre, t.rol AS tec_cargo
  FROM usuarios u LEFT JOIN tecnicos t ON t.id = u.tecnico_id`;

const aApi = (f) => ({
  id: Number(f.id), nombre: f.nombre, correo: f.correo, rol: f.rol,
  tecnicoId: f.tecnico_id || null,
  tecnicoNombre: f.tec_nombre ? `${f.tec_nombre} (${f.tec_cargo})` : null,
  activo: Number(f.activo) === 1,
  creadoEn: aISO(f.creado_en)
});

async function listar(db) {
  return (await db.consultar(SELECT + ' ORDER BY u.id')).map(aApi);
}

function idValido(s) {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1) throw new ErrorHttp(404, 'Usuario no encontrado');
  return n;
}
async function porId(db, id) {
  const [f] = await db.consultar(SELECT + ' WHERE u.id = ?', [id]);
  if (!f) throw new ErrorHttp(404, 'Usuario no encontrado');
  return f;
}

// El técnico debe existir y no tener ya otra cuenta
async function validarTecnicoLibre(db, tecnicoId, excluirUsuarioId = 0) {
  const [t] = await db.consultar('SELECT id FROM tecnicos WHERE id = ?', [tecnicoId]);
  if (!t) throw new ErrorHttp(400, 'tecnicoId: no existe');
  const [u] = await db.consultar('SELECT id FROM usuarios WHERE tecnico_id = ? AND id <> ?', [tecnicoId, excluirUsuarioId]);
  if (u) throw new ErrorHttp(409, 'Ese técnico ya tiene una cuenta');
}

function validarNuevoTecnico(n, cat, errores) {
  const cargo = String((n && n.cargo) || '').trim().slice(0, 60);
  if (cargo.length < 2) errores.push('nuevoTecnico.cargo: mínimo 2 caracteres');
  if (!cat.zonas.some((z) => z.id === (n && n.zona))) errores.push('nuevoTecnico.zona: no existe');
  const cats = [];
  for (const e of [].concat((n && n.especialidades) || [])) {
    const c = cat.categorias.find((x) => x.nombre === e || x.id === Number(e));
    if (!c) errores.push(`nuevoTecnico.especialidades: "${e}" no existe`); else if (!cats.includes(c.id)) cats.push(c.id);
  }
  if (!cats.length) errores.push('nuevoTecnico.especialidades: elige al menos una');
  return { cargo, zona: n && n.zona, categorias: cats };
}

async function crear(db, b) {
  if (!b || typeof b !== 'object') throw new ErrorHttp(400, 'Cuerpo inválido');
  const errores = [];
  const nombre = String(b.nombre || '').trim().slice(0, 80);
  const correo = String(b.correo || '').trim().toLowerCase().slice(0, 120);
  const password = String(b.password || '');
  const rol = b.rol || 'usuario';
  if (nombre.length < 2) errores.push('nombre: mínimo 2 caracteres');
  if (!RE_CORREO.test(correo)) errores.push('correo: inválido');
  if (password.length < 8 || password.length > 100) errores.push('password: entre 8 y 100 caracteres');
  if (!ROLES.includes(rol)) errores.push('rol: admin, tecnico o usuario');

  let tecnicoId = null, nuevo = null;
  if (rol === 'tecnico') {
    if (b.tecnicoId) tecnicoId = String(b.tecnicoId);
    else if (b.nuevoTecnico) nuevo = validarNuevoTecnico(b.nuevoTecnico, await catalogos.cargar(db), errores);
    else errores.push('tecnico: elige uno existente (tecnicoId) o crea uno nuevo (nuevoTecnico)');
  }
  if (errores.length) throw new ErrorHttp(400, 'Datos inválidos', errores);
  if (tecnicoId) await validarTecnicoLibre(db, tecnicoId);

  let id;
  try {
    id = await db.transaccion(async (tx) => {
      if (nuevo) {
        const filas = await tx.consultar('SELECT id FROM tecnicos');
        const max = filas.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/\D/g, ''), 10) || 0), 0);
        tecnicoId = 't' + (max + 1);
        await tx.ejecutar('INSERT INTO tecnicos (id, nombre, rol, zona_id) VALUES (?,?,?,?)', [tecnicoId, nombre, nuevo.cargo, nuevo.zona]);
        for (const c of nuevo.categorias) {
          await tx.ejecutar('INSERT INTO tecnico_especialidades (tecnico_id, categoria_id) VALUES (?,?)', [tecnicoId, c]);
        }
      }
      const r = await tx.ejecutar(
        'INSERT INTO usuarios (nombre, correo, password_hash, rol, tecnico_id, activo, creado_en) VALUES (?,?,?,?,?,?,?)',
        [nombre, correo, hashPassword(password), rol, tecnicoId, 1, ahoraUTC()]);
      return r.idInsertado;
    });
  } catch (e) {
    if (/UNIQUE|ER_DUP_ENTRY/i.test(String(e.code) + e.message)) throw new ErrorHttp(409, 'Ese correo ya está registrado');
    throw e;
  }
  return aApi(await porId(db, id));
}

// Cambia nombre, rol, técnico vinculado, activo o contraseña
async function actualizar(db, idTexto, b, yo) {
  const id = idValido(idTexto);
  if (!b || typeof b !== 'object') throw new ErrorHttp(400, 'Cuerpo inválido');
  const u = await porId(db, id);
  const errores = [];
  let nombre = u.nombre, rol = u.rol, tecnicoId = u.tecnico_id || null, activo = Number(u.activo) === 1, password = null;

  if (b.nombre !== undefined) { nombre = String(b.nombre).trim().slice(0, 80); if (nombre.length < 2) errores.push('nombre: mínimo 2 caracteres'); }
  if (b.rol !== undefined) { if (!ROLES.includes(b.rol)) errores.push('rol: admin, tecnico o usuario'); else rol = b.rol; }
  if (b.activo !== undefined) {
    if (b.activo === true || b.activo === 1) activo = true;
    else if (b.activo === false || b.activo === 0) activo = false;
    else errores.push('activo: true o false');
  }
  if (b.tecnicoId !== undefined) tecnicoId = b.tecnicoId ? String(b.tecnicoId) : null;
  if (b.password !== undefined) {
    password = String(b.password);
    if (password.length < 8 || password.length > 100) errores.push('password: entre 8 y 100 caracteres');
  }
  if (errores.length) throw new ErrorHttp(400, 'Datos inválidos', errores);

  if (rol !== 'tecnico') tecnicoId = null;
  else {
    if (!tecnicoId) throw new ErrorHttp(400, 'Un técnico necesita un tecnicoId');
    await validarTecnicoLibre(db, tecnicoId, id);
  }

  // Protecciones
  if (id === yo.id && (rol !== u.rol || !activo)) throw new ErrorHttp(409, 'No puedes cambiar tu propio rol ni desactivar tu cuenta');
  const eraAdminActivo = u.rol === 'admin' && Number(u.activo) === 1;
  if (eraAdminActivo && !(rol === 'admin' && activo)) {
    const [{ n }] = await db.consultar("SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'admin' AND activo = 1 AND id <> ?", [id]);
    if (Number(n) === 0) throw new ErrorHttp(409, 'Debe quedar al menos un administrador activo');
  }

  const sets = ['nombre = ?', 'rol = ?', 'tecnico_id = ?', 'activo = ?'];
  const vals = [nombre, rol, tecnicoId, activo ? 1 : 0];
  if (password !== null) { sets.push('password_hash = ?'); vals.push(hashPassword(password)); }
  await db.ejecutar(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = ?`, [...vals, id]);
  // Si se desactiva o cambia la contraseña, se cierran sus sesiones abiertas
  if (password !== null || !activo) await db.ejecutar('DELETE FROM sesiones WHERE usuario_id = ?', [id]);
  return aApi(await porId(db, id));
}

module.exports = { listar, crear, actualizar };