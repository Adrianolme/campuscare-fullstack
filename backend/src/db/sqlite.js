'use strict';
// Adaptador SQLite (node:sqlite, Node >= 22.13). Pensado para pruebas sin instalar MySQL.
const fs = require('fs');
const path = require('path');

function crear(archivo) {
  const { DatabaseSync } = require('node:sqlite');
  if (archivo !== ':memory:') fs.mkdirSync(path.dirname(archivo), { recursive: true });
  const bd = new DatabaseSync(archivo);
  bd.exec('PRAGMA foreign_keys = ON');

  const consultarSync = (sql, p = []) => bd.prepare(sql).all(...p).map(f => ({ ...f }));
  const ejecutarSync = (sql, p = []) => {
    const r = bd.prepare(sql).run(...p);
    return { idInsertado: Number(r.lastInsertRowid), filasAfectadas: Number(r.changes) };
  };

  // Cola de promesas: SQLite es de una sola conexión, así evitamos mezclar transacciones
  let cola = Promise.resolve();
  const enCola = fn => { const p = cola.then(fn, fn); cola = p.catch(() => {}); return p; };

  const base = {
    dialecto: 'sqlite',
    consultar: (sql, p) => enCola(async () => consultarSync(sql, p)),
    ejecutar: (sql, p) => enCola(async () => ejecutarSync(sql, p)),
    ddl: sql => enCola(async () => { bd.exec(sql); }),
    transaccion: fn => enCola(async () => {
      bd.exec('BEGIN');
      const tx = {
        dialecto: 'sqlite',
        consultar: async (s, p) => consultarSync(s, p),   // sin pasar por la cola (evita bloqueo)
        ejecutar: async (s, p) => ejecutarSync(s, p)
      };
      try { const r = await fn(tx); bd.exec('COMMIT'); return r; }
      catch (e) { try { bd.exec('ROLLBACK'); } catch { /* ya revertido */ } throw e; }
    }),
    cerrar: async () => { await cola; bd.close(); }
  };
  return base;
}
module.exports = { crear };
