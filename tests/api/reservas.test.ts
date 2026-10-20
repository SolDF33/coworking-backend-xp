import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import bcrypt from 'bcrypt';
import { app } from '../../src/index.js';
import { prisma } from '../../src/database/prisma.js';
import { ReservaRepository } from '../../src/repositories/reserva.repository.js';
import { ReporteRepository } from '../../src/repositories/reporte.repository.js';
import { ReporteService } from '../../src/services/reporte.service.js';

const repository = new ReservaRepository(prisma);
const usuarios = [
  {
    id: 'test-user-one',
    nombre: 'Usuario Uno',
    email: 'uno@test.example',
    password: '',
    rol: 'USER' as const,
    saldoCreditos: 100
  },
  {
    id: 'test-user-two',
    nombre: 'Usuario Dos',
    email: 'dos@test.example',
    password: '',
    rol: 'USER' as const,
    saldoCreditos: 100
  },
  {
    id: 'test-admin',
    nombre: 'Admin Test',
    email: 'admin@test.example',
    password: '',
    rol: 'ADMIN' as const,
    saldoCreditos: 100
  }
];

let servidor: ReturnType<typeof app.listen>;
let baseUrl: string;
let tokenUsuarioUno: string;
let tokenUsuarioDos: string;
let tokenAdmin: string;

const llamarApi = async <T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<{ status: number; body: T }> => {
  const headers = new Headers(options.headers);
  if (options.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  return { status: response.status, body: (await response.json()) as T };
};

before(async () => {
  await prisma.$connect();
  await prisma.refreshToken.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.sala.deleteMany();
  await prisma.usuario.deleteMany();

  for (const usuario of usuarios) {
    await repository.guardarUsuario({
      ...usuario,
      password: await bcrypt.hash('TestPassword123', 4)
    });
  }
  await repository.guardarSala({
    id: 'test-room-one',
    nombre: 'Sala Test',
    descripcion: 'Sala para pruebas de disponibilidad',
    capacidad: 8
  });

  servidor = app.listen(0);
  await once(servidor, 'listening');
  const address = servidor.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (servidor) {
    servidor.close();
    await once(servidor, 'close');
  }
  await prisma.$disconnect();
  const databasePath = new URL('../../prisma/test-reservas.db', import.meta.url);
  if (existsSync(databasePath)) unlinkSync(databasePath);
});

test('reserva turnos disponibles, cobra créditos y protege las reservas de otros usuarios', async () => {
  const loginUno = await llamarApi<{ token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: usuarios[0].email, password: 'TestPassword123' })
  });
  const loginDos = await llamarApi<{ token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: usuarios[1].email, password: 'TestPassword123' })
  });
  assert.equal(loginUno.status, 200);
  assert.equal(loginDos.status, 200);
  tokenUsuarioUno = loginUno.body.token;
  tokenUsuarioDos = loginDos.body.token;
  const loginAdmin = await llamarApi<{ token: string }>('/api/login', {
    method: 'POST',
    body: JSON.stringify({ email: usuarios[2].email, password: 'TestPassword123' })
  });
  assert.equal(loginAdmin.status, 200);
  tokenAdmin = loginAdmin.body.token;

  const fecha = '2099-04-15';
  const salaId = 'test-room-one';
  const disponibilidad = await llamarApi<Array<{ id: string }>>(
    `/api/salas/disponibles?fecha=${fecha}&hora=10%3A00&capacidad=4`
  );
  assert.equal(disponibilidad.status, 200);
  assert.equal(disponibilidad.body[0].id, salaId);

  const reserva = await llamarApi<{ id: string; costoCreditos: number }>(
    '/api/reservas',
    {
      method: 'POST',
      body: JSON.stringify({ salaId, fecha, hora: '10:00' })
    },
    loginUno.body.token
  );
  assert.equal(reserva.status, 201);
  assert.equal(reserva.body.costoCreditos, 50);

  const saldoUno = await llamarApi<{ saldoCreditos: number }>('/api/perfil', {}, loginUno.body.token);
  assert.equal(saldoUno.body.saldoCreditos, 50);

  const bloqueada = await llamarApi<{ error: string }>(
    '/api/reservas',
    {
      method: 'POST',
      body: JSON.stringify({ salaId, fecha, hora: '10:00' })
    },
    loginDos.body.token
  );
  assert.equal(bloqueada.status, 409);

  const datosAjeno = await llamarApi(
    `/api/reservas/${reserva.body.id}`,
    { method: 'DELETE' },
    loginDos.body.token
  );
  assert.equal(datosAjeno.status, 403);

  const cancelacion = await llamarApi<{ reembolsado: boolean }>(
    `/api/reservas/${reserva.body.id}`,
    { method: 'DELETE' },
    loginUno.body.token
  );
  assert.equal(cancelacion.status, 200);
  assert.equal(cancelacion.body.reembolsado, true);
  const saldoReintegrado = await llamarApi<{ saldoCreditos: number }>(
    '/api/perfil',
    {},
    loginUno.body.token
  );
  assert.equal(saldoReintegrado.body.saldoCreditos, 100);

  const reabierta = await llamarApi<Array<{ id: string }>>(
    `/api/salas/disponibles?fecha=${fecha}&hora=10%3A00&capacidad=4`
  );
  assert.equal(reabierta.body.length, 1);

  for (const hora of ['10:00', '11:00']) {
    const confirmada = await llamarApi(
      '/api/reservas',
      {
        method: 'POST',
        body: JSON.stringify({ salaId, fecha, hora })
      },
      loginDos.body.token
    );
    assert.equal(confirmada.status, 201);
  }

  const saldoAgotado = await llamarApi<{ saldoCreditos: number }>(
    '/api/perfil',
    {},
    loginDos.body.token
  );
  assert.equal(saldoAgotado.body.saldoCreditos, 0);

  const insuficiente = await llamarApi<{ error: string }>(
    '/api/reservas',
    {
      method: 'POST',
      body: JSON.stringify({ salaId, fecha, hora: '12:00' })
    },
    loginDos.body.token
  );
  assert.equal(insuficiente.status, 409);
  const saldoSinCambios = await llamarApi<{ saldoCreditos: number }>(
    '/api/perfil',
    {},
    loginDos.body.token
  );
  assert.equal(saldoSinCambios.body.saldoCreditos, 0);

  const fueraDeHorario = await llamarApi<{ error: string }>(
    '/api/reservas',
    {
      method: 'POST',
      body: JSON.stringify({ salaId, fecha, hora: '20:00' })
    },
    loginUno.body.token
  );
  assert.equal(fueraDeHorario.status, 400);
});

