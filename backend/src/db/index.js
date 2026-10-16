'use strict';
const config = require('../config');
const { inicializar } = require('./inicializar');

// Abre la conexión según DB_CLIENT y prepara tablas + datos de catálogo
async function abrirBD(opciones = {}) {
  const motor = opciones.motor || config.dbClient;
  let db;
  if (motor === 'sqlite') db = require('./sqlite').crear(opciones.archivo || config.sqliteArchivo);
  else if (motor === 'mysql') db = await require('./mysql').crear(opciones.mysql || config.mysql);
  else throw new Error(`DB_CLIENT desconocido: ${motor} (usa mysql o sqlite)`);
  await inicializar(db);
  return db;
}
module.exports = { abrirBD };
