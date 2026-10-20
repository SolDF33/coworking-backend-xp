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

- Frontend: <http://localhost:8081>
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
| `GET` | `/api/reportes` | `ADMIN`; lista los 20 reportes más recientes |
| `POST` | `/api/reportes` | `ADMIN`; solicita un reporte |
| `GET` | `/api/reportes/:id` | `ADMIN`; consulta estado y resultado |
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
npm run test:load
npm run build --prefix frontend
```

`test:e2e` ejecuta los escenarios BDD. `test:api` verifica persistencia,
disponibilidad, prevención de solapamientos, saldo, reembolsos y permisos usando
una base de datos SQLite de prueba.

La suite BDD actual contiene 12 escenarios y 51 pasos.

### Evidencias históricas de Postman

Estas capturas corresponden a las pruebas de la versión anterior de la API.
Se conservan como evidencia histórica; las pruebas de artículos no representan
los endpoints actuales de salas y reservas.

| # | Prueba | Resultado esperado | Evidencia |
|---|---|---|---|
| 1 | `GET /health` | `200 OK` | [COWORKING-GET](docs/seguridad/COWORKING-GET.png) |
| 2 | `POST /api/registro` | `201 Created` | [Crear usuario](docs/seguridad/CrearUsuario.png) |
| 3 | `POST /api/login` válido | `200 OK` y JWT | [Iniciar sesión](docs/seguridad/IniciarSesión.png) |
| 4 | `GET /api/perfil` con JWT | `200 OK` | [Perfil con JWT](docs/seguridad/ConsultarPerfilConJWT.png) |
| 5 | `GET /api/perfil` sin JWT | `401 Unauthorized` | [Perfil sin token](docs/seguridad/ConsultaPerfilSinToken.png) |
| 6 | Crear artículo como ADMIN | `201 Created` | [Crear como ADMIN](docs/seguridad/CrearComoAdmin.png) |
| 7 | Crear artículo como USER | `403 Forbidden` | [Crear como USER](docs/seguridad/CrearComoUSER.png) |
| 8 | Login con contraseña incorrecta | `401 Unauthorized` | [Login incorrecto](docs/seguridad/LoginIncorrecto.png) |
| 9 | Email duplicado | `409 Conflict` | [Email duplicado](docs/seguridad/EmailDuplicado.png) |
| 10 | Build y BDD | Exitosos | [Build y tests](docs/seguridad/Build-Test.png) |
| 11 | `POST /api/refresh` | Nuevo token | [Refresh token](docs/seguridad/RefreshToken.png) |
| 12 | Sexto login inválido | `429 Too Many Requests` | [Rate limiting](docs/seguridad/RateLimiting.png) |
| 13 | Usuario no propietario edita | `403 Forbidden` | [Prueba IDOR](docs/seguridad/EditarComoUSER(IDOR).png) |
| 14 | Access token expirado | `403 Forbidden` | [Token expirado](docs/seguridad/RefreshToken3.png) |

Pruebas complementarias:

- CORS con origen permitido: [CORS](docs/seguridad/CORS.png).
- Edición por propietario: [Artículo propio](docs/seguridad/CrearComoEditor(IDOR).png).
- Edición por administrador: [Eliminar como ADMIN](docs/seguridad/EliminarUsuarioComoADMIN.png).
- Contraseña corta: [Contraseña corta](docs/seguridad/ContraseñaCorta.png).
- Email inválido: [Email inválido](docs/seguridad/EmailInvalido.png).

### Evidencias XP y BDD

![Fase RED](docs/Fases/faseRED.png)

![Fase GREEN](docs/Fases/faseGREEN.png)

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

## Anexo — Requerimientos de la etapa de concurrencia y reportes

Este anexo registra los avances de la etapa solicitada por el cliente. Las
secciones y evidencias anteriores se conservan como historial del proyecto.

### Reservas concurrentes

- Las reservas y el descuento de créditos se ejecutan atómicamente.
- La base de datos impide más de una reserva activa para la misma sala y turno.
- Si hay solicitudes simultáneas, solo una puede reservar el turno; las demás
  reciben `409 Conflict` sin perder créditos.
- El descuento condicional de créditos impide un saldo negativo aunque un mismo
  usuario intente reservar varios turnos a la vez.

### Reportes administrativos

- `POST /api/reportes` recibe `fechaDesde` y `fechaHasta` inclusivas en formato
  `AAAA-MM-DD`; responde `202 Accepted` con un identificador y estado `queued`.
- `GET /api/reportes/:id` devuelve el estado (`queued`, `running`,
  `completed` o `failed`) y, al completarse, el total de reservas y
  cancelaciones, también desglosado por sala.
- `GET /api/reportes` lista los 20 reportes más recientes para que ADMIN pueda
  recuperar reportes solicitados anteriormente, incluso después de reiniciar o
  abrir la interfaz en otro navegador.
- Todos los endpoints de reportes requieren token de sesión válido y rol
  `ADMIN`. Las solicitudes sin autenticación reciben `401`; un rol sin permiso
  recibe `403`.
- El cálculo corre en un worker thread. El estado y el resultado se guardan en
  SQLite; los trabajos interrumpidos durante el estado `running` se reencolan al
  reiniciar el backend.
- El período cuenta las reservas por su fecha de creación y las cancelaciones
  por su fecha de cancelación. No es posible reconstruir fechas de cancelación
  históricas que no se guardaban antes de esta etapa.
- La interfaz administrativa permite solicitar el reporte, ver su estado y
  consultar los resultados.

### Verificación automatizada de esta etapa

Los escenarios BDD anteriores siguen registrados arriba como evidencia de la
etapa previa: 12 escenarios y 51 pasos. Con los nuevos escenarios, la suite
actual ejecuta **16 escenarios y 101 pasos**. `npm run test:api` agrega pruebas
de simultaneidad, saldo insuficiente, permisos y persistencia/recuperación de
reportes.

`npm run test:load` usa una base SQLite de prueba independiente de la base local
y del volumen Docker. Envía 25 reservas simultáneas para el mismo turno y mide
la respuesta concurrente, además de contrastar la aceptación en segundo plano
con un cálculo síncrono de referencia sobre 5.001 registros. Para la corrida
registrada:

| Medición | Resultado |
|---|---:|
| Intentos de reserva simultáneos | 25 |
| Reservas exitosas / conflictos esperados / errores inesperados | 1 / 24 / 0 |
| Cálculo síncrono de referencia (5.001 registros) | 44,64 ms |
| Aceptación HTTP del reporte en segundo plano | 27,51 ms |
| Reducción de latencia de aceptación vs. referencia | 38,37 % |
| `/health` durante el procesamiento | HTTP 200 en 3,72 ms |
| Reporte completado | 349,10 ms |

Los tiempos son evidencia de una ejecución y pueden variar según el equipo. El
comando imprime mediciones nuevas cada vez que se ejecuta.

### Evidencias recomendadas en Postman

Sí: conviene probar los endpoints REST en Postman y guardar capturas de
solicitud y respuesta como evidencia para la presentación. Usar como URL base
`http://localhost:3000` con Docker o `http://localhost:3000` en desarrollo
local.

