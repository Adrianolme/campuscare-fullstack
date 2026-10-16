'use strict';
const { ahoraUTC } = require('../tiempo');
async function guardar(db, c) {
  const r = await db.ejecutar(
    'INSERT INTO contactos (nombre, correo, rol, fecha_visita, calificacion, mensaje, creado_en) VALUES (?,?,?,?,?,?,?)',
    [c.nombre, c.correo, c.rol, c.fecha_visita, c.calificacion, c.mensaje, ahoraUTC()]);
  return { id: r.idInsertado, recibido: true };
}
module.exports = { guardar };
