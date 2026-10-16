# CampusCare · Backend (Node.js + Express + MySQL)

API REST que guarda reportes (tickets), historial, alertas de sensores y mensajes de contacto en una base de datos.

## Requisitos
- Node.js 18 o superior
- MySQL Server 8 (con MySQL Workbench para ver las tablas)

## Puesta en marcha
```bash
cd backend
npm install
copy .env.example .env        # (Linux/Mac: cp .env.example .env) y pon tu contraseña de MySQL en DB_PASSWORD
npm start
```
Abre http://localhost:3000 → el backend también sirve la web (`../campuscare-web`).
Al arrancar crea la base `campuscare`, las tablas y los datos iniciales (zonas, categorías y técnicos). 
Alternativa: ejecutar `database/campuscare.mysql.sql` en Workbench (File → Open SQL Script → ⚡).

Para ver el diagrama ER: Workbench → Database → Reverse Engineer.

## Endpoints
| Método | Ruta | Descripción |
|---|---|---|
| GET | /api/health | Estado del servidor y de la BD |
| GET | /api/catalogos | Zonas, categorías y técnicos |
| GET | /api/tickets?estado=&zona=&limite= | Lista (sin foto; `tieneFoto`, `mio`) |
| POST | /api/tickets | Crea un ticket y lo asigna al mejor técnico (201) |
| GET | /api/tickets/:folio | Un ticket |
| GET | /api/tickets/:folio/foto | Imagen JPEG |
| GET | /api/tickets/:folio/historial | Cambios de estado |
| PATCH | /api/tickets/:folio/estado | Avanza un paso (`{"estado": n}`); 409 si hay conflicto |
| DELETE | /api/tickets/:folio | Borra (solo el dueño) |
| GET | /api/estadisticas | Totales por estado y zona |
| POST | /api/contacto | Guarda un mensaje de contacto |

Las peticiones que crean/borran llevan la cabecera `X-Cliente-Id` (UUID anónimo del navegador). No hay inicio de sesión.

## Tablas
zonas, categorias, tecnicos, tecnico_especialidades (N:M), tickets, ticket_historial, alertas_sensor, contactos.

## Despacho inteligente
puntaje = +50 si el técnico tiene la especialidad − 10 × distancia entre zonas − 15 × órdenes activas. Gana el mayor.

## Estructura
- `src/rutas.js` tabla de rutas (independiente de Express) · `src/app.js` capa Express
- `src/servicios/` lógica (despacho, tickets, contacto) · `src/db/` adaptadores MySQL/SQLite, esquemas y datos
- `test/` pruebas (`npm test`) · `soporte-pruebas/` servidor de prueba sin Express (solo desarrollo)

## Publicarlo con la web en GitHub Pages
GitHub Pages solo sirve archivos estáticos: el backend debe alojarse en otro servicio (Render, Railway, etc.; revisa sus planes actuales) con una base MySQL.
1. En el servicio del backend define las variables de `.env` y `CORS_ORIGIN=https://TUUSUARIO.github.io` y `SERVIR_FRONTEND=no`.
2. En `campuscare-web/js/config.js` pon `API_URL: 'https://tu-api.ejemplo.com'` (debe ser https).
3. Sube `campuscare-web` a GitHub Pages. Si la API no responde, la web funciona en modo local.

## Mejoras posibles
Autenticación (JWT), límite de peticiones, panel de técnicos, migraciones.
