'use strict';
const fs = require('fs');
const path = require('path');
const datos = require('./datos-iniciales');
const { hashPassword } = require('../seguridad');
const { ahoraUTC } = require('../tiempo');

function sentencias(db) {
  const archivo = path.join(__dirname, db.dialecto === 'mysql' ? 'schema.mysql.sql' : 'schema.sqlite.sql');
  return fs.readFileSync(archivo, 'utf8')
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.split(/\r?\n/).filter(l => !l.trim().startsWith('--')).join('\n').trim())
    .filter(Boolean);
}

// Catálogos: zonas, categorías y técnicos (solo la primera vez)
async function cargarCatalogos(db) {
  const [{ n }] = await db.consultar('SELECT COUNT(*) AS n FROM zonas');
  if (Number(n) > 0) return;
  await db.transaccion(async tx => {
    for (const z of datos.ZONAS) await tx.ejecutar('INSERT INTO zonas (id,nombre,pos_x,pos_y) VALUES (?,?,?,?)', z);
    for (const c of datos.CATEGORIAS) await tx.ejecutar('INSERT INTO categorias (nombre,icono) VALUES (?,?)', c);
    for (const [id, nombre, rol, zona, esp] of datos.TECNICOS) {
      await tx.ejecutar('INSERT INTO tecnicos (id,nombre,rol,zona_id) VALUES (?,?,?,?)', [id, nombre, rol, zona]);
      for (const e of esp) {
        const [c] = await tx.consultar('SELECT id FROM categorias WHERE nombre = ?', [e]);
        await tx.ejecutar('INSERT INTO tecnico_especialidades (tecnico_id,categoria_id) VALUES (?,?)', [id, c.id]);
      }
    }
  });
}

// Cuentas iniciales (solo si la tabla usuarios está vacía):
//   - 1 administrador (correo y contraseña desde .env: ADMIN_CORREO / ADMIN_PASSWORD)
//   - 1 cuenta por cada técnico del catálogo (contraseña: TECNICO_PASSWORD)
// ¡Cambia estas contraseñas de ejemplo antes de publicar el proyecto!
async function cargarUsuarios(db) {
  const [{ n }] = await db.consultar('SELECT COUNT(*) AS n FROM usuarios');
  if (Number(n) > 0) return;
  const ahora = ahoraUTC();
  const correoAdmin = (process.env.ADMIN_CORREO || 'admin@campuscare.mx').toLowerCase();
  const passAdmin = process.env.ADMIN_PASSWORD || 'Admin123!';
  const passTec = process.env.TECNICO_PASSWORD || 'Tecnico123!';
  await db.transaccion(async tx => {
    await tx.ejecutar(
      'INSERT INTO usuarios (nombre,correo,password_hash,rol,tecnico_id,activo,creado_en) VALUES (?,?,?,?,?,?,?)',
      ['Administrador', correoAdmin, hashPassword(passAdmin), 'admin', null, 1, ahora]);
    for (const [id, nombre] of datos.TECNICOS) {
      const correo = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '@campuscare.mx';
      await tx.ejecutar(
        'INSERT INTO usuarios (nombre,correo,password_hash,rol,tecnico_id,activo,creado_en) VALUES (?,?,?,?,?,?,?)',
        [nombre, correo, hashPassword(passTec), 'tecnico', id, 1, ahora]);
    }
  });
}

async function inicializar(db) {
  for (const sql of sentencias(db)) await db.ddl(sql);
  await cargarCatalogos(db);
  await cargarUsuarios(db);
}
module.exports = { inicializar, sentencias };