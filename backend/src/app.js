'use strict';
// Capa delgada de Express: solo CORS, JSON, archivos estáticos y delegar en rutas.js
const express = require('express');
const config = require('./config');
const { cabecerasCors } = require('./cors');
const { ejecutar } = require('./rutas');

function crearApp(db) {
  const app = express();
  app.disable('x-powered-by');

  app.use((req, res, next) => {
    res.set(cabecerasCors(req.headers.origin));
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use('/api', express.json({ limit: '300kb' }));

  app.all('/api/*', async (req, res) => {
    const r = await ejecutar(db, {
      metodo: req.method, ruta: req.path === '/' ? '/api' : '/api' + req.path.replace(/^\/api/, ''),
      query: req.query, body: req.body, clienteId: req.get('X-Cliente-Id') || '',
      token: (req.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    });
    res.set('Cache-Control', 'no-store');
    if (r.binario) return res.status(r.estado).type(r.tipo).send(r.binario);
    res.status(r.estado).json(r.cuerpo);
  });

  // Errores de express.json (JSON mal formado / cuerpo demasiado grande)
  app.use('/api', (err, req, res, next) => { // eslint-disable-line no-unused-vars
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Cuerpo demasiado grande' });
    console.error('[error]', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  if (config.servirFrontend) {
    app.get('/service-worker.js', (req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(config.carpetaFrontend + '/service-worker.js');
    });
    app.use(express.static(config.carpetaFrontend));
  }
  return app;
}
module.exports = { crearApp };
