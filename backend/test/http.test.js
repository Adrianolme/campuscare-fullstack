'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
let sqliteOk = true;
try { require('node:sqlite'); } catch { sqliteOk = false; }

// 1x1 JPEG válido
const JPG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

test('API HTTP (rutas reales + SQLite)', { skip: !sqliteOk && 'node:sqlite no disponible' }, async () => {
  const { abrirBD } = require('../src/db');
  const { crearServidorNativo } = require('../soporte-pruebas/http-nativo');
  const db = await abrirBD({ motor: 'sqlite', archivo: ':memory:' });
  const srv = crearServidorNativo(db);
  await new Promise(r => srv.listen(0, r));
  const base = `http://127.0.0.1:${srv.address().port}/api`;
  const llamar = (m, p, body, cli = 'c1') => fetch(base + p, { method: m,
    headers: { 'Content-Type': 'application/json', 'X-Cliente-Id': cli }, body: body ? JSON.stringify(body) : undefined });

  let r = await llamar('GET', '/health'); assert.equal(r.status, 200);
  assert.equal((await r.json()).baseDeDatos, 'sqlite');
  r = await llamar('GET', '/catalogos'); const cat = await r.json();
  assert.equal(cat.zonas.length, 6); assert.equal(cat.tecnicos.length, 5);

  r = await llamar('POST', '/tickets', { descripcion: 'x' }); assert.equal(r.status, 400);
  r = await llamar('POST', '/tickets', { descripcion: 'Fuga de agua en baño', categoria: 'Hidráulica', zona: 'labs', severidad: 'Alta', foto: JPG });
  assert.equal(r.status, 201);
  const t = await r.json();
  assert.match(t.tecnicoNombre, /^Marta/); assert.equal(t.tieneFoto, true);

  r = await llamar('GET', '/tickets'); const lista = await r.json();
  assert.equal(lista.length, 1); assert.equal(lista[0].foto, undefined); assert.equal(lista[0].mio, true);
  assert.equal((await (await llamar('GET', '/tickets', null, 'otro')).json())[0].mio, false);
  assert.equal((await (await llamar('GET', '/tickets?estado=3')).json()).length, 0);

  r = await fetch(`${base}/tickets/${t.folio}/foto`); assert.equal(r.status, 200);
  assert.equal(r.headers.get('content-type'), 'image/jpeg');
  assert.ok((await r.arrayBuffer()).byteLength > 50);

  r = await llamar('PATCH', `/tickets/${t.folio}/estado`, { estado: 2 }); assert.equal(r.status, 200);
  r = await llamar('PATCH', `/tickets/${t.folio}/estado`, { estado: 2 }); assert.equal(r.status, 409);
  assert.equal((await (await llamar('GET', `/tickets/${t.folio}/historial`)).json()).length, 3);

  r = await llamar('DELETE', `/tickets/${t.folio}`, null, 'intruso'); assert.equal(r.status, 403);
  r = await llamar('DELETE', `/tickets/${t.folio}`); assert.equal(r.status, 200);
  r = await llamar('GET', `/tickets/${t.folio}`); assert.equal(r.status, 404);

  r = await llamar('POST', '/contacto', { nombre: 'Ana', correo: 'ana@correo.mx', mensaje: 'Hola', calificacion: 5 }); assert.equal(r.status, 201);
  r = await llamar('POST', '/contacto', { nombre: 'A', correo: 'x' }); assert.equal(r.status, 400);
  r = await fetch(base + '/tickets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{mal' }); assert.equal(r.status, 400);
  r = await fetch(base + '/nada'); assert.equal(r.status, 404);
  r = await fetch(base + '/health', { method: 'DELETE' }); assert.equal(r.status, 405);
  r = await fetch(base + '/tickets', { method: 'OPTIONS' }); assert.equal(r.status, 204);
  assert.ok(r.headers.get('access-control-allow-headers').includes('X-Cliente-Id'));
  r = await llamar('POST', '/tickets', { descripcion: 'Foco fundido', categoria: 1, zona: 'edA' }, ''); assert.equal(r.status, 400);

  srv.close(); await db.cerrar();
});
