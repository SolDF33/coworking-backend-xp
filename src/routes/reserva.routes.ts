import { Router } from 'express';
import { RequestAutenticado, verificarToken } from '../middlewares/auth.middleware.js';
import {
  ReservaService,
  ReservaServiceError,
  validarFechaYHoraTurno
} from '../services/reserva.service.js';

export const createReservaRouter = (reservaService: ReservaService): Router => {
  const router = Router();

  router.get('/', verificarToken, async (req: RequestAutenticado, res) => {
    const reservas = await reservaService.listarReservas(req.usuario!.id);
    return res.json(reservas);
  });

  router.post('/', verificarToken, async (req: RequestAutenticado, res) => {
    try {
      const { salaId, fecha, hora } = req.body;
      if (typeof salaId !== 'string' || !salaId) {
        return res.status(400).json({ error: 'salaId es obligatorio' });
      }
      const fechaHora = validarFechaYHoraTurno(fecha, hora);
      const reserva = await reservaService.crearReserva(req.usuario!.id, salaId, fechaHora);
      return res.status(201).json(reserva);
    } catch (error: unknown) {
      if (error instanceof ReservaServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  });

  router.delete('/:id', verificarToken, async (req: RequestAutenticado, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const resultado = await reservaService.cancelarReserva(
        id,
        req.usuario!.id,
        req.usuario!.rol === 'ADMIN'
      );
      return res.json(resultado);
    } catch (error: unknown) {
      if (error instanceof ReservaServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  });

  return router;
};
