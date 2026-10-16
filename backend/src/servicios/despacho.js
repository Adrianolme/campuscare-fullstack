'use strict';
// Algoritmo de despacho (lógica pura, sin BD ni HTTP):
//   puntaje = +50 si tiene la especialidad − 10 × distancia Manhattan entre zonas − 15 × órdenes activas
// En empate gana el primer técnico de la lista.
function distancia(a, b) { return Math.abs(a.x - b.x) + Math.abs(a.y - b.y); }

/**
 * @param tecnicos [{id,nombre,rol,zona:{x,y},especialidades:[categoriaId]}]
 * @param cargas   { [tecnicoId]: ordenesActivas }
 * @param ticket   {categoriaId, zona:{x,y}}
 */
function asignarTecnico(tecnicos, cargas, ticket) {
  let mejor = null;
  for (const tec of tecnicos) {
    const carga = cargas[tec.id] || 0;
    const espOk = tec.especialidades.includes(ticket.categoriaId);
    const d = distancia(tec.zona, ticket.zona);
    const puntos = (espOk ? 50 : 0) - 10 * d - 15 * carga;
    if (!mejor || puntos > mejor.puntos) mejor = { tec, puntos, carga, espOk, d };
  }
  if (!mejor) return null;
  const s = n => (n === 1 ? '' : 's');
  return {
    tecnico: mejor.tec,
    puntos: mejor.puntos,
    motivo: `${mejor.espOk ? 'especialidad ✔' : 'sin especialidad exacta'}, a ${mejor.d} zona${s(mejor.d)}, ` +
            `${mejor.carga} orden${mejor.carga === 1 ? '' : 'es'} activa${s(mejor.carga)}`
  };
}
module.exports = { asignarTecnico, distancia };
