# Sur Cowork — Reservas de espacios de trabajo

Aplicación web para explorar salas de coworking y reservar turnos. Incluye un
frontend en React y un backend REST en Express/TypeScript, con autenticación
JWT, autorización por roles y persistencia SQLite con Prisma.

## Funcionalidades

- Registro e inicio de sesión. Las contraseñas se almacenan con bcrypt.
- Listado de salas y búsqueda de disponibilidad por fecha, hora y capacidad.
- Reservas autenticadas de turnos de una hora y consulta de las reservas propias.
- Cancelación de una reserva propia; `ADMIN` también puede cancelar reservas de
  otros usuarios.
- Descuento de créditos al confirmar y reembolso por cancelación anticipada.
- Creación y edición de salas desde la interfaz para roles `EDITOR` y `ADMIN`.
- Renovación de sesión con refresh tokens almacenados como hashes.
- Contenedores separados para el frontend y la API, con volumen persistente
  para SQLite.

No se implementan pagos ni recargas de créditos. El saldo inicial de una
cuenta nueva es de 100 créditos.

## Tecnologías

- Backend: Node.js 22+, TypeScript, Express 5, Prisma y SQLite.
- Frontend: React 19, TypeScript y Vite.
- Seguridad: bcrypt, JWT, CORS y limitación de intentos de inicio de sesión.
- Pruebas: Cucumber/BDD y pruebas de integración sobre SQLite.
- Contenedores: Docker y Docker Compose.

## Inicio rápido con Docker

Requiere Docker Desktop con Docker Compose. Copiar `.env.example` como `.env`;
definir un secreto aleatorio propio para `JWT_SECRET`. Para administrar salas
desde el primer inicio, configurar también `ADMIN_EMAIL` y
`ADMIN_PASSWORD` (mínimo 12 caracteres):

```powershell
Copy-Item .env.example .env
# Editar .env y reemplazar los valores de ejemplo.
docker compose up --build
```

- Frontend: <http://localhost:8080>
- API: <http://localhost:3000>
- Estado de la API: <http://localhost:3000/health>

Compose conserva la base SQLite en el volumen `sqlite_data`. Para detener la
aplicación sin borrar los datos, ejecutar `docker compose down`. **No** usar
`docker compose down -v` salvo que se quiera borrar también la base de datos.

El registro público siempre crea cuentas `USER`. En producción, el
administrador inicial se crea configurando `ADMIN_EMAIL` y `ADMIN_PASSWORD`
antes del primer inicio. El bootstrap no cambia cuentas existentes; si el
email ya pertenece a un usuario no administrador, el servidor informa el
conflicto en vez de elevar sus permisos. Quitar ambas variables del archivo
`.env` luego de crear la cuenta.

## Desarrollo local

Requiere Node.js 22 o superior. Configurar `.env` a partir de `.env.example`.
Instalar e iniciar el backend:

```powershell
npm install
npm run dev
```

En otra terminal, iniciar el frontend:

```powershell
npm install --prefix frontend
npm run dev --prefix frontend
```

Vite sirve la interfaz en <http://localhost:5173> y reenvía `/api` a la API
local en el puerto `3000`. El backend crea o actualiza el esquema SQLite al
iniciar. Por defecto, `DATABASE_URL=file:./dev.db` crea la base en `prisma/dev.db`.

## Reservas y créditos

- La hora local del coworking es `America/Argentina/Cordoba`.
- Los turnos empiezan en punto entre las 08:00 y las 19:00 inclusive; el local
  opera hasta las 20:00.
- Cada turno dura una hora y cuesta 50 créditos.
- No se permiten reservas para horarios pasados ni dos reservas confirmadas de
  la misma sala en el mismo turno.
- El cobro y la creación de la reserva se ejecutan en una transacción SQLite.
- Cancelar libera el turno. Se reembolsan los créditos al cancelar con **más
  de 24 horas** de anticipación; de lo contrario, no hay reembolso.
- Un usuario solo puede listar y cancelar sus propias reservas. `ADMIN` puede
  cancelar las de cualquier usuario.

## API REST

Las rutas protegidas requieren autenticación: enviar el access token obtenido
al iniciar sesión en la cabecera HTTP `Authorization`.

| Método | Endpoint | Acceso |
|---|---|---|
| `GET` | `/health` | Público |
| `POST` | `/api/registro` | Público |
| `POST` | `/api/login` | Público; máximo 5 intentos por IP cada 15 minutos |
| `POST` | `/api/refresh` | Refresh token |
| `GET` | `/api/perfil` | Usuario autenticado |
| `GET` | `/api/salas` | Público |
| `GET` | `/api/salas/disponibles?fecha=AAAA-MM-DD&hora=HH:00&capacidad=1` | Público |
| `POST` | `/api/salas` | `EDITOR` o `ADMIN` |
| `PUT` | `/api/salas/:id` | `EDITOR` o `ADMIN` |
| `GET` | `/api/reservas` | Usuario autenticado; solo sus reservas |
| `POST` | `/api/reservas` | Usuario autenticado |
| `DELETE` | `/api/reservas/:id` | Propietario o `ADMIN` |

Crear una reserva:

```http
POST /api/reservas
Content-Type: application/json
```

Incluir en esta solicitud la cabecera `Authorization` con el esquema de
autenticación de la API y el access token de la sesión.

```json
{
  "salaId": "id-de-la-sala",
  "fecha": "2099-04-15",
  "hora": "10:00"
}
```

La respuesta exitosa es `201 Created` e incluye la reserva confirmada. Una sala
ocupada o un saldo insuficiente devuelve `409 Conflict`; una entrada inválida
devuelve `400 Bad Request`. Al cancelar, la respuesta incluye la reserva y el
campo `reembolsado`:

```json
{
  "reserva": {
    "id": "id-de-la-reserva",
    "estado": "Cancelada"
  },
  "reembolsado": true
}
```

## Usuarios demo en desarrollo

En `NODE_ENV=development` se cargan estas cuentas automáticamente:

| Rol | Email | Contraseña |
|---|---|---|
| `ADMIN` | `admin@example.com` | `Admin123` |
| `EDITOR` | `editor@example.com` | `Editor123` |
| `USER` | `usuario@example.com` | `User123` |

Son credenciales de demostración: no usarlas fuera de un entorno local.

## Pruebas y builds

```powershell
npm run build
npm run test:e2e
npm run test:api
npm run build --prefix frontend
```

`test:e2e` ejecuta los escenarios BDD. `test:api` verifica persistencia,
disponibilidad, prevención de solapamientos, saldo, reembolsos y permisos usando
una base de datos SQLite de prueba.

La suite BDD actual contiene 12 escenarios y 51 pasos. Se conservan las
[evidencias de las fases XP](docs/Fases/faseRED.png) ([GREEN](docs/Fases/faseGREEN.png))
y las [capturas de pruebas de seguridad anteriores](docs/seguridad/Build-Test.png).
Las capturas de Postman que muestran artículos o edición por propietario
pertenecen a una versión anterior y no representan los endpoints actuales de
salas y reservas.

## Estructura del proyecto

```text
src/                 API Express, dominio, rutas y repositorios
prisma/              Esquema y base SQLite local
frontend/            Aplicación React/Vite
tests/api/           Pruebas de integración HTTP y SQLite
tests/step_definitions/
features/            Escenarios BDD
```

La API persiste usuarios, salas, reservas y refresh tokens con Prisma. El
frontend usa el proxy de Vite en desarrollo y Nginx con proxy `/api` en Docker.
