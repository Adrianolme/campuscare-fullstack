'use strict';
// SOLO PARA PRUEBAS: servidor con node:http que usa la MISMA tabla de rutas (src/rutas.js) y
// el mismo CORS, sin necesitar Express. Se usó para probar porque en el entorno de desarrollo
// no se podía instalar Express. En producción se usa src/app.js (Express).
const http = require('http');
const fs = require('fs');
const path = require('path');
const { ejecutar } = require('../src/rutas');
const { cabecerasCors } = require('../src/cors');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain', '.vtt': 'text/vtt' };

function crearServidorNativo(db, { carpetaFrontend } = {}) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname.startsWith('/api')) {
      const cab = cabecerasCors(req.headers.origin);
      if (req.method === 'OPTIONS') { res.writeHead(204, cab); return res.end(); }
      let bruto = '', demasiado = false;
      for await (const trozo of req) { bruto += trozo; if (bruto.length > 300 * 1024) { demasiado = true; break; } }
      if (demasiado) { res.writeHead(413, { ...cab, 'Content-Type': 'application/json' }); return res.end('{"error":"Cuerpo demasiado grande"}'); }
      let body;
      if (bruto) { try { body = JSON.parse(bruto); } catch { res.writeHead(400, { ...cab, 'Content-Type': 'application/json' }); return res.end('{"error":"JSON inválido"}'); } }
      const r = await ejecutar(db, { metodo: req.method, ruta: url.pathname, query: Object.fromEntries(url.searchParams),
        body, clienteId: req.headers['x-cliente-id'] || '' });
      const h = { ...cab, 'Cache-Control': 'no-store' };
      if (r.binario) { res.writeHead(r.estado, { ...h, 'Content-Type': r.tipo }); return res.end(r.binario); }
      res.writeHead(r.estado, { ...h, 'Content-Type': 'application/json; charset=utf-8' });
      return res.end(JSON.stringify(r.cuerpo));
    }
    if (!carpetaFrontend) { res.writeHead(404); return res.end(); }
    let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p.endsWith(path.sep) || p === '.') p = path.join(p, 'index.html');
    const archivo = path.join(carpetaFrontend, p);
    if (!archivo.startsWith(carpetaFrontend)) { res.writeHead(403); return res.end(); }
    fs.readFile(archivo, (err, datos) => {
      if (err) { res.writeHead(404); return res.end('no encontrado'); }
      const cab = { 'Content-Type': MIME[path.extname(archivo)] || 'application/octet-stream' };
      if (p.endsWith('service-worker.js')) cab['Cache-Control'] = 'no-cache';
      res.writeHead(200, cab); res.end(datos);
    });
  });
}
module.exports = { crearServidorNativo };