test('dos reservas simultáneas del mismo turno crean una sola reserva y cobran una sola vez', async () => {
  await prisma.usuario.updateMany({
    where: { id: { in: [usuarios[0].id, usuarios[1].id] } },
    data: { saldoCreditos: 100 }
  });
  const fecha = '2099-04-16';
  const solicitud = (token: string) => llamarApi<{ error?: string }>(
    '/api/reservas',
    {
      method: 'POST',
      body: JSON.stringify({ salaId: 'test-room-one', fecha, hora: '10:00' })
    },
    token
  );

  const resultados = await Promise.all([
    solicitud(tokenUsuarioUno),
    solicitud(tokenUsuarioDos)
  ]);
  assert.deepEqual(resultados.map(({ status }) => status).sort(), [201, 409]);
  assert.equal(
    await prisma.reserva.count({ where: { sala: 'test-room-one', fecha: `${fecha}T10:00`, estado: 'Confirmada' } }),
    1
  );

  const perfiles = await Promise.all([
    llamarApi<{ saldoCreditos: number }>('/api/perfil', {}, tokenUsuarioUno),
    llamarApi<{ saldoCreditos: number }>('/api/perfil', {}, tokenUsuarioDos)
  ]);
  assert.deepEqual(perfiles.map(({ body }) => body.saldoCreditos).sort((a, b) => a - b), [50, 100]);
});

test('reservas simultáneas en turnos distintos no gastan dos veces el saldo disponible', async () => {
  await prisma.usuario.update({
    where: { id: usuarios[0].id },
    data: { saldoCreditos: 50 }
  });
  const fecha = '2099-04-17';
  const crear = (hora: string) => llamarApi<{ error?: string }>(
    '/api/reservas',
    {
      method: 'POST',
      body: JSON.stringify({ salaId: 'test-room-one', fecha, hora })
    },
    tokenUsuarioUno
  );
  const resultados = await Promise.all([crear('10:00'), crear('11:00')]);
  assert.deepEqual(resultados.map(({ status }) => status).sort(), [201, 409]);
  const perfil = await llamarApi<{ saldoCreditos: number }>('/api/perfil', {}, tokenUsuarioUno);
  assert.equal(perfil.body.saldoCreditos, 0);
  assert.equal(await prisma.reserva.count({
    where: {
      usuarioId: usuarios[0].id,
      sala: 'test-room-one',
      fecha: { in: [`${fecha}T10:00`, `${fecha}T11:00`] },
      estado: 'Confirmada'
    }
  }), 1);
});