#### Concurrencia de reservas

1. Iniciar sesión con dos cuentas `USER` distintas mediante `POST /api/login`.
   Cada cuenta debe tener al menos 50 créditos; guardar cada token en una
   variable local separada de Postman.
2. Elegir una sala existente con `GET /api/salas` y un turno futuro libre.
   Preparar dos solicitudes `POST /api/reservas` con el mismo `salaId`, `fecha`
   y `hora`, usando el token de cada usuario.
3. Enviar las solicitudes casi al mismo tiempo. Debe resultar exactamente una
   respuesta `201 Created` y otra `409 Conflict`.
4. Consultar `GET /api/perfil` y `GET /api/reservas` con ambos tokens: al
   ganador se le deben descontar exactamente 50 créditos y debe aparecerle una
   reserva; el otro debe conservar su saldo y no tener esa reserva.
5. Para evidencia reproducible de solicitudes realmente simultáneas, ejecutar
   `npm run test:load`. El Runner de Postman no garantiza que solicitudes de
   una colección se envíen en paralelo.

#### Persistencia después de reiniciar

1. Antes del reinicio, guardar el saldo de un usuario, el registro de una
   reserva exitosa y el identificador de un reporte completado.
2. Ejecutar `docker compose restart` y esperar a que `GET /health` responda
   nuevamente `200`.
3. Repetir `GET /api/perfil` y `GET /api/reservas` con el mismo usuario, y
   `GET /api/reportes/{{reportId}}` con ADMIN. El saldo, la reserva y el
   resultado deben seguir guardados. No usar `docker compose down -v`.

#### Reportes y autorización

1. Iniciar sesión con una cuenta `ADMIN` mediante `POST /api/login`, con
   `email` y `password` en JSON. Guardar el `token` devuelto en una variable
   local de Postman y usar la autorización **Bearer Token** en las siguientes
   solicitudes.
2. Solicitar un reporte con `POST /api/reportes` y un JSON como
   `{"fechaDesde":"2026-10-01","fechaHasta":"2026-10-31"}`. Evidenciar
   `202 Accepted` y guardar el `id` devuelto.
3. Consultar `GET /api/reportes/{{reportId}}` hasta que el estado sea
   `completed`; guardar la respuesta con los conteos del reporte.
4. Probar permisos: `GET /api/reportes/{{reportId}}` sin token debe devolver
   `401`; con una sesión `USER` debe devolver `403`.
