'use strict';
const { ErrorHttp } = require('./errores');

const SEVERIDADES = ['Baja', 'Media', 'Alta', 'Crítica'];
const ORIGENES = ['Reporte de usuario', 'Sensor IoT'];
const TIPOS_SENSOR = ['energia', 'agua', 'temp'];
const MAX_FOTO = 200 * 1024; // bytes aprox. de la imagen

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function validarTicket(b, cat) {
  const errores = [];
  if (!b || typeof b !== 'object') throw new ErrorHttp(400, 'Cuerpo inválido');
  const descripcion = texto(b.descripcion, 500);
  if (descripcion.length < 5) errores.push('descripcion: mínimo 5 caracteres');
  // La categoría se acepta por nombre ("Eléctrica") o por id numérico
  const cEnc = cat.categorias.find(c => c.nombre === b.categoria || c.id === Number(b.categoria));
  if (!cEnc) errores.push('categoria: no existe');
  const categoria = cEnc ? cEnc.id : null;
  const severidad = b.severidad || 'Media';
  if (!SEVERIDADES.includes(severidad)) errores.push('severidad: Baja, Media, Alta o Crítica');
  const zona = b.zona;
  if (!cat.zonas.some(z => z.id === zona)) errores.push('zona: no existe');
  const origen = b.origen || 'Reporte de usuario';
  if (!ORIGENES.includes(origen)) errores.push('origen: Reporte de usuario o Sensor IoT');
  const espacio = texto(b.espacio, 80);
  const ubicacion = texto(b.ubicacion, 160);

  let foto = null;
  if (b.foto) {
    const m = typeof b.foto === 'string' && b.foto.match(/^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/);
    if (!m) errores.push('foto: debe ser JPEG en data URL base64');
    else if (m[1].length * 0.75 > MAX_FOTO) errores.push('foto: demasiado grande (máx. 200 KB)');
    else foto = b.foto;
  }

  let sensor = null;
  if (b.sensor) {
    const s = b.sensor;
    if (!TIPOS_SENSOR.includes(s.tipo) || !Number.isFinite(Number(s.valor)) || !Number.isFinite(Number(s.umbral))) {
      errores.push('sensor: {tipo: energia|agua|temp, valor, umbral} numéricos');
    } else sensor = { tipo: s.tipo, valor: Number(s.valor), umbral: Number(s.umbral) };
  }
  if (errores.length) throw new ErrorHttp(400, 'Datos inválidos', errores);
  return { descripcion, categoria, severidad, zona, espacio, ubicacion, foto, origen, sensor };
}

function validarContacto(b) {
  const errores = [];
  if (!b || typeof b !== 'object') throw new ErrorHttp(400, 'Cuerpo inválido');
  const nombre = texto(b.nombre, 80);
  const correo = texto(b.correo, 120);
  const rol = texto(b.rol, 40);
  const mensaje = texto(b.mensaje, 1000);
  const fecha = texto(b.fecha_visita, 10);
  if (nombre.length < 2) errores.push('nombre: mínimo 2 caracteres');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) errores.push('correo: inválido');
  if (mensaje.length < 3) errores.push('mensaje: mínimo 3 caracteres');
  if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) errores.push('fecha_visita: formato AAAA-MM-DD');
  let calificacion = null;
  if (b.calificacion !== undefined && b.calificacion !== null && b.calificacion !== '') {
    calificacion = Number(b.calificacion);
    if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) errores.push('calificacion: 1 a 5');
  }
  if (errores.length) throw new ErrorHttp(400, 'Datos inválidos', errores);
  return { nombre, correo, rol, fecha_visita: fecha || null, calificacion, mensaje };
}

module.exports = { validarTicket, validarContacto };
