'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
let sqliteOk = true;
try { require('node:sqlite'); } catch { sqliteOk = false; }
const opts = { skip: !sqliteOk && 'node:sqlite no disponible (Node >= 22.13)' };

const { asignarTecnico } = require('../src/servicios/despacho');
const { validarTicket, validarContacto } = require('../src/validar');

test('despacho: gana el técnico con especialidad y más cercano', () => {
  const tecs = [
    { id: 'a', nombre: 'A', rol: 'x', zona: { x: 0, y: 0 }, especialidades: [1] },
    { id: 'b', nombre: 'B', rol: 'x', zona: { x: 2, y: 0 }, especialidades: [1] }
  ];
  const r = asignarTecnico(tecs, {}, { categoriaId: 1, zona: { x: 2, y: 0 } });
  assert.equal(r.tecnico.id, 'b');
  assert.match(r.motivo, /especialidad ✔, a 0 zonas, 0 ordenes activas/);
});
test('despacho: la carga resta puntos', () => {
  const tecs = [
    { id: 'a', nombre: 'A', rol: 'x', zona: { x: 0, y: 0 }, especialidades: [1] },
    { id: 'b', nombre: 'B', rol: 'x', zona: { x: 1, y: 0 }, especialidades: [1] }
  ];
  assert.equal(asignarTecnico(tecs, { a: 2 }, { categoriaId: 1, zona: { x: 0, y: 0 } }).tecnico.id, 'b');
});
test('validar: rechaza datos malos y acepta categoría por nombre', () => {
  const cat = { categorias: [{ id: 1, nombre: 'Eléctrica' }], zonas: [{ id: 'edA' }] };
  assert.throws(() => validarTicket({ descripcion: 'x', categoria: 9, zona: 'zz' }, cat), /inválidos/);
  const ok = validarTicket({ descripcion: 'Foco fundido', categoria: 'Eléctrica', zona: 'edA', severidad: 'Alta' }, cat);
  assert.equal(ok.categoria, 1);
  assert.throws(() => validarTicket({ descripcion: 'Foco fundido', categoria: 1, zona: 'edA', foto: 'data:image/png;base64,AAA' }, cat));
});
test('validar contacto', () => {
  assert.throws(() => validarContacto({ nombre: 'A', correo: 'mal', mensaje: '' }));
  assert.equal(validarContacto({ nombre: 'Ana', correo: 'a@b.mx', mensaje: 'Hola', calificacion: '5' }).calificacion, 5);
});

test('servicios con SQLite: crear, avanzar, borrar, cascada', opts, async () => {
  const { abrirBD } = require('../src/db');
  const tickets = require('../src/servicios/tickets');
  const db = await abrirBD({ motor: 'sqlite', archivo: ':memory:' });
  const t = await tickets.crear(db, { descripcion: 'Chispas en tablero', categoria: 1, severidad: 'Crítica', zona: 'edA',
    espacio: 'A-101', ubicacion: '', foto: null, origen: 'Sensor IoT', sensor: { tipo: 'energia', valor: 9.5, umbral: 8 } }, 'cli-1');
  assert.match(t.folio, /^TCK-\d{4}-0001$/);
  assert.equal(t.estado, 1);
  assert.match(t.tecnicoNombre, /^Luis/);
  assert.equal(t.mio, true);
  assert.equal((await tickets.obtener(db, t.folio, 'otro')).mio, false);
  assert.equal((await db.consultar('SELECT COUNT(*) AS n FROM alertas_sensor'))[0].n, 1);
  assert.equal((await tickets.historial(db, t.folio)).length, 2);

  // segundo ticket: Luis ya tiene 1 orden → pesa
  const t2 = await tickets.crear(db, { descripcion: 'Otro foco sin luz', categoria: 1, severidad: 'Alta', zona: 'edA',
    espacio: '', ubicacion: '', foto: null, origen: 'Reporte de usuario', sensor: null }, 'cli-2');
  assert.match(t2.tecnicoNombre, /^(Luis|Diego)/);

  await assert.rejects(tickets.avanzar(db, t.folio, 3, 'cli-1'), /un paso/);
  const a = await tickets.avanzar(db, t.folio, 2, 'cli-1');
  assert.equal(a.estado, 2);
  await tickets.avanzar(db, t.folio, undefined, 'cli-1');
  await tickets.avanzar(db, t.folio, undefined, 'cli-1');
  await assert.rejects(tickets.avanzar(db, t.folio, undefined, 'cli-1'), /cerrado/);

  const est = await tickets.estadisticas(db);
  assert.equal(est.total, 2); assert.equal(est.alertasSensor, 1);

  await assert.rejects(tickets.borrar(db, t.folio, 'intruso'), /propios/);
  await tickets.borrar(db, t.folio, 'cli-1');
  assert.equal((await db.consultar('SELECT COUNT(*) AS n FROM ticket_historial WHERE ticket_id = 1'))[0].n, 0);
  assert.equal((await db.consultar('SELECT COUNT(*) AS n FROM alertas_sensor'))[0].n, 0);
  await assert.rejects(tickets.obtener(db, 'TCK-2026-9999'), /no encontrado/);
  await db.cerrar();
});
