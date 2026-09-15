# language: es
Característica: HU-02 Búsqueda de Espacios Disponibles
  Como usuario autenticado
  Quiero consultar las salas de reuniones disponibles por fecha y hora
  Para planificar mi jornada de trabajo

  Escenario: Búsqueda exitosa de salas disponibles (Camino Feliz)
    Dado que existen salas registradas en el sistema
    Y la "Sala A" no tiene reservas para la fecha "2026-10-15"
    Cuando el usuario consulta disponibilidad para la fecha "2026-10-15" con capacidad mínima de "4"
    Entonces el sistema debe retornar un código de estado "200"
    Y la lista debe incluir la "Sala A"

  Escenario: Consulta sin resultados disponibles (Caso de Límite)
    Dado que todas las salas están ocupadas para la fecha "2026-10-20"
    Cuando el usuario consulta disponibilidad para la fecha "2026-10-20"
    Entonces el sistema debe retornar un código de estado "200"
    Y la lista de salas disponibles debe estar vacía