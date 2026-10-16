'use strict';
// Genera database/campuscare.mysql.sql (esquema + datos iniciales) para ejecutarlo en MySQL Workbench
const fs = require('fs');
const path = require('path');
const datos = require('../src/db/datos-iniciales');
const q = s => "'" + String(s).replace(/'/g, "''") + "'";

let out = '-- CampusCare · script completo para MySQL 8 (generado con "npm run sql")\n';
out += 'CREATE DATABASE IF NOT EXISTS campuscare CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE campuscare;\nSET NAMES utf8mb4;\n\n';
out += fs.readFileSync(path.join(__dirname, '../src/db/schema.mysql.sql'), 'utf8') + '\n';
out += '-- ===== Datos iniciales =====\n';
out += 'INSERT INTO zonas (id,nombre,pos_x,pos_y) VALUES\n' + datos.ZONAS.map(z => `  (${q(z[0])},${q(z[1])},${z[2]},${z[3]})`).join(',\n') + ';\n\n';
out += 'INSERT INTO categorias (nombre,icono) VALUES\n' + datos.CATEGORIAS.map(c => `  (${q(c[0])},${q(c[1])})`).join(',\n') + ';\n\n';
out += 'INSERT INTO tecnicos (id,nombre,rol,zona_id) VALUES\n' + datos.TECNICOS.map(t => `  (${q(t[0])},${q(t[1])},${q(t[2])},${q(t[3])})`).join(',\n') + ';\n\n';
const pares = datos.TECNICOS.flatMap(t => t[4].map(e => `  SELECT ${q(t[0])} AS tid, ${q(e)} AS cn`));
out += 'INSERT INTO tecnico_especialidades (tecnico_id,categoria_id)\nSELECT t.id, c.id FROM (\n' + pares.join('\n  UNION ALL\n') +
  '\n) x JOIN tecnicos t ON t.id = x.tid JOIN categorias c ON c.nombre = x.cn;\n';
fs.mkdirSync(path.join(__dirname, '../database'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../database/campuscare.mysql.sql'), out);
console.log('Generado database/campuscare.mysql.sql');
