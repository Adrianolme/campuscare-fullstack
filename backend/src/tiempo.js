'use strict';
// Fechas generadas en JS (UTC) para no depender de la zona horaria de la BD
const dos = n => String(n).padStart(2, '0');
function ahoraUTC(d = new Date()) {
  return `${d.getUTCFullYear()}-${dos(d.getUTCMonth() + 1)}-${dos(d.getUTCDate())} ` +
         `${dos(d.getUTCHours())}:${dos(d.getUTCMinutes())}:${dos(d.getUTCSeconds())}`;
}
const aISO = s => (s ? String(s).replace(' ', 'T') + 'Z' : null);
module.exports = { ahoraUTC, aISO };
