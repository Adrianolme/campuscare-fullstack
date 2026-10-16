'use strict';
// Adaptador MySQL con mysql2/promise (pool de conexiones)
async function crear(cfg) {
  const mysql = require('mysql2/promise');
  const opciones = {
    host: cfg.host, port: cfg.port, user: cfg.user, password: cfg.password,
    charset: 'utf8mb4', dateStrings: true, timezone: 'Z'
  };

  // 1) Crear la base de datos si no existe
  try {
    const c = await mysql.createConnection(opciones);
    await c.query('CREATE DATABASE IF NOT EXISTS `' + cfg.database.replace(/`/g, '') + '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    await c.end();
  } catch (e) {
    if (['ECONNREFUSED', 'ENOTFOUND', 'ER_ACCESS_DENIED_ERROR'].includes(e.code)) throw e;
    // otros errores (p. ej. sin permiso CREATE): se intentará usar la BD existente
  }

  // 2) Pool
  const pool = mysql.createPool({ ...opciones, database: cfg.database, connectionLimit: 10, waitForConnections: true });

  const ejecutarCon = async (c, sql, p = []) => {
    const [r] = await c.execute(sql, p);
    return { idInsertado: Number(r.insertId || 0), filasAfectadas: Number(r.affectedRows || 0) };
  };
  const consultarCon = async (c, sql, p = []) => { const [f] = await c.execute(sql, p); return f; };

  return {
    dialecto: 'mysql',
    consultar: (sql, p) => consultarCon(pool, sql, p),
    ejecutar: (sql, p) => ejecutarCon(pool, sql, p),
    ddl: async sql => { await pool.query(sql); },
    transaccion: async fn => {
      const c = await pool.getConnection();
      try {
        await c.beginTransaction();
        const r = await fn({
          dialecto: 'mysql',
          consultar: (s, p) => consultarCon(c, s, p),
          ejecutar: (s, p) => ejecutarCon(c, s, p)
        });
        await c.commit();
        return r;
      } catch (e) { try { await c.rollback(); } catch { /* ignorar */ } throw e; }
      finally { c.release(); }
    },
    cerrar: () => pool.end()
  };
}
module.exports = { crear };
