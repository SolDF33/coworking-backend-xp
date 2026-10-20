import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import { once } from 'node:events';
import { resolve } from 'node:path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
  After,
  AfterAll,
  Before,
  BeforeAll,
  Given,
  Then,
  When,
  setDefaultTimeout,
  setWorldConstructor,
  World
} from '@cucumber/cucumber';
import { app } from '../../src/index.js';
import { JWT_SECRET } from '../../src/middlewares/auth.middleware.js';
import { prisma } from '../../src/database/prisma.js';

interface ResultadoApi {
  status: number;
  body: {
    [key: string]: unknown;
    id?: string;
    estado?: string;
    saldoCreditos?: number;
    resultado?: unknown;
  };
}

interface UsuarioEscenario {
  id: string;
  token: string;
}

class SurCoworkWorld extends World {
  baseUrl = '';
  salaId = 'bdd-room';
  usuarioUno: UsuarioEscenario = { id: 'bdd-user-one', token: '' };
  usuarioDos: UsuarioEscenario = { id: 'bdd-user-two', token: '' };
  usuarioComun: UsuarioEscenario = { id: 'bdd-user-common', token: '' };
  administrador: UsuarioEscenario = { id: 'bdd-admin', token: '' };
  respuestasReserva: ResultadoApi[] = [];
  ultimaRespuesta: ResultadoApi | null = null;
  reporteId = '';
  tokenActivo = '';
}

setWorldConstructor(SurCoworkWorld);
setDefaultTimeout(20000);

let servidor: ReturnType<typeof app.listen>;
let baseUrl = '';

