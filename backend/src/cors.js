'use strict';
const config = require('./config');
function cabecerasCors(origenPeticion) {
  const permitido = config.corsOrigin === '*' ? '*'
    : (origenPeticion && config.corsOrigin.split(',').map(s => s.trim()).includes(origenPeticion) ? origenPeticion : config.corsOrigin.split(',')[0].trim());
  return {
    'Access-Control-Allow-Origin': permitido,
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
'Access-Control-Allow-Headers': 'Content-Type, X-Cliente-Id, Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}
module.exports = { cabecerasCors };
