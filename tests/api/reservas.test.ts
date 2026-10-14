import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import { once } from 'node:events';
import { after, before, test } from 'node:test';
import bcrypt from 'bcrypt';
import { app } from '../../src/index.js';
import { prisma } from '../../src/database/prisma.js';
import { ReservaRepository } from '../../src/repositories/reserva.repository.js';

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
  }
];

let servidor: ReturnType<typeof app.listen>;
let baseUrl: string;

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
