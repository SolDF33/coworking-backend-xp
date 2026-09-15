# language: es
Característica: HU-03 Reserva de salas de reuniones
  Como usuario autenticado
  Quiero reservar una sala en un horario específico
  Para asegurar mi lugar de trabajo

  Escenario: Reserva exitosa de una sala disponible (Camino Feliz)
    Dado que el usuario "Juan" tiene "100" créditos disponibles
    Y la sala "Sala A" está disponible para la fecha "2026-10-15"
    Cuando "Juan" intenta reservar la "Sala A" para la fecha "2026-10-15" con un costo de "50" créditos
    Entonces la reserva debe confirmarse exitosamente
    Y el saldo de créditos de "Juan" debe ser "50"

  Escenario: Intento de reserva con créditos insuficientes (Caso de Error)
    Dado que el usuario "Maria" tiene "20" créditos disponibles
    Y la sala "Sala B" está disponible para la fecha "2026-10-15"
    Cuando "Maria" intenta reservar la "Sala B" para la fecha "2026-10-15" con un costo de "50" créditos
    Entonces la reserva debe ser rechazada por "Saldo insuficiente"
    Y el saldo de créditos de "Maria" debe mantenerse en "20"