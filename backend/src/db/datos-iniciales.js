'use strict';
const ZONAS = [
  ['edA', 'Edificio A', 0, 0], ['edB', 'Edificio B', 1, 0], ['edC', 'Edificio C', 2, 0],
  ['labs', 'Laboratorios', 0, 1], ['bib', 'Biblioteca', 1, 1], ['caf', 'Cafetería', 2, 1]
];
const CATEGORIAS = [
  ['Eléctrica', '⚡'], ['Hidráulica', '💧'], ['Mobiliario', '🪑'],
  ['Equipo y red', '📽️'], ['Climatización', '❄️'], ['General', '🛠️']
];
// [id, nombre, rol, zona, [especialidades]]
const TECNICOS = [
  ['t1', 'Luis', 'electricista', 'edA', ['Eléctrica']],
  ['t2', 'Diego', 'electricista', 'edC', ['Eléctrica']],
  ['t3', 'Marta', 'plomería', 'labs', ['Hidráulica']],
  ['t4', 'Iván', 'mantenimiento general', 'edB', ['Mobiliario', 'General']],
  ['t5', 'Sofía', 'equipo y climatización', 'caf', ['Equipo y red', 'Climatización']]
];
module.exports = { ZONAS, CATEGORIAS, TECNICOS };
