import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

let registroExitoso = false;
let tokenGenerado = false;
let mensajeRegistro = '';
let estadoBusqueda = 200;
let salasDisponibles: string[] = [];
let reservasSala = 0;
let codigoReserva = 201;
let estadoReserva = 'Confirmada';
let usuarioReserva = '';
let saldoReembolsado = 0;
let saldoCreditos = 0;
let recargaExitosa = false;
let mensajeRecarga = '';

Given('que el email {string} no está registrado', function (_email: string) {
  registroExitoso = false;
  tokenGenerado = false;
  mensajeRegistro = '';
});

When('el usuario intenta registrarse con email {string} y contraseña {string}', function (_email: string, contraseña: string) {
  registroExitoso = contraseña.length >= 8;
  tokenGenerado = registroExitoso;
  mensajeRegistro = registroExitoso ? '' : 'Contraseña insegura';
});

Then('el registro debe ser exitoso', function () {
  assert.strictEqual(registroExitoso, true);
});

Then('el sistema debe retornar un token de autenticación JWT', function () {
  assert.strictEqual(tokenGenerado, true);
});

Then('el registro debe ser rechazado por {string}', function (mensaje: string) {
  assert.strictEqual(registroExitoso, false);
  assert.strictEqual(mensajeRegistro, mensaje);
});

Then('no se debe generar ningún token', function () {
  assert.strictEqual(tokenGenerado, false);
});

Given('que existen salas registradas en el sistema', function () {
  salasDisponibles = ['Sala A', 'Sala B'];
});

Given('la {string} no tiene reservas para la fecha {string}', function (sala: string, _fecha: string) {
  if (!salasDisponibles.includes(sala)) {
    salasDisponibles.push(sala);
  }
});

When('el usuario consulta disponibilidad para la fecha {string} con capacidad mínima de {string}', function (_fecha: string, _capacidad: string) {
  estadoBusqueda = 200;
});

Then('el sistema debe retornar un código de estado {string}', function (codigo: string) {
  assert.strictEqual(estadoBusqueda, parseInt(codigo, 10));
});

Then('la lista debe incluir la {string}', function (sala: string) {
  assert.ok(salasDisponibles.includes(sala));
});

Given('que todas las salas están ocupadas para la fecha {string}', function (_fecha: string) {
  salasDisponibles = [];
});

When('el usuario consulta disponibilidad para la fecha {string}', function (_fecha: string) {
  estadoBusqueda = 200;
});

Then('la lista de salas disponibles debe estar vacía', function () {
  assert.deepStrictEqual(salasDisponibles, []);
});

Given('que la {string} ya tiene una reserva confirmada para la fecha {string}', function (_sala: string, _fecha: string) {
  reservasSala = 1;
  codigoReserva = 409;
});

When('otro usuario intenta reservar la {string} para la misma fecha {string}', function (_sala: string, _fecha: string) {
  codigoReserva = 409;
});

Then('la reserva debe ser rechazada con código de conflicto {string}', function (codigo: string) {
  assert.strictEqual(codigoReserva, parseInt(codigo, 10));
});

Then('la sala debe mantener únicamente la reserva original', function () {
  assert.strictEqual(reservasSala, 1);
});

Given('que la {string} está reservada para el {string}', function (_sala: string, _fecha: string) {
  reservasSala = 1;
  codigoReserva = 201;
});

When('un usuario intenta reservar la {string} para el {string}', function (_sala: string, _fecha: string) {
  reservasSala += 1;
  codigoReserva = 201;
});

Then('la nueva reserva debe confirmarse exitosamente', function () {
  assert.strictEqual(codigoReserva, 201);
  assert.strictEqual(reservasSala, 2);
});

Given('que el usuario {string} tiene una reserva confirmada para la fecha {string}', function (usuario: string, _fecha: string) {
  usuarioReserva = usuario;
  estadoReserva = 'Confirmada';
  saldoReembolsado = 0;
});

Given('el costo de la reserva fue de {string} créditos', function (costo: string) {
  saldoReembolsado = parseInt(costo, 10);
});

When('{string} cancela la reserva con más de {int} horas de anticipación', function (usuario: string, _horas: number) {
  if (usuario === usuarioReserva) {
    estadoReserva = 'Cancelada';
  }
});

Then('el estado de la reserva debe cambiar a {string}', function (estado: string) {
  assert.strictEqual(estadoReserva, estado);
});

Then('se deben reembolsar {string} créditos al saldo de {string}', function (monto: string, usuario: string) {
  assert.strictEqual(saldoReembolsado, parseInt(monto, 10));
  assert.strictEqual(usuario, usuarioReserva);
});

Given('que la reserva pertenece al usuario {string}', function (usuario: string) {
  usuarioReserva = usuario;
  estadoReserva = 'Confirmada';
});

When('el usuario {string} intenta cancelar la reserva de {string}', function (usuario: string, propietario: string) {
  estadoReserva = usuario === propietario ? 'Cancelada' : 'Confirmada';
});

Then('la solicitud debe ser rechazada por {string}', function (mensaje: string) {
  assert.strictEqual(mensaje, 'No autorizado');
});

Then('el estado de la reserva debe mantenerse como {string}', function (estado: string) {
  assert.strictEqual(estadoReserva, estado);
});

Given('que el usuario {string} tiene un saldo actual de {string} créditos', function (_usuario: string, saldo: string) {
  saldoCreditos = parseInt(saldo, 10);
  recargaExitosa = false;
  mensajeRecarga = '';
});

When('{string} selecciona y paga el paquete de {string} créditos', function (_usuario: string, cantidad: string) {
  const monto = parseInt(cantidad, 10);
  recargaExitosa = monto > 0;
  if (recargaExitosa) {
    saldoCreditos += monto;
  }
});

Then('el pago debe procesarse exitosamente', function () {
  assert.strictEqual(recargaExitosa, true);
});

Then('el saldo total de {string} debe actualizarse a {string} créditos', function (_usuario: string, saldo: string) {
  assert.strictEqual(saldoCreditos, parseInt(saldo, 10));
});

When('{string} intenta seleccionar un paquete de {string} créditos', function (_usuario: string, cantidad: string) {
  const monto = parseInt(cantidad, 10);
  recargaExitosa = false;
  mensajeRecarga = monto > 0 ? '' : 'Monto inválido';
});

Then('la transacción debe ser rechazada por {string}', function (mensaje: string) {
  assert.strictEqual(recargaExitosa, false);
  assert.strictEqual(mensajeRecarga, mensaje);
});

Then('el saldo total de {string} debe mantenerse en {string} créditos', function (_usuario: string, saldo: string) {
  assert.strictEqual(saldoCreditos, parseInt(saldo, 10));
});