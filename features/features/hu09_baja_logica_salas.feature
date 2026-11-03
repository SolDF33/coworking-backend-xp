# language: es
Característica: HU-09 Eliminación lógica de salas
  Como administrador
  Quiero poder dar de baja una sala existente
  Para que no pueda ser reservada en el futuro, manteniendo intacto el historial para reportes

  Antecedentes:
    Dado que existe una sala "Sala Para Eliminar" en el sistema
    Y la sala no tiene reservas futuras confirmadas

  Escenario: Administrador elimina una sala exitosamente
    Dado una sesión de administrador válida para salas
    Cuando solicita eliminar la sala "Sala Para Eliminar"
    Entonces la respuesta debe ser "200"
    Y la sala "Sala Para Eliminar" no debe aparecer en el listado general de salas

  Escenario: No se puede eliminar una sala con reservas futuras
    Dado una sesión de administrador válida para salas
    Y la sala "Sala Para Eliminar" tiene una reserva futura confirmada
    Cuando solicita eliminar la sala "Sala Para Eliminar"
    Entonces la respuesta debe ser "409"
    Y la sala "Sala Para Eliminar" debe seguir activa en el sistema

  Escenario: Usuario sin permisos intenta eliminar una sala
    Dado una sesión de usuario común válida para salas
    Cuando solicita eliminar la sala "Sala Para Eliminar"
    Entonces la respuesta debe ser "403"
    Y la sala "Sala Para Eliminar" debe seguir activa en el sistema