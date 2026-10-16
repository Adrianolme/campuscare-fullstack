/* Configuración del front.
   API_URL vacío  → usa la misma web ("/api/...") — cuando el backend sirve también el sitio.
   API_URL con URL → backend en otro servidor (p. ej. el sitio en GitHub Pages y la API en Render):
                     window.CAMPUSCARE_CONFIG = { API_URL: 'https://tu-api.onrender.com' };
   Si no hay API disponible, la web funciona en "modo local" (localStorage). */
window.CAMPUSCARE_CONFIG = { API_URL: '' };
