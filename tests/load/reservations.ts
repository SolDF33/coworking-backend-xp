import assert from 'node:assert/strict';
import { existsSync, unlinkSync } from 'node:fs';
import { once } from 'node:events';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { after, before, test } from 'node:test';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { app } from '../../src/index.js';
import { JWT_SECRET } from '../../src/middlewares/auth.middleware.js';
import { prisma } from '../../src/database/prisma.js';

const TOTAL_USUARIOS = 25;
const salaId = 'load-test-room';
const fechaTurno = '2099-05-21';
const idUsuarios = Array.from({ length: TOTAL_USUARIOS }, (_, index) => `load-user-${index}`);
const tokens = idUsuarios.map((id) => jwt.sign({ id, rol: 'USER' }, JWT_SECRET));
let servidor: ReturnType<typeof app.listen>;
let baseUrl = '';

interface RespuestaHttp {
  status: number;
  body: Record<string, unknown>;
  elapsedMs: number;
}

const llamarApi = async (
  path: string,
  token?: string,
  body?: unknown
): Promise<RespuestaHttp> => {
  const started = performance.now();
  const headers = new Headers();
  if (token) headers.set('Authorization', 'Bearer ' + token);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  return {
    status: response.status,
    body: await response.json() as Record<string, unknown>,
    elapsedMs: performance.now() - started
  };
};

