/* Formulario de contacto → guarda el mensaje en la base de datos (POST /api/contacto) */
(() => {
  'use strict';
  const form = document.getElementById('form-contacto');
  if (!form || !window.CampusAPI) return;
  const msg = document.getElementById('msg-contacto');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const btn = form.querySelector('button[type="submit"]');
    const d = new FormData(form);
    msg.textContent = 'Enviando...';
    btn.disabled = true;
    try {
      const estado = await window.CampusAPI.iniciar();
      if (!estado.disponible) throw new Error('El servidor no está disponible en este momento. Inténtalo más tarde.');
      await window.CampusAPI.enviarContacto({
        nombre: d.get('nombre'), correo: d.get('correo'), rol: d.get('rol') || '',
        fecha_visita: d.get('fecha') || '', calificacion: d.get('valor'), mensaje: d.get('mensaje')
      });
      msg.textContent = '✅ ¡Gracias! Tu mensaje se guardó en la base de datos.';
      form.reset();
    } catch (err) {
      msg.textContent = '⚠️ ' + err.message;
    } finally { btn.disabled = false; }
  });
})();
