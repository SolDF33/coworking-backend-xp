import { Router } from 'express';
import crypto from 'node:crypto';
import { AuthController } from '../controllers/auth.controller.js';
import { ReservaRepository } from '../repositories/reserva.repository.js';
import {
  RequestAutenticado,
  requerirPropietario,
  requerirRol,
  verificarToken
} from '../middlewares/auth.middleware.js';

export const createAuthRouter = (repository: ReservaRepository): Router => {
  const router = Router();
  const authController = new AuthController(repository);

  router.post('/registro', authController.register);
  router.post('/login', authController.login);
  router.post('/refresh', authController.refresh);

  router.get('/perfil', verificarToken, (req: RequestAutenticado, res) => {
    return res.json({
      mensaje: 'Bienvenido a tu perfil',
      tuId: req.usuario?.id,
      tuRol: req.usuario?.rol
    });
  });

  router.post('/articulos', verificarToken, requerirRol(['EDITOR', 'ADMIN']), (req: RequestAutenticado, res) => {
    const { titulo, contenido } = req.body;
    if (typeof titulo !== 'string' || typeof contenido !== 'string' || !titulo.trim() || !contenido.trim()) {
      return res.status(400).json({ error: 'titulo y contenido son obligatorios' });
    }
    const articulo = repository.guardarArticulo({
      id: crypto.randomUUID(),
      titulo: titulo.trim(),
      contenido: contenido.trim(),
      autorId: req.usuario!.id
    });
    return res.status(201).json(articulo);
  });

  router.delete('/usuarios/:id', verificarToken, requerirRol(['ADMIN']), (_req, res) => {
    return res.json({ mensaje: 'Usuario eliminado por un administrador' });
  });

  router.put(
    '/articulos/:id',
    verificarToken,
    requerirPropietario((id: string) => repository.obtenerArticuloPorId(id)?.autorId),
    (req: RequestAutenticado, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const articulo = repository.obtenerArticuloPorId(id);
      const { titulo, contenido } = req.body;
      if (!articulo || typeof titulo !== 'string' || typeof contenido !== 'string' || !titulo.trim() || !contenido.trim()) {
        return res.status(400).json({ error: 'titulo y contenido son obligatorios' });
      }
      return res.json(repository.actualizarArticulo({ ...articulo, titulo: titulo.trim(), contenido: contenido.trim() }));
    }
  );

  return router;
};
