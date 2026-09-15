# language: es
Característica: HU-04 Prevención de Solapamiento de Reservas
  Como sistema de gestión
  Quiero rechazar reservas en horarios ocupados
  Para evitar que dos usuarios usen la misma sala al mismo tiempo

  Escenario: Intento de reserva en horario solapado (Caso de Error)
    Dado que la "Sala B" ya tiene una reserva confirmada para la fecha "2026-10-15"
    Cuando otro usuario intenta reservar la "Sala B" para la misma fecha "2026-10-15"
    Entonces la reserva debe ser rechazada con código de conflicto "409"
    Y la sala debe mantener únicamente la reserva original

  Escenario: Reserva exitosa en fecha distinta sin solapamiento (Camino Feliz)
    Dado que la "Sala B" está reservada para el "2026-10-15"
    Cuando un usuario intenta reservar la "Sala B" para el "2026-10-16"
    Entonces la nueva reserva debe confirmarse exitosamente