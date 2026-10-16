'use strict';
async function cargar(db) {
  const zonas = (await db.consultar('SELECT id, nombre, pos_x, pos_y FROM zonas ORDER BY pos_y, pos_x'))
    .map(z => ({ id: z.id, nombre: z.nombre, x: Number(z.pos_x), y: Number(z.pos_y) }));
  const categorias = (await db.consultar('SELECT id, nombre, icono FROM categorias ORDER BY id'))
    .map(c => ({ id: Number(c.id), nombre: c.nombre, icono: c.icono }));
  const esp = await db.consultar('SELECT tecnico_id, categoria_id FROM tecnico_especialidades');
  // Los técnicos cuya cuenta está desactivada no se asignan a tickets nuevos
  const inactivos = new Set((await db.consultar(
    "SELECT tecnico_id FROM usuarios WHERE rol = 'tecnico' AND activo = 0 AND tecnico_id IS NOT NULL")).map(x => x.tecnico_id));
  const tecnicos = (await db.consultar('SELECT id, nombre, rol, zona_id FROM tecnicos ORDER BY id'))
    .filter(t => !inactivos.has(t.id))
    .map(t => ({
      id: t.id, nombre: t.nombre, rol: t.rol, zonaId: t.zona_id,
      especialidades: esp.filter(e => e.tecnico_id === t.id).map(e => Number(e.categoria_id))
    }));
  return { zonas, categorias, tecnicos };
}
module.exports = { cargar };