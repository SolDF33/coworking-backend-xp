# language: es
Característica: HU-01 Registro e Inicio de Sesión
  Como usuario no registrado
  Quiero crear una cuenta con mi correo y contraseña
  Para acceder a las funciones del coworking

  Escenario: Registro exitoso de usuario (Camino Feliz)
    Dado que el email "usuario@coworking.com" no está registrado
    Cuando el usuario intenta registrarse con email "usuario@coworking.com" y contraseña "Pass1234"
    Entonces el registro debe ser exitoso
    Y el sistema debe retornar un token de autenticación JWT

  Escenario: Registro fallido por formato de contraseña inválido (Caso de Error)
    Dado que el email "nuevo@coworking.com" no está registrado
    Cuando el usuario intenta registrarse con email "nuevo@coworking.com" y contraseña "123"
    Entonces el registro debe ser rechazado por "Contraseña insegura"
    Y no se debe generar ningún token