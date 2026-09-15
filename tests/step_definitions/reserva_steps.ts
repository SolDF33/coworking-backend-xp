import { Given, When, Then } from '@cucumber/cucumber';
import assert from 'assert';

let usuarioSaldo = 0;
let salaDisponible = false;
let resultadoReserva: { exito: boolean; mensaje: string } | null = null;

Given('que el usuario {string} tiene {string} créditos disponibles', function (nombre: string, creditos: string) {
  usuarioSaldo = parseInt(creditos, 10);
  resultadoReserva = null;
});

Given('la sala {string} está disponible para la fecha {string}', function (sala: string, fecha: string) {
  salaDisponible = true;
});

When('{string} intenta reservar la {string} para la fecha {string} con un costo de {string} créditos', function (nombre: string, sala: string, fecha: string, costo: string) {
  const costoReserva = parseInt(costo, 10);

  if (!salaDisponible) {
    resultadoReserva = { exito: false, mensaje: 'Sala no disponible' };
  } else if (usuarioSaldo < costoReserva) {
    resultadoReserva = { exito: false, mensaje: 'Saldo insuficiente' };
  } else {
    usuarioSaldo -= costoReserva;
    resultadoReserva = { exito: true, mensaje: 'Reserva confirmada' };
  }
});

Then('la reserva debe confirmarse exitosamente', function () {
  assert.strictEqual(resultadoReserva?.exito, true);
});

Then('el saldo de créditos de {string} debe ser {string}', function (nombre: string, saldoEsperado: string) {
  assert.strictEqual(usuarioSaldo, parseInt(saldoEsperado, 10));
});

Then('la reserva debe ser rechazada por {string}', function (mensajeError: string) {
  assert.strictEqual(resultadoReserva?.exito, false);
  assert.strictEqual(resultadoReserva?.mensaje, mensajeError);
});

Then('el saldo de créditos de {string} debe mantenerse en {string}', function (nombre: string, saldoEsperado: string) {
  assert.strictEqual(usuarioSaldo, parseInt(saldoEsperado, 10));
});