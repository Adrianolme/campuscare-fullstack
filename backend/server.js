'use strict';
const config = require('./src/config');
const { abrirBD } = require('./src/db');
const { crearApp } = require('./src/app');

(async () => {
  const db = await abrirBD();
  const app = crearApp(db);
  const servidor = app.listen(config.puerto, () => {
    console.log(`CampusCare API lista en http://localhost:${config.puerto}  (base de datos: ${db.dialecto})`);
    if (config.servirFrontend) console.log(`Sitio web en http://localhost:${config.puerto}/`);
  });
  const cerrar = async () => { servidor.close(); await db.cerrar(); process.exit(0); };
  process.on('SIGINT', cerrar);
  process.on('SIGTERM', cerrar);
})().catch(e => {
  const msg = {
    ECONNREFUSED: 'No se pudo conectar a MySQL. ¿Está iniciado el servicio? Revisa DB_HOST y DB_PORT en .env',
    ER_ACCESS_DENIED_ERROR: 'MySQL rechazó el usuario/contraseña. Revisa DB_USER y DB_PASSWORD en .env',
    ENOTFOUND: 'No se encontró el servidor MySQL. Revisa DB_HOST en .env'
  }[e.code];
  console.error(msg ? `✖ ${msg}` : '✖ Error al iniciar:', msg ? '' : e);
  process.exit(1);
});
