'use strict';
const { ErrorHttp } = require('../errores');
const { ahoraUTC } = require('../tiempo');
const { hashPassword, verificarPassword, nuevoToken, hashToken } = require('../seguridad');

const DIAS_SESION = 7;
const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const publico = (u) => ({ id: Number(u.id), nombre: u.nombre, correo: u.correo, rol: u.rol, tecnicoId: u.tecnico_id || null });

function validarRegistro(b) {
  if (!b || typeof b !== 'object') throw new ErrorHttp(400, 'Cuerpo inválido');
  const errores = [];
  const nombre = String(b.nombre || '').trim().slice(0, 80);
  const correo = String(b.correo || '').trim().toLowerCase().slice(0, 120);
  const password = String(b.password || '');
  if (nombre.length < 2) errores.push('nombre: mínimo 2 caracteres');
  if (!RE_CORREO.test(correo)) errores.push('correo: inválido');
  if (password.length < 8 || password.length > 100) errores.push('password: entre 8 y 100 caracteres');
  if (errores.length) throw new ErrorHttp(400, 'Datos inválidos', errores);
  return { nombre, correo, password };
}

// Crea una sesión y devuelve el token (en la BD solo se guarda su hash)
async function crearSesion(db, usuarioId) {
  const { token, hash } = nuevoToken();
  const ahora = new Date();
  await db.ejecutar('DELETE FROM sesiones WHERE expira_en < ?', [ahoraUTC(ahora)]); // limpieza de vencidas
  await db.ejecutar('INSERT INTO sesiones (token_hash, usuario_id, creado_en, expira_en) VALUES (?,?,?,?)',
    [hash, usuarioId, ahoraUTC(ahora), ahoraUTC(new Date(ahora.getTime() + DIAS_SESION * 86400000))]);
  return token;
}

// Registro público: siempre crea un usuario con rol "usuario"
async function registrar(db, body) {
  const d = validarRegistro(body);
  let id;
  try {
    const r = await db.ejecutar(
      'INSERT INTO usuarios (nombre, correo, password_hash, rol, tecnico_id, activo, creado_en) VALUES (?,?,?,?,?,?,?)',
      [d.nombre, d.correo, hashPassword(d.password), 'usuario', null, 1, ahoraUTC()]);
    id = r.idInsertado;
  } catch (e) {
    if (/UNIQUE|ER_DUP_ENTRY/i.test(String(e.code) + e.message)) throw new ErrorHttp(409, 'Ese correo ya está registrado');
    throw e;
  }
  const [u] = await db.consultar('SELECT * FROM usuarios WHERE id = ?', [id]);
  return { token: await crearSesion(db, id), usuario: publico(u) };
}

async function login(db, body) {
  const correo = String((body && body.correo) || '').trim().toLowerCase();
  const password = String((body && body.password) || '');
  if (!correo || !password || password.length > 100) throw new ErrorHttp(400, 'Escribe tu correo y contraseña');
  const [u] = await db.consultar('SELECT * FROM usuarios WHERE correo = ?', [correo]);
  // Mismo mensaje si el correo no existe o la contraseña falla (no revela cuáles correos existen)
  const ok = u ? verificarPassword(password, u.password_hash) : (hashPassword(password), false);
  if (!ok) throw new ErrorHttp(401, 'Correo o contraseña incorrectos');
  if (Number(u.activo) !== 1) throw new ErrorHttp(403, 'Tu cuenta está desactivada. Contacta al administrador');
  return { token: await crearSesion(db, u.id), usuario: publico(u) };
}

async function logout(db, token) {
  await db.ejecutar('DELETE FROM sesiones WHERE token_hash = ?', [hashToken(token)]);
  return { cerrada: true };
}

// Devuelve el usuario dueño del token, o null si no existe / venció / está desactivado
async function usuarioPorToken(db, token) {
  if (!token || typeof token !== 'string' || token.length > 200) return null;
  const [u] = await db.consultar(
    `SELECT u.id, u.nombre, u.correo, u.rol, u.tecnico_id, u.activo
     FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token_hash = ? AND s.expira_en > ?`, [hashToken(token), ahoraUTC()]);
  return u && Number(u.activo) === 1 ? publico(u) : null;
}

module.exports = { registrar, login, logout, usuarioPorToken };