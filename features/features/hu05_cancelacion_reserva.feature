# language: es
Característica: HU-05 Cancelación de Reserva
  Como usuario autenticado
  Quiero cancelar una reserva previa
  Para liberar la sala y recuperar mis créditos si mis planes cambian

  Escenario: Cancelación anticipada con reembolso completo (Camino Feliz)
    Dado que el usuario "Juan" tiene una reserva confirmada para la fecha "2026-10-20"
    Y el costo de la reserva fue de "50" créditos
    Cuando "Juan" cancela la reserva con más de 24 horas de anticipación
    Entonces el estado de la reserva debe cambiar a "Cancelada"
    Y se deben reembolsar "50" créditos al saldo de "Juan"

  Escenario: Intento de cancelación de reserva ajena (Caso de Error/Seguridad)
    Dado que la reserva pertenece al usuario "Pedro"
    Cuando el usuario "Maria" intenta cancelar la reserva de "Pedro"
    Entonces la solicitud debe ser rechazada por "No autorizado"
    Y el estado de la reserva debe mantenerse como "Confirmada"