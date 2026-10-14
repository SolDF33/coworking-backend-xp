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

  router.post('/registro', authController.register);
  router.post('/login', authController.login);
  router.post('/refresh', authController.refresh);

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

  router.get('/salas', async (_req, res) => {
    return res.json(await repository.listarSalas());
  });

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
        capacidad
      });
      return res.status(201).json(sala);
    }
  );

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

  router.delete('/usuarios/:id', verificarToken, requerirRol(['ADMIN']), (_req, res) => {
    return res.json({ mensaje: 'Usuario eliminado por un administrador' });
  });

  return router;
};
