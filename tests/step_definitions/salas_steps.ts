import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { prisma } from '../../src/database/prisma.js';
import { JWT_SECRET } from '../../src/middlewares/auth.middleware.js';

let tokenActivoSalas = '';
let idSalaAEliminar = '';
let ultimoStatusSalas = 0;

Given('que existe una sala {string} en el sistema', async function (nombreSala: string) {
  idSalaAEliminar = `sala-test-${Date.now()}`;
  await prisma.sala.create({
    data: {
      id: idSalaAEliminar,
      nombre: nombreSala,
      descripcion: 'Sala para probar baja lógica',
      capacidad: 4,
      activa: true
    }
  });
});

Given('la sala no tiene reservas futuras confirmadas', function () {
  // Estado por defecto
});

Given('una sesión de administrador válida para salas', async function () {
  const idAdmin = `admin-test-${Date.now()}`;
  await prisma.usuario.create({
    data: {
      id: idAdmin,
      nombre: 'Admin Salas',
      email: `${idAdmin}@test.example`,
      password: 'hash',
      rol: 'ADMIN',
      saldoCreditos: 100
    }
  });
  tokenActivoSalas = jwt.sign({ id: idAdmin, rol: 'ADMIN' }, JWT_SECRET);
});

Given('una sesión de usuario común válida para salas', async function () {
  const idUser = `user-test-${Date.now()}`;
  await prisma.usuario.create({
    data: {
      id: idUser,
      nombre: 'User Salas',
      email: `${idUser}@test.example`,
      password: 'hash',
      rol: 'USER',
      saldoCreditos: 100
    }
  });
  tokenActivoSalas = jwt.sign({ id: idUser, rol: 'USER' }, JWT_SECRET);
});

Given('la sala {string} tiene una reserva futura confirmada', async function (_nombreSala: string) {
  const fechaFutura = new Date();
  fechaFutura.setDate(fechaFutura.getDate() + 2);
  const fechaStr = fechaFutura.toISOString().slice(0, 10) + 'T10:00';
  
  const usuarioExistente = await prisma.usuario.findFirst({ where: { rol: 'USER' } });
  if (!usuarioExistente) throw new Error('Se necesita un usuario para crear la reserva');

  await prisma.reserva.create({
    data: {
      id: `reserva-test-${Date.now()}`,
      usuarioId: usuarioExistente.id,
      sala: idSalaAEliminar,
      fecha: fechaStr,
      costoCreditos: 50,
      estado: 'Confirmada',
      bloqueActivo: `${idSalaAEliminar}:${fechaStr}`
    }
  });
});

When('solicita eliminar la sala {string}', async function (nombreSala: string) {
  // Usamos this.baseUrl que es provisto por el World de prd_steps.ts
  const response = await fetch(`${(this as any).baseUrl}/api/salas/${idSalaAEliminar}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${tokenActivoSalas}` }
  });
  ultimoStatusSalas = response.status;
});

Then('la respuesta debe ser {string}', function (statusEsperado: string) {
  assert.equal(ultimoStatusSalas, parseInt(statusEsperado, 10));
});

Then('la sala {string} no debe aparecer en el listado general de salas', async function (nombreSala: string) {
  const sala = await prisma.sala.findFirst({
    where: { nombre: nombreSala, activa: true }
  });
  assert.equal(sala, null, 'La sala debería estar inactiva');
});

Then('la sala {string} debe seguir activa en el sistema', async function (nombreSala: string) {
  const sala = await prisma.sala.findFirst({
    where: { nombre: nombreSala, activa: true }
  });
  assert.notEqual(sala, null, 'La sala debería seguir activa');
});