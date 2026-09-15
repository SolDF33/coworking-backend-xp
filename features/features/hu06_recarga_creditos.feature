# language: es
Característica: HU-06 Recarga de Créditos
  Como usuario autenticado
  Quiero comprar créditos
  Para poder realizar reservas en la plataforma

  Escenario: Recarga de créditos exitosa (Camino Feliz)
    Dado que el usuario "Sofia" tiene un saldo actual de "10" créditos
    Cuando "Sofia" selecciona y paga el paquete de "100" créditos
    Entonces el pago debe procesarse exitosamente
    Y el saldo total de "Sofia" debe actualizarse a "110" créditos

  Escenario: Intento de recarga con monto inválido (Caso de Error)
    Dado que el usuario "Sofia" tiene un saldo actual de "10" créditos
    Cuando "Sofia" intenta seleccionar un paquete de "0" créditos
    Entonces la transacción debe ser rechazada por "Monto inválido"
    Y el saldo total de "Sofia" debe mantenerse en "10" créditos