test('reportes de utilización requieren ADMIN y persisten su resultado al completarse', async () => {
  const reportesAntes = await prisma.reportJob.count();
  const sinSesion = await llamarApi<{ error: string }>('/api/reportes', {
    method: 'POST',
    body: JSON.stringify({ fechaDesde: '2099-04-15', fechaHasta: '2099-04-16' })
  });
  assert.equal(sinSesion.status, 401);

  const sinPermiso = await llamarApi<{ error: string }>(
    '/api/reportes',
    {
      method: 'POST',
      body: JSON.stringify({ fechaDesde: '2099-04-15', fechaHasta: '2099-04-16' })
    },
    tokenUsuarioUno
  );
  assert.equal(sinPermiso.status, 403);
  assert.equal(await prisma.reportJob.count(), reportesAntes);
  const lecturaSinPermiso = await llamarApi<{ error: string }>(
    '/api/reportes/no-existe',
    {},
    tokenUsuarioUno
  );
  assert.equal(lecturaSinPermiso.status, 403);
  const listadoSinPermiso = await llamarApi<{ error: string }>('/api/reportes', {}, tokenUsuarioUno);
  assert.equal(listadoSinPermiso.status, 403);

  const invalido = await llamarApi<{ error: string }>(
    '/api/reportes',
    {
      method: 'POST',
      body: JSON.stringify({ fechaDesde: '2099-04-17', fechaHasta: '2099-04-16' })
    },
    tokenAdmin
  );
  assert.equal(invalido.status, 400);

  const hoy = new Date().toISOString().slice(0, 10);
  const creado = await llamarApi<{ id: string; estado: string }>(
    '/api/reportes',
    {
      method: 'POST',
      body: JSON.stringify({ fechaDesde: hoy, fechaHasta: hoy })
    },
    tokenAdmin
  );
  assert.equal(creado.status, 202);
  assert.equal(creado.body.estado, 'queued');

  let reporte: { estado: string; resultado: { reservas: number; cancelaciones: number } | null } | undefined;
  for (let intento = 0; intento < 50; intento += 1) {
    const consulta = await llamarApi<typeof reporte>(
      `/api/reportes/${encodeURIComponent(creado.body.id)}`,
      {},
      tokenAdmin
    );
    assert.equal(consulta.status, 200);
    reporte = consulta.body;
    if (reporte?.estado === 'completed' || reporte?.estado === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(reporte?.estado, 'completed');
  assert.ok(reporte.resultado);
  assert.ok(reporte.resultado.reservas >= 1);
  assert.ok(reporte.resultado.cancelaciones >= 1);
  const listado = await llamarApi<Array<{ id: string; estado: string }>>(
    '/api/reportes',
    {},
    tokenAdmin
  );
  assert.equal(listado.status, 200);
  assert.ok(listado.body.some((item) => item.id === creado.body.id && item.estado === 'completed'));
  const persistido = await prisma.reportJob.findUnique({ where: { id: creado.body.id } });
  assert.equal(persistido?.status, 'completed');
  assert.ok(persistido?.resultJson);
  const servicioTrasReinicio = new ReporteService(new ReporteRepository(prisma));
  assert.equal((await servicioTrasReinicio.consultar(creado.body.id)).estado, 'completed');

  await prisma.reportJob.create({
    data: {
      id: 'reporte-interrumpido',
      dateFrom: hoy,
      dateTo: hoy,
      status: 'running'
    }
  });
  await servicioTrasReinicio.reanudarPendientes();
  let estadoRecuperado = 'running';
  for (let intento = 0; intento < 50 && estadoRecuperado !== 'completed'; intento += 1) {
    estadoRecuperado = (await servicioTrasReinicio.consultar('reporte-interrumpido')).estado;
    if (estadoRecuperado !== 'completed') await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(estadoRecuperado, 'completed');
});