5. Probar validación de rango enviando una fecha inicial posterior a la final;
   debe devolver `400`.
6. Adjuntar la salida de `npm run test:load` junto a las capturas, como
   evidencia de la concurrencia real probada automáticamente.

No incluir contraseñas, JWT ni otros secretos en capturas o en una colección
exportada. Usar variables locales o secretos de Postman y ocultar el encabezado
`Authorization` en la evidencia.

### Índice de evidencias entregadas

Las capturas recibidas están guardadas en [`docs/Requerimientos/`](docs/Requerimientos/).
Este índice se agrega al registro para identificar qué criterio demuestra cada
archivo, sin reemplazar ni eliminar las evidencias históricas anteriores.

| Evidencia | Qué muestra | Criterio relacionado |
|---|---|---|
| [02- Concurrencia201.png](docs/Requerimientos/02-%20Concurrencia201.png) | Reserva creada con `201 Created`, turno, sala y costo de 50 créditos. | HU01: reserva exitosa y descuento esperado. |
| [02- Concurrencia409.png](docs/Requerimientos/02-%20Concurrencia409.png) | El mismo turno ocupado responde `409 Conflict`. | HU01: evitar una reserva duplicada. La simultaneidad se demuestra con la prueba de carga, no solo con esta captura secuencial. |
| [02- ConcurrenciaTest.png](docs/Requerimientos/02-%20ConcurrenciaTest.png) | `npm run test:load`: 25 solicitudes, 1 exitosa, 24 conflictos y 0 errores inesperados. | RNF01 y RNF08: concurrencia y resultados de carga. |
| [03-reporte.png](docs/Requerimientos/03-reporte.png) | Reporte completado, con fechas, cantidades y desglose por sala. | HU02: consultar el resultado del reporte. |
| [03-reporte401.png](docs/Requerimientos/03-reporte401.png) | Solicitud de reporte sin token, rechazada con `401 Unauthorized`. | RNF05: autenticación requerida. |
| [03-reporte403.png](docs/Requerimientos/03-reporte403.png) | Solicitud con usuario sin rol ADMIN, rechazada con `403 Forbidden`. | HU02 y RNF05: autorización por rol. |
| [04-Persistencia.png](docs/Requerimientos/04-Persistencia.png) | Pantalla de administración con el reporte completado después de ejecutar `docker compose restart`. | HU02 y RNF04: recuperación del resultado tras reiniciar. |
| [Test-Api.png](docs/Requerimientos/Test-Api.png) | Cuatro pruebas de integración aprobadas, incluidas concurrencia, saldo y reportes. | RNF02, RNF04 y RNF09. |
| [Test-e2e.png](docs/Requerimientos/Test-e2e.png) | 16 escenarios y 101 pasos BDD aprobados. | RNF09 y escenarios de aceptación. |
| [Test-load.png](docs/Requerimientos/Test-load.png) | Resultados medidos de carga concurrente y prueba de reporte en segundo plano. | RNF01, RNF03 y RNF08. |

La corrida de carga capturada en `Test-load.png` informa:

| Medición capturada | Resultado |
|---|---:|
| Solicitudes de reserva concurrentes | 25 |
| Exitosas / conflictos esperados / errores inesperados | 1 / 24 / 0 |
| Latencia media de reserva / p95 | 386,83 ms / 440,15 ms |
| Registros incluidos en la prueba del reporte | 5.001 |
| Referencia de cálculo síncrono / aceptación del trabajo asíncrono | 42,58 ms / 20,77 ms |
| Reducción de latencia de aceptación indicada por el test | 51,23 % |
| Respuesta de `/health` durante el procesamiento | HTTP 200 en 2,48 ms |
| Tiempo hasta completar el reporte | 437,44 ms |

La comparación anterior es entre una lectura y conteo síncronos de referencia y
el tiempo de aceptación del trabajo asíncrono; no representa una comparación
entre dos versiones equivalentes del mismo endpoint ni mide por sí sola el
tiempo total del cálculo. Para la presentación, describirla con ese alcance y
destacar que el resultado final se completó y que `/health` respondió durante
el procesamiento.

#### Capturas de login pendientes de sanitización

Los archivos `01-login.png`, `01-login2.png` y `01-login3.png` muestran
contraseñas en texto y, en las capturas de login, tokens de acceso y/o refresh.
No deben publicarse, adjuntarse a la entrega ni compartirse tal como están.
Reemplazarlos por capturas recortadas o redactadas que oculten esos valores; si
se van a incluir, verificar las imágenes sanitizadas antes de enlazarlas aquí.
Los tokens de acceso vencen en 15 minutos, pero los refresh tokens pueden
seguir siendo válidos hasta 7 días; no reutilizar ni distribuir los que hayan
quedado visibles.