before(async () => {
  await prisma.$connect();
  await prisma.reportJob.deleteMany();
  await prisma.refreshToken.deleteMany();
  await prisma.reserva.deleteMany();
  await prisma.sala.deleteMany();
  await prisma.usuario.deleteMany();
  const password = await bcrypt.hash('LoadTestPassword123', 4);
  await prisma.usuario.createMany({
    data: idUsuarios.map((id, index) => ({
      id,
      nombre: `Load user ${index}`,
      email: `load-${index}@test.example`,
      password,
      rol: 'USER',
      saldoCreditos: 100
    }))
  });
  await prisma.sala.create({
    data: { id: salaId, nombre: 'Sala de carga', descripcion: 'Pruebas concurrentes', capacidad: 8 }
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
  const databasePath = resolve('prisma', 'load-test.db');
  if (existsSync(databasePath)) unlinkSync(databasePath);
});

test('carga concurrente y latencia de reportes asíncronos', async () => {
  const inicioCarga = performance.now();
  const reservas = await Promise.all(tokens.map((token) => llamarApi(
    '/api/reservas',
    token,
    { salaId, fecha: fechaTurno, hora: '10:00' }
  )));
  const tiempoCargaMs = performance.now() - inicioCarga;
  const exitosas = reservas.filter(({ status }) => status === 201);
  const conflictos = reservas.filter(({ status }) => status === 409);
  const otrosErrores = reservas.filter(({ status }) => status !== 201 && status !== 409);
  assert.equal(exitosas.length, 1);
  assert.equal(conflictos.length, TOTAL_USUARIOS - 1);
  assert.equal(otrosErrores.length, 0);
  assert.equal(await prisma.reserva.count({ where: { sala: salaId, fecha: `${fechaTurno}T10:00` } }), 1);
  assert.equal(await prisma.usuario.aggregate({ _sum: { saldoCreditos: true } }).then((row) => row._sum.saldoCreditos), TOTAL_USUARIOS * 100 - 50);
  const latencias = reservas.map(({ elapsedMs }) => elapsedMs).sort((a, b) => a - b);

  const hoy = new Date().toISOString().slice(0, 10);
  const inicio = new Date(`${hoy}T00:00:00.000Z`);
  const fin = new Date(`${hoy}T00:00:00.000Z`);
  fin.setUTCDate(fin.getUTCDate() + 1);
  const cargaReporte = Array.from({ length: 5000 }, (_, index) => ({
    id: `load-report-${index}`,
    usuarioId: idUsuarios[0],
    sala: salaId,
    fecha: `${fechaTurno}T${String(8 + (index % 12)).padStart(2, '0')}:00`,
    costoCreditos: 50,
    estado: index % 2 === 0 ? 'Confirmada' : 'Cancelada',
    bloqueActivo: null,
    createdAt: new Date(),
    canceledAt: index % 2 === 0 ? null : new Date()
  }));
  await prisma.reserva.createMany({ data: cargaReporte });

  const inicioInline = performance.now();
  const filas = await prisma.reserva.findMany({
    where: {
      OR: [
        { createdAt: { gte: inicio, lt: fin } },
        { canceledAt: { gte: inicio, lt: fin } }
      ]
    },
    select: { sala: true, createdAt: true, canceledAt: true }
  });
  let reservasEnLinea = 0;
  let cancelacionesEnLinea = 0;
  for (const fila of filas) {
    if (fila.createdAt >= inicio && fila.createdAt < fin) reservasEnLinea += 1;
    if (fila.canceledAt && fila.canceledAt >= inicio && fila.canceledAt < fin) cancelacionesEnLinea += 1;
  }
  const tiempoInlineMs = performance.now() - inicioInline;
  assert.ok(reservasEnLinea >= 5000);
  assert.ok(cancelacionesEnLinea >= 2499);

  const tokenAdmin = jwt.sign({ id: 'load-admin', rol: 'ADMIN' }, JWT_SECRET);
  await prisma.usuario.create({
    data: {
      id: 'load-admin',
      nombre: 'Load admin',
      email: 'load-admin@test.example',
      password: await bcrypt.hash('LoadTestPassword123', 4),
      rol: 'ADMIN',
      saldoCreditos: 100
    }
  });
  const inicioReporte = performance.now();
  const solicitudReporte = await llamarApi('/api/reportes', tokenAdmin, {
    fechaDesde: hoy,
    fechaHasta: hoy
  });
  const aceptacionReporteMs = performance.now() - inicioReporte;
  assert.equal(solicitudReporte.status, 202);
  const inicioHealth = performance.now();
  assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
  const saludDuranteReporteMs = performance.now() - inicioHealth;

  let estado = '';
  let resultadoReporte: Record<string, unknown> = {};
  for (let intento = 0; intento < 200; intento += 1) {
    const consulta = await llamarApi(
      `/api/reportes/${encodeURIComponent(String(solicitudReporte.body.id))}`,
      tokenAdmin
    );
    assert.equal(consulta.status, 200);
    estado = String(consulta.body.estado);
    if (consulta.body.resultado && typeof consulta.body.resultado === 'object') {
      resultadoReporte = consulta.body.resultado as Record<string, unknown>;
    }
    if (estado === 'completed' || estado === 'failed') break;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const tiempoReporteTotalMs = performance.now() - inicioReporte;
  assert.equal(estado, 'completed');
  assert.ok(Number(resultadoReporte.reservas) >= 5001);
  assert.ok(Number(resultadoReporte.cancelaciones) >= 2500);

  console.log(JSON.stringify({
    concurrencia: {
      solicitudes: TOTAL_USUARIOS,
      exitosas: exitosas.length,
      conflictosEsperados: conflictos.length,
      fallosInesperados: otrosErrores.length,
      tiempoLoteMs: Number(tiempoCargaMs.toFixed(2)),
      promedioSolicitudMs: Number((reservas.reduce((sum, item) => sum + item.elapsedMs, 0) / reservas.length).toFixed(2)),
      p95SolicitudMs: Number(latencias[Math.ceil(latencias.length * 0.95) - 1].toFixed(2))
    },
    reporte: {
      filasProcesadas: filas.length,
      baselineSinWorkerMs: Number(tiempoInlineMs.toFixed(2)),
      aceptacionSegundoPlanoMs: Number(aceptacionReporteMs.toFixed(2)),
      reduccionLatenciaAceptacionVsBaselinePct: Number(((1 - aceptacionReporteMs / tiempoInlineMs) * 100).toFixed(2)),
      tiempoHastaResultadoMs: Number(tiempoReporteTotalMs.toFixed(2)),
      solicitudesSaludDuranteProcesamiento: 'HTTP 200',
      latenciaSaludDuranteReporteMs: Number(saludDuranteReporteMs.toFixed(2))
    }
  }, null, 2));
});
