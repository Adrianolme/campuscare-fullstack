'use strict';
// Lector mínimo de .env (sin dependencias): líneas CLAVE=valor
const fs = require('fs');
const path = require('path');

function cargarEnv(archivo) {
  let texto;
  try { texto = fs.readFileSync(archivo, 'utf8'); } catch { return; }
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!m || linea.trim().startsWith('#')) continue;
    let v = m[2];
    if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
}
cargarEnv(path.join(__dirname, '..', '.env'));

const e = process.env;
module.exports = {
  puerto: parseInt(e.PORT, 10) || 3000,
  dbClient: (e.DB_CLIENT || 'mysql').toLowerCase(),
  mysql: {
    host: e.DB_HOST || 'localhost',
    port: parseInt(e.DB_PORT, 10) || 3306,
    user: e.DB_USER || 'root',
    password: e.DB_PASSWORD || '',
    database: e.DB_NAME || 'campuscare'
  },
  sqliteArchivo: path.resolve(__dirname, '..', e.SQLITE_FILE || './database/campuscare.sqlite'),
  corsOrigin: e.CORS_ORIGIN || '*',
  servirFrontend: (e.SERVIR_FRONTEND || 'si').toLowerCase() !== 'no',
  carpetaFrontend: path.resolve(__dirname, '..', '..', 'campuscare-web')
};
