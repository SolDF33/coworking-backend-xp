Feature: Reportes administrativos de utilización
  Como administrador
  Quiero generar reportes en segundo plano
  Para analizar reservas y cancelaciones sin detener la API

  Scenario: Un administrador solicita y consulta un reporte
    Given una sesión de administrador válida
    When solicita un reporte para el período "2099-05-01" a "2099-05-31"
    Then la solicitud debe aceptarse con HTTP 202
    And la API debe continuar respondiendo durante el procesamiento
    And el resultado del reporte debe quedar persistido

  Scenario: Un usuario común no puede generar reportes administrativos
    Given una sesión de usuario común válida
    When solicita un reporte para el período "2099-05-01" a "2099-05-31"
    Then la solicitud del reporte debe rechazarse con HTTP 403
    And no debe crearse un trabajo de reporte
