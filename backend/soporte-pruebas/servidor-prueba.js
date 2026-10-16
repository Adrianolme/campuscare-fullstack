'use strict';
// Uso: node soporte-pruebas/servidor-prueba.js [puerto] [archivo.sqlite|:memory:] [--sin-front]
const path = require('path');
const { abrirBD } = require('../src/db');
const { crearServidorNativo } = require('./http-nativo');
const [puerto = '3100', archivo = ':memory:', bandera] = process.argv.slice(2);
(async () => {
  const db = await abrirBD({ motor: 'sqlite', archivo });
  const front = bandera === '--sin-front' ? undefined : path.resolve(__dirname, '..', '..', 'campuscare-web');
  crearServidorNativo(db, { carpetaFrontend: front }).listen(+puerto, () => console.log('prueba lista en ' + puerto));
})();
