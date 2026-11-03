import { Router } from 'express';
import crypto from 'node:crypto';
import { AuthController } from '../controllers/auth.controller.js';
import { ReservaRepository } from '../repositories/reserva.repository.js';
import {
  RequestAutenticado,
  requerirRol,
  verificarToken
} from '../middlewares/auth.middleware.js';
import {
  ReservaServiceError,
  validarFechaYHoraTurno
} from '../services/reserva.service.js';

export const createAuthRouter = (repository: ReservaRepository): Router => {
  const router = Router();
  const authController = new AuthController(repository);

  /**
  * @swagger
  * /api/registro:
  *   post:
  *     summary: Registrar un nuevo usuario
  *     tags: [Auth]
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required: [nombre, email, password]
  *             properties:
  *               nombre:
  *                 type: string
  *                 example: "Juan Pérez"
  *               email:
  *                 type: string
  *                 example: "juan@example.com"
  *               password:
  *                 type: string
  *                 example: "Password123!"
  *     responses:
  *       201:
  *         description: Usuario creado exitosamente
  *       400:
  *         description: Datos inválidos
  *       409:
  *         description: El email ya está registrado
  */
  router.post('/registro', authController.register);
  /**
  * @swagger
  * /api/login:
  *   post:
  *     summary: Iniciar sesión
  *     tags: [Auth]
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required:
  *               - email
  *               - password
  *             properties:
  *               email:
  *                 type: string
  *                 example: "usuario@example.com"
  *               password:
  *                 type: string
  *                 example: "User123"
  *     responses:
  *       200:
  *         description: Login exitoso (devuelve token y refreshToken)
  *       401:
  *         description: Credenciales inválidas
  */
  router.post('/login', authController.login);

  /**
  * @swagger
  * /api/refresh:
  *   post:
  *     summary: Renovar el access token
  *     tags: [Auth]
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required: [refreshToken]
  *             properties:
  *               refreshToken:
  *                 type: string
  *     responses:
  *       200:
  *         description: Nuevo token y refreshToken generados
  *       401:
  *         description: Refresh token inválido o expirado
  */
  router.post('/refresh', authController.refresh);

  /**
  * @swagger
  * /api/perfil:
  *   get:
  *     summary: Obtener el perfil del usuario autenticado
  *     tags: [Usuarios]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: Datos del perfil y saldo de créditos
  *       401:
  *         description: No autorizado
  */
  router.get('/perfil', verificarToken, async (req: RequestAutenticado, res) => {
    const usuario = await repository.obtenerUsuarioPorId(req.usuario!.id);
    if (!usuario) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    return res.json({
      mensaje: 'Bienvenido a tu perfil',
      tuId: usuario.id,
      tuRol: usuario.rol,
      saldoCreditos: usuario.saldoCreditos
    });
  });

  /**
  * @swagger
  * /api/salas:
  *   get:
  *     summary: Listar todas las salas activas
  *     tags: [Salas]
  *     responses:
  *       200:
  *         description: Lista de salas
  */
  router.get('/salas', async (_req, res) => {
    return res.json(await repository.listarSalas());
  });

  /**
  * @swagger
  * /api/salas/disponibles:
  *   get:
  *     summary: Buscar salas disponibles por fecha, hora y capacidad
  *     tags: [Salas]
  *     parameters:
  *       - in: query
  *         name: fecha
  *         required: true
  *         schema:
  *           type: string
  *           format: date
  *         description: Fecha en formato AAAA-MM-DD
  *       - in: query
  *         name: hora
  *         required: true
  *         schema:
  *           type: string
  *           example: "10:00"
  *         description: Hora en formato HH:00
  *       - in: query
  *         name: capacidad
  *         required: false
  *         schema:
  *           type: integer
  *           default: 1
  *     responses:
  *       200:
  *         description: Lista de salas disponibles
  *       400:
  *         description: Parámetros inválidos
  */
  router.get('/salas/disponibles', async (req, res) => {
    try {
      const { fecha, hora } = req.query;
      const capacidad = req.query.capacidad === undefined ? 1 : Number(req.query.capacidad);
      if (!Number.isInteger(capacidad) || capacidad < 1) {
        return res.status(400).json({ error: 'capacidad debe ser un entero positivo' });
      }
      const fechaHora = validarFechaYHoraTurno(fecha, hora);
      return res.json(
        await repository.listarSalasDisponibles(
          fechaHora.slice(0, 10),
          fechaHora.slice(11),
          capacidad
        )
      );
    } catch (error: unknown) {
      if (error instanceof ReservaServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  });

  /**
  * @swagger
  * /api/salas:
  *   post:
  *     summary: Crear una nueva sala
  *     tags: [Salas]
  *     security:
  *       - bearerAuth: []
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required: [nombre, descripcion, capacidad]
  *             properties:
  *               nombre:
  *                 type: string
  *                 example: "Sala de Reuniones A"
  *               descripcion:
  *                 type: string
  *                 example: "Luz natural, pantalla, café"
  *               capacidad:
  *                 type: integer
  *                 example: 6
  *     responses:
  *       201:
  *         description: Sala creada exitosamente
  *       400:
  *         description: Datos inválidos
  *       403:
  *         description: No autorizado (requiere EDITOR o ADMIN)
  */
  router.post(
    '/salas',
    verificarToken,
    requerirRol(['EDITOR', 'ADMIN']),
    async (req: RequestAutenticado, res) => {
      const { nombre, descripcion, capacidad } = req.body;
      if (
        typeof nombre !== 'string' ||
        typeof descripcion !== 'string' ||
        !nombre.trim() ||
        !descripcion.trim() ||
        !Number.isInteger(capacidad) ||
        capacidad < 1
      ) {
        return res.status(400).json({
          error: 'nombre, descripcion y una capacidad positiva son obligatorios'
        });
      }

      const sala = await repository.guardarSala({
        id: crypto.randomUUID(),
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        capacidad,
        activa: true 
      });
      return res.status(201).json(sala);
    }
  );

  /**
  * @swagger
  * /api/salas/{id}:
  *   put:
  *     summary: Editar una sala existente
  *     tags: [Salas]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: path
  *         name: id
  *         required: true
  *         schema:
  *           type: string
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required: [nombre, descripcion, capacidad]
  *             properties:
  *               nombre:
  *                 type: string
  *               descripcion:
  *                 type: string
  *               capacidad:
  *                 type: integer
  *     responses:
  *       200:
  *         description: Sala actualizada
  *       403:
  *         description: No autorizado
  *       404:
  *         description: Sala no encontrada
  */
  router.put(
    '/salas/:id',
    verificarToken,
    requerirRol(['EDITOR', 'ADMIN']),
    async (req: RequestAutenticado, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const sala = await repository.obtenerSalaPorId(id);
      if (!sala) {
        return res.status(404).json({ error: 'Sala no encontrada' });
      }

      const { nombre, descripcion, capacidad } = req.body;
      if (
        typeof nombre !== 'string' ||
        typeof descripcion !== 'string' ||
        !nombre.trim() ||
        !descripcion.trim() ||
        !Number.isInteger(capacidad) ||
        capacidad < 1
      ) {
        return res.status(400).json({
          error: 'nombre, descripcion y una capacidad positiva son obligatorios'
        });
      }

      const salaActualizada = await repository.actualizarSala({
        ...sala,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        capacidad
      });
      return res.json(salaActualizada);
    }
  );

  /**
   * @swagger
   * /api/salas/{id}:
   *   delete:
   *     summary: Elimina lógicamente una sala (HU09)
   *     description: Oculta la sala del listado. Requiere rol ADMIN. Falla si hay reservas futuras.
   *     tags: [Salas]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: ID de la sala
   *     responses:
   *       200:
   *         description: Sala eliminada correctamente
   *       403:
   *         description: No autorizado (falta token o no es ADMIN)
   *       404:
   *         description: Sala no encontrada
   *       409:
   *         description: Conflicto, la sala tiene reservas futuras
   */
  router.delete(
    '/salas/:id',
    verificarToken,
    requerirRol(['ADMIN']),
    async (req: RequestAutenticado, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const sala = await repository.obtenerSalaPorId(id);
      
      if (!sala || !sala.activa) {
        return res.status(404).json({ error: 'Sala no encontrada' });
      }

      try {
        await repository.eliminarSala(id);
        return res.status(200).json({ mensaje: 'Sala eliminada lógicamente' });
      } catch (error: unknown) {
        const mensaje = error instanceof Error ? error.message : 'Error al eliminar';
        return res.status(409).json({ error: mensaje });
      }
    }
  );

  router.delete('/usuarios/:id', verificarToken, requerirRol(['ADMIN']), (_req, res) => {
    return res.json({ mensaje: 'Usuario eliminado por un administrador' });
  });

  return router;
};
