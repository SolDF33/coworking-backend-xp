Feature: Reservas concurrentes de salas
  Como usuario autenticado
  Quiero reservar turnos sin duplicar salas ni descontar créditos incorrectamente
  Para que la información se mantenga íntegra ante solicitudes simultáneas

  Scenario: Dos usuarios intentan reservar el mismo turno
    Given una sala de prueba está disponible
    And hay dos usuarios autenticados con 100 créditos
    When ambos intentan reservar simultáneamente el turno "10:00" del "2099-05-20"
    Then solo una respuesta debe ser 201 y la otra 409
    And un único saldo debe quedar en 50 y el otro en 100

  Scenario: Rechazar una reserva por saldo insuficiente
    Given un usuario autenticado tiene 20 créditos
    When intenta reservar el turno "11:00" del "2099-05-20"
    Then la reserva debe responder 409 y no crearse
    And el saldo debe permanecer en 20 créditos
