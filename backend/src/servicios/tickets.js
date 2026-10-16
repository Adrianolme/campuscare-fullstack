'use strict';
const crypto = require('crypto');
const { ErrorHttp } = require('../errores');
const { ahoraUTC, aISO } = require('../tiempo');
const { asignarTecnico } = require('./despacho');
const catalogos = require('./catalogos');

const ESTADOS = ['Abierto', 'Asignado', 'En proceso', 'Resuelto', 'Cerrado'];
const RE_FOLIO = /^TCK-\d{4}-\d{4,}$/;

const SELECT = `
  SELECT t.id, t.folio, t.descripcion, t.severidad, t.zona_id, t.espacio, t.ubicacion, t.origen,
         t.estado, t.tecnico_id, t.motivo, t.cliente_id, t.creado_en, t.actualizado_en,
         (t.foto IS NOT NULL) AS tiene_foto,
         c.nombre AS categoria, c.icono AS icono,
         tc.nombre AS tec_nombre, tc.rol AS tec_rol
  FROM tickets t
  JOIN categorias c ON c.id = t.categoria_id
  LEFT JOIN tecnicos tc ON tc.id = t.tecnico_id`;

function aApi(f, clienteId) {
  return {
    folio: f.folio,
    descripcion: f.descripcion,
    categoria: f.categoria,
    icono: f.icono,
    severidad: f.severidad,
    zona: f.zona_id,
    espacio: f.espacio,
    ubicacion: f.ubicacion,
    origen: f.origen,
    estado: Number(f.estado),
    estadoNombre: ESTADOS[Number(f.estado)],
    tecnico: f.tecnico_id,
    tecnicoNombre: f.tec_nombre ? `${f.tec_nombre} (${f.tec_rol})` : null,
    motivo: f.motivo,
    tieneFoto: Number(f.tiene_foto) === 1,
    fecha: aISO(f.creado_en),
    actualizado: aISO(f.actualizado_en),
    mio: !!clienteId && f.cliente_id === clienteId
  };
}

function validarFolio(folio) {
  if (!RE_FOLIO.test(folio)) throw new ErrorHttp(404, 'Folio no encontrado');
}

async function filaPorFolio(db, folio) {
  validarFolio(folio);
  const [f] = await db.consultar(SELECT + ' WHERE t.folio = ?', [folio]);
  if (!f) throw new ErrorHttp(404, 'Folio no encontrado');
  return f;
}

// Comprueba que el usuario puede ver o modificar el ticket:
//   admin → todos | usuario → los que él creó | técnico → los que tiene asignados
//   soloAsignado = true: para modificar (solo el técnico asignado o el admin)
async function acceso(db, folio, usuario, soloAsignado = false) {
  const f = await filaPorFolio(db, folio);
  const esDueno = f.cliente_id === 'u' + usuario.id;
  const esAsignado = usuario.rol === 'tecnico' && !!usuario.tecnicoId && f.tecnico_id === usuario.tecnicoId;
  const ok = usuario.rol === 'admin' || esAsignado || (!soloAsignado && esDueno);
  if (!ok) throw new ErrorHttp(404, 'Folio no encontrado');   // 404: no revela que el folio existe
  return f;
}

async function obtener(db, folio, clienteId) {
  return aApi(await filaPorFolio(db, folio), clienteId);
}

async function listar(db, q, clienteId, alcance = {}) {
  const where = [], p = [];
  if (alcance.clienteId) { where.push('t.cliente_id = ?'); p.push(alcance.clienteId); }   // usuario: solo los suyos
  if (alcance.tecnicoId) { where.push('t.tecnico_id = ?'); p.push(alcance.tecnicoId); }   // técnico: solo los asignados
  if (q.estado !== undefined && q.estado !== '') {
    const e = Number(q.estado);
    if (!Number.isInteger(e) || e < 0 || e > 4) throw new ErrorHttp(400, 'estado: 0 a 4');
    where.push('t.estado = ?'); p.push(e);
  }
  if (q.zona) { where.push('t.zona_id = ?'); p.push(String(q.zona)); }
  let limite = parseInt(q.limite, 10);
  if (!Number.isInteger(limite) || limite < 1) limite = 200;
  limite = Math.min(limite, 500); // entero validado: se inserta directo (LIMIT con ? falla en mysql2.execute)
  const sql = SELECT + (where.length ? ' WHERE ' + where.join(' AND ') : '') + ` ORDER BY t.id DESC LIMIT ${limite}`;
  return (await db.consultar(sql, p)).map(f => aApi(f, clienteId));
}

