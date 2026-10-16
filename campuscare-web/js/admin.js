/* Panel de administración: usuarios y técnicos */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const Auth = window.CampusAuth;
  const yo = Auth && Auth.usuario();
  if (!yo || yo.rol !== 'admin') { location.replace('index.html'); return; }   // el servidor también lo exige

  const base = String((window.CAMPUSCARE_CONFIG || {}).API_URL || '').replace(/\/+$/, '');
  const api = (ruta) => (base ? base + '/' : '') + 'api/' + ruta;

  async function pedir(metodo, ruta, cuerpo) {
    const res = await fetch(api(ruta), {
      method: metodo,
      headers: Object.assign({ Authorization: 'Bearer ' + Auth.token() }, cuerpo ? { 'Content-Type': 'application/json' } : {}),
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
    let datos = null;
    try { datos = await res.json(); } catch { /* sin JSON */ }
    if (!res.ok) {
      if (res.status === 401) { Auth.expirar(); }
      const det = datos && datos.detalles ? ' (' + [].concat(datos.detalles).join('; ') + ')' : '';
      throw new Error(((datos && datos.error) || 'Error ' + res.status) + det);
    }
    return datos;
  }

  function el(tag, props = {}, hijos = []) {
    const n = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => { if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else n.setAttribute(k, v); });
    [].concat(hijos).forEach((h) => n.append(h));
    return n;
  }
  const aviso = (txt) => { $('msg-admin').textContent = txt; };

  let usuarios = [], cat = { zonas: [], categorias: [], tecnicos: [] };
  const ETIQUETA_ROL = { admin: 'Administrador', tecnico: 'Técnico', usuario: 'Usuario' };

  // Técnicos que todavía no tienen cuenta
  const tecnicosLibres = () => cat.tecnicos.filter((t) => !usuarios.some((u) => u.tecnicoId === t.id));

  async function cargar() {
    try {
      [usuarios, cat] = await Promise.all([pedir('GET', 'admin/usuarios'), pedir('GET', 'catalogos')]);
      pintarTabla();
      pintarFormulario();
    } catch (e) { aviso('⚠️ ' + e.message); }
  }

  // ---------- Tabla ----------
  function pintarTabla() {
    const cuerpo = $('cuerpo-usuarios');
    cuerpo.replaceChildren();
    usuarios.forEach((u) => {
      const esYo = u.id === yo.id;

      const selRol = el('select', { 'aria-label': `Rol de ${u.nombre}` },
        ['usuario', 'tecnico', 'admin'].map((r) => { const o = el('option', { value: r, text: ETIQUETA_ROL[r] }); if (r === u.rol) o.selected = true; return o; }));
      selRol.disabled = esYo;

      // Selector de técnico (solo cuando el rol es "tecnico")
      const selTec = el('select', { 'aria-label': `Técnico de ${u.nombre}` });
      if (u.tecnicoId) selTec.append(el('option', { value: u.tecnicoId, text: u.tecnicoNombre || u.tecnicoId }));
      tecnicosLibres().forEach((t) => selTec.append(el('option', { value: t.id, text: `${t.nombre} (${t.rol})` })));
      if (!selTec.options.length) selTec.append(el('option', { value: '', text: '(no hay técnicos libres)' }));
      const celdaTec = el('td');
      const textoTec = el('span', { text: u.tecnicoNombre || '—' });
      const mostrarTec = () => {
        celdaTec.replaceChildren(selRol.value === 'tecnico' ? selTec : textoTec);
      };
      selRol.addEventListener('change', mostrarTec);
      mostrarTec();

      const guardar = el('button', { class: 'boton', type: 'button', text: 'Guardar rol' });
      guardar.disabled = esYo;
      guardar.addEventListener('click', async () => {
        const cuerpoPatch = { rol: selRol.value };
        if (selRol.value === 'tecnico') cuerpoPatch.tecnicoId = selTec.value;
        try { await pedir('PATCH', 'admin/usuarios/' + u.id, cuerpoPatch); aviso(`✅ Rol de ${u.nombre} actualizado.`); await cargar(); }
        catch (e) { aviso('⚠️ ' + e.message); }
      });

      const activar = el('button', { class: 'boton sec', type: 'button', text: u.activo ? 'Desactivar' : 'Activar' });
      activar.disabled = esYo;
      activar.addEventListener('click', async () => {
        if (u.activo && !confirm(`¿Desactivar la cuenta de ${u.nombre}? Se cerrará su sesión.`)) return;
        try { await pedir('PATCH', 'admin/usuarios/' + u.id, { activo: !u.activo }); aviso(`✅ ${u.nombre}: cuenta ${u.activo ? 'desactivada' : 'activada'}.`); await cargar(); }
        catch (e) { aviso('⚠️ ' + e.message); }
      });

      const clave = el('button', { class: 'boton sec', type: 'button', text: 'Nueva contraseña' });
      clave.addEventListener('click', async () => {
        const nueva = prompt(`Nueva contraseña para ${u.nombre} (mínimo 8 caracteres):`);
        if (!nueva) return;
        try { await pedir('PATCH', 'admin/usuarios/' + u.id, { password: nueva }); aviso(`✅ Contraseña de ${u.nombre} restablecida.`); }
        catch (e) { aviso('⚠️ ' + e.message); }
      });

      cuerpo.append(el('tr', {}, [
        el('td', { text: u.nombre + (esYo ? ' (tú)' : '') }),
        el('td', { text: u.correo }),
        el('td', {}, [selRol]),
        celdaTec,
        el('td', {}, [el('span', { class: u.activo ? 'estado-activo' : 'estado-inactivo', text: u.activo ? 'Activo' : 'Inactivo' })]),
        el('td', {}, [el('div', { class: 'acciones-fila' }, [guardar, activar, clave])])
      ]));
    });
  }

  // ---------- Formulario de creación ----------
  function pintarFormulario() {
    $('t-zona').replaceChildren(...cat.zonas.map((z) => el('option', { value: z.id, text: z.nombre })));
    $('t-cats').replaceChildren(...cat.categorias.map((c) =>
      el('label', {}, [el('input', { type: 'checkbox', value: c.nombre }), ` ${c.icono} ${c.nombre}`])));
    const libres = tecnicosLibres();
    $('t-existente').replaceChildren(...(libres.length
      ? libres.map((t) => el('option', { value: t.id, text: `${t.nombre} (${t.rol})` }))
      : [el('option', { value: '', text: '(no hay técnicos sin cuenta)' })]));
  }

  function actualizarBloques() {
    const esTec = $('a-rol').value === 'tecnico';
    $('bloque-tecnico').hidden = !esTec;
    const modo = document.querySelector('input[name="modo"]:checked').value;
    $('tec-nuevo').hidden = modo !== 'nuevo';
    $('tec-existente').hidden = modo !== 'existente';
  }
  $('a-rol').addEventListener('change', actualizarBloques);
  document.querySelectorAll('input[name="modo"]').forEach((r) => r.addEventListener('change', actualizarBloques));

  $('form-admin').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cuerpo = { nombre: $('a-nombre').value, correo: $('a-correo').value, password: $('a-pass').value, rol: $('a-rol').value };
    if (cuerpo.rol === 'tecnico') {
      if (document.querySelector('input[name="modo"]:checked').value === 'existente') {
        cuerpo.tecnicoId = $('t-existente').value;
      } else {
        cuerpo.nuevoTecnico = {
          cargo: $('t-cargo').value, zona: $('t-zona').value,
          especialidades: Array.from(document.querySelectorAll('#t-cats input:checked')).map((i) => i.value)
        };
      }
    }
    const boton = e.target.querySelector('button[type=submit]');
    boton.disabled = true;
    try {
      const u = await pedir('POST', 'admin/usuarios', cuerpo);
      aviso(`✅ Cuenta creada: ${u.nombre} (${ETIQUETA_ROL[u.rol]}).`);
      e.target.reset();
      actualizarBloques();
      await cargar();
    } catch (err) { aviso('⚠️ ' + err.message); }
    boton.disabled = false;
  });

  actualizarBloques();
  cargar();
})();