BeforeAll(async () => {
  await prisma.$connect();
  servidor = app.listen(0);
  await once(servidor, 'listening');
  const address = servidor.address();
  assert.ok(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}`;
});

Before(async function (this: SurCoworkWorld) {
  await prisma.refreshToken.deleteMany();
  await prisma.reportJob.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.sala.deleteMany();
  await prisma.usuario.deleteMany();

  const fixtures = [
    { id: this.usuarioUno.id, email: 'bdd-one@test.example', rol: 'USER', saldoCreditos: 100 },
    { id: this.usuarioDos.id, email: 'bdd-two@test.example', rol: 'USER', saldoCreditos: 100 },
    { id: this.usuarioComun.id, email: 'bdd-common@test.example', rol: 'USER', saldoCreditos: 100 },
    { id: this.administrador.id, email: 'bdd-admin@test.example', rol: 'ADMIN', saldoCreditos: 100 }
  ];
  const password = await bcrypt.hash('TestPassword123', 4);
  await prisma.usuario.createMany({
    data: fixtures.map((fixture) => ({
      ...fixture,
      nombre: fixture.email,
      password
    }))
  });
  await prisma.sala.create({
    data: {
      id: this.salaId,
      nombre: 'Sala BDD',
      descripcion: 'Sala de pruebas BDD',
      capacidad: 8
    }
  });

  this.usuarioUno.token = jwt.sign({ id: this.usuarioUno.id, rol: 'USER' }, JWT_SECRET);
  this.usuarioDos.token = jwt.sign({ id: this.usuarioDos.id, rol: 'USER' }, JWT_SECRET);
  this.usuarioComun.token = jwt.sign({ id: this.usuarioComun.id, rol: 'USER' }, JWT_SECRET);
  this.administrador.token = jwt.sign({ id: this.administrador.id, rol: 'ADMIN' }, JWT_SECRET);
  this.baseUrl = baseUrl;
  this.respuestasReserva = [];
  this.ultimaRespuesta = null;
  this.reporteId = '';
  this.tokenActivo = '';
});

After(async () => {
  await prisma.refreshToken.deleteMany();
  await prisma.reportJob.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.sala.deleteMany();
  await prisma.usuario.deleteMany();
});

AfterAll(async () => {
  if (servidor) {
    servidor.close();
    await once(servidor, 'close');
  }
  await prisma.$disconnect();
  const databasePath = resolve('prisma', 'test-e2e.db');
  if (existsSync(databasePath)) unlinkSync(databasePath);
});

const llamarApi = async (
  base: string,
  ruta: string,
  token?: string,
  body?: unknown
): Promise<ResultadoApi> => {
  const headers = new Headers();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${base}${ruta}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return { status: response.status, body: await response.json() as ResultadoApi['body'] };
};

Given('una sala de prueba está disponible', function (this: SurCoworkWorld) {
  assert.ok(this.salaId);
});

Given('hay dos usuarios autenticados con 100 créditos', function (this: SurCoworkWorld) {
  assert.ok(this.usuarioUno.token && this.usuarioDos.token);
});

When(
  'ambos intentan reservar simultáneamente el turno {string} del {string}',
  async function (this: SurCoworkWorld, hora: string, fecha: string) {
    const enviar = (usuario: UsuarioEscenario) => llamarApi(
      this.baseUrl,
      '/api/reservas',
      usuario.token,
      { salaId: this.salaId, fecha, hora }
    );
    this.respuestasReserva = await Promise.all([
      enviar(this.usuarioUno),
      enviar(this.usuarioDos)
    ]);
  }
);

Then('solo una respuesta debe ser 201 y la otra 409', function (this: SurCoworkWorld) {
  assert.deepEqual(
    this.respuestasReserva.map(({ status }) => status).sort((a, b) => a - b),
    [201, 409]
  );
});

Then('un único saldo debe quedar en 50 y el otro en 100', async function (this: SurCoworkWorld) {
  const perfiles = await Promise.all([
    llamarApi(this.baseUrl, '/api/perfil', this.usuarioUno.token),
    llamarApi(this.baseUrl, '/api/perfil', this.usuarioDos.token)
  ]);
  assert.ok(perfiles.every(({ body }) => typeof body.saldoCreditos === 'number'));
  assert.deepEqual(
    perfiles.map(({ body }) => body.saldoCreditos!).sort((a, b) => a - b),
    [50, 100]
  );
});

Given('un usuario autenticado tiene 20 créditos', async function (this: SurCoworkWorld) {
  await prisma.usuario.update({
    where: { id: this.usuarioComun.id },
    data: { saldoCreditos: 20 }
  });
});

When(
  'intenta reservar el turno {string} del {string}',
  async function (this: SurCoworkWorld, hora: string, fecha: string) {
    this.ultimaRespuesta = await llamarApi(this.baseUrl, '/api/reservas', this.usuarioComun.token, {
      salaId: this.salaId,
      fecha,
      hora
    });
  }
);

Then('la reserva debe responder 409 y no crearse', async function (this: SurCoworkWorld) {
  assert.equal(this.ultimaRespuesta?.status, 409);
  assert.equal(await prisma.reserva.count({ where: { usuarioId: this.usuarioComun.id } }), 0);
});

Then('el saldo debe permanecer en 20 créditos', async function (this: SurCoworkWorld) {
  const perfil = await llamarApi(this.baseUrl, '/api/perfil', this.usuarioComun.token);
  assert.equal(perfil.body.saldoCreditos, 20);
});

Given('una sesión de administrador válida', function (this: SurCoworkWorld) {
  this.tokenActivo = this.administrador.token;
});

Given('una sesión de usuario común válida', function (this: SurCoworkWorld) {
  this.tokenActivo = this.usuarioComun.token;
});

When(
  'solicita un reporte para el período {string} a {string}',
  async function (this: SurCoworkWorld, fechaDesde: string, fechaHasta: string) {
    this.ultimaRespuesta = await llamarApi(this.baseUrl, '/api/reportes', this.tokenActivo, {
      fechaDesde,
      fechaHasta
    });
    if (this.ultimaRespuesta.status === 202) {
      const id = this.ultimaRespuesta.body.id;
      if (typeof id !== 'string') throw new Error('La API no devolvió el identificador del reporte');
      this.reporteId = id;
    }
  }
);

Then('la solicitud debe aceptarse con HTTP 202', function (this: SurCoworkWorld) {
  assert.equal(this.ultimaRespuesta?.status, 202);
});

Then('la API debe continuar respondiendo durante el procesamiento', async function (this: SurCoworkWorld) {
  const respuesta = await fetch(`${this.baseUrl}/health`);
  assert.equal(respuesta.status, 200);
  assert.ok(this.reporteId);
});

Then('el resultado del reporte debe quedar persistido', async function (this: SurCoworkWorld) {
  let reporte: ResultadoApi | undefined;
  for (let intento = 0; intento < 50; intento += 1) {
    reporte = await llamarApi(
      this.baseUrl,
      `/api/reportes/${encodeURIComponent(this.reporteId)}`,
      this.administrador.token
    );
    if (reporte.body.estado === 'completed' || reporte.body.estado === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(reporte?.status, 200);
  assert.equal(reporte?.body.estado, 'completed');
  assert.ok(reporte?.body.resultado);
  const guardado = await prisma.reportJob.findUnique({ where: { id: this.reporteId } });
  assert.equal(guardado?.status, 'completed');
  assert.ok(guardado?.resultJson);
});

Then('la solicitud del reporte debe rechazarse con HTTP 403', function (this: SurCoworkWorld) {
  assert.equal(this.ultimaRespuesta?.status, 403);
});

Then('no debe crearse un trabajo de reporte', async function () {
  assert.equal(await prisma.reportJob.count(), 0);
});