async function crear(db, datos, clienteId) {
  if (!clienteId) throw new ErrorHttp(400, 'Falta la cabecera X-Cliente-Id');
  const cat = await catalogos.cargar(db);
  const ahora = ahoraUTC();
  const zonaT = cat.zonas.find(z => z.id === datos.zona);

  const folio = await db.transaccion(async tx => {
    const cargasF = await tx.consultar(
      'SELECT tecnico_id, COUNT(*) AS n FROM tickets WHERE estado < 3 AND tecnico_id IS NOT NULL GROUP BY tecnico_id');
    const cargas = {};
    cargasF.forEach(c => { cargas[c.tecnico_id] = Number(c.n); });

    const tecnicos = cat.tecnicos.map(t => ({
      ...t, zona: cat.zonas.find(z => z.id === t.zonaId)
    }));
    const asig = asignarTecnico(tecnicos, cargas, { categoriaId: datos.categoria, zona: zonaT });

    const estado = asig ? 1 : 0;
    const temporal = 'TMP-' + crypto.randomBytes(8).toString('hex');
    const r = await tx.ejecutar(
      `INSERT INTO tickets (folio, descripcion, categoria_id, severidad, zona_id, espacio, ubicacion, foto,
                            origen, estado, tecnico_id, motivo, cliente_id, creado_en, actualizado_en)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [temporal, datos.descripcion, datos.categoria, datos.severidad, datos.zona, datos.espacio, datos.ubicacion,
       datos.foto, datos.origen, estado, asig ? asig.tecnico.id : null, asig ? asig.motivo : '', clienteId, ahora, ahora]);
    const id = r.idInsertado;
    const folioFinal = `TCK-${new Date().getUTCFullYear()}-${String(id).padStart(4, '0')}`;
    await tx.ejecutar('UPDATE tickets SET folio = ? WHERE id = ?', [folioFinal, id]);

    await tx.ejecutar('INSERT INTO ticket_historial (ticket_id, estado, nota, creado_en) VALUES (?,?,?,?)',
      [id, 0, 'Reporte creado', ahora]);
    if (asig) {
      await tx.ejecutar('INSERT INTO ticket_historial (ticket_id, estado, nota, creado_en) VALUES (?,?,?,?)',
        [id, 1, `Asignado a ${asig.tecnico.nombre} (${asig.tecnico.rol}): ${asig.motivo}`, ahora]);
    }
    if (datos.sensor) {
      await tx.ejecutar('INSERT INTO alertas_sensor (ticket_id, tipo, valor, umbral, creado_en) VALUES (?,?,?,?,?)',
        [id, datos.sensor.tipo, datos.sensor.valor, datos.sensor.umbral, ahora]);
    }
    return folioFinal;
  });
  return obtener(db, folio, clienteId);
}

async function avanzar(db, folio, estadoEsperado, clienteId) {
  const f = await filaPorFolio(db, folio);
  const actual = Number(f.estado);
  if (actual >= ESTADOS.length - 1) throw new ErrorHttp(409, 'El ticket ya está cerrado');
  if (estadoEsperado !== undefined && Number(estadoEsperado) !== actual + 1) {
    throw new ErrorHttp(409, `Solo se puede avanzar un paso: de ${ESTADOS[actual]} a ${ESTADOS[actual + 1]}`);
  }
  const ahora = ahoraUTC();
  // UPDATE condicional: si otro cliente avanzó antes, no afecta filas y respondemos 409
  const r = await db.transaccion(async tx => {
    const u = await tx.ejecutar('UPDATE tickets SET estado = ?, actualizado_en = ? WHERE id = ? AND estado = ?',
      [actual + 1, ahora, f.id, actual]);
    if (u.filasAfectadas === 1) {
      await tx.ejecutar('INSERT INTO ticket_historial (ticket_id, estado, nota, creado_en) VALUES (?,?,?,?)',
        [f.id, actual + 1, `Cambió a ${ESTADOS[actual + 1]}`, ahora]);
    }
    return u;
  });
  if (r.filasAfectadas !== 1) throw new ErrorHttp(409, 'El ticket cambió de estado mientras tanto; recarga');
  return obtener(db, folio, clienteId);
}

async function borrar(db, folio, clienteId, esAdmin = false) {
  const f = await filaPorFolio(db, folio);
  if (!esAdmin && (!clienteId || f.cliente_id !== clienteId)) throw new ErrorHttp(403, 'Solo puedes borrar tus propios reportes');
  await db.ejecutar('DELETE FROM tickets WHERE id = ?', [f.id]); // historial y alertas caen por ON DELETE CASCADE
  return { folio, borrado: true };
}

async function foto(db, folio) {
  validarFolio(folio);
  const [f] = await db.consultar('SELECT foto FROM tickets WHERE folio = ?', [folio]);
  if (!f || !f.foto) throw new ErrorHttp(404, 'Sin foto');
  const m = String(f.foto).match(/^data:image\/jpeg;base64,(.+)$/);
  if (!m) throw new ErrorHttp(404, 'Sin foto');
  return Buffer.from(m[1], 'base64');
}

async function historial(db, folio) {
  const f = await filaPorFolio(db, folio);
  const filas = await db.consultar('SELECT estado, nota, creado_en FROM ticket_historial WHERE ticket_id = ? ORDER BY id', [f.id]);
  return filas.map(h => ({ estado: Number(h.estado), estadoNombre: ESTADOS[Number(h.estado)], nota: h.nota, fecha: aISO(h.creado_en) }));
}

async function estadisticas(db) {
  const [tot] = await db.consultar('SELECT COUNT(*) AS n FROM tickets');
  const [act] = await db.consultar('SELECT COUNT(*) AS n FROM tickets WHERE estado < 3');
  const [cri] = await db.consultar("SELECT COUNT(*) AS n FROM tickets WHERE estado < 3 AND severidad = 'Crítica'");
  const [al] = await db.consultar('SELECT COUNT(*) AS n FROM alertas_sensor');
  const porEstadoF = await db.consultar('SELECT estado, COUNT(*) AS n FROM tickets GROUP BY estado');
  const porZonaF = await db.consultar('SELECT zona_id, COUNT(*) AS n FROM tickets WHERE estado < 3 GROUP BY zona_id');
    // "Calor" por zona = suma de pesos de severidad de los tickets activos (Baja 1, Media 2, Alta 3, Crítica 4)
  const PESO = { 'Baja': 1, 'Media': 2, 'Alta': 3, 'Crítica': 4 };
  const calorF = await db.consultar('SELECT zona_id, severidad, COUNT(*) AS n FROM tickets WHERE estado < 3 GROUP BY zona_id, severidad');
  const calor = {}; calorF.forEach(x => { calor[x.zona_id] = (calor[x.zona_id] || 0) + (PESO[x.severidad] || 0) * Number(x.n); });
  const porEstado = {}; ESTADOS.forEach((e, i) => { porEstado[e] = 0; });
  porEstadoF.forEach(x => { porEstado[ESTADOS[Number(x.estado)]] = Number(x.n); });
  const porZona = {}; porZonaF.forEach(x => { porZona[x.zona_id] = Number(x.n); });
  return { total: Number(tot.n), activos: Number(act.n), criticos: Number(cri.n), alertasSensor: Number(al.n), porEstado, porZona, calor };
}

module.exports = { ESTADOS, acceso, obtener, listar, crear, avanzar, borrar, foto, historial, estadisticas };