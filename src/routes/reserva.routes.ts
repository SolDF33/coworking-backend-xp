import { Router } from 'express';
import { RequestAutenticado, verificarToken } from '../middlewares/auth.middleware.js';
import {
  ReservaService,
  ReservaServiceError,
  validarFechaYHoraTurno
} from '../services/reserva.service.js';

export const createReservaRouter = (reservaService: ReservaService): Router => {
  const router = Router();

  /**
  * @swagger
  * /api/reservas:
  *   get:
  *     summary: Listar las reservas del usuario autenticado
  *     tags: [Reservas]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: Lista de reservas del usuario
  *       401:
  *         description: No autorizado
  */
  router.get('/', verificarToken, async (req: RequestAutenticado, res) => {
    const reservas = await reservaService.listarReservas(req.usuario!.id);
    return res.json(reservas);
  });

  /**
   * @swagger
   * /api/reservas:
   *   post:
   *     summary: Crear una nueva reserva
   *     tags: [Reservas]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - salaId
   *               - fecha
   *               - hora
   *             properties:
   *               salaId:
   *                 type: string
   *                 example: "uuid-de-la-sala"
   *               fecha:
   *                 type: string
   *                 format: date
   *                 example: "2099-05-20"
   *               hora:
   *                 type: string
   *                 example: "10:00"
   *     responses:
   *       201:
   *         description: Reserva creada exitosamente
   *       409:
   *         description: Saldo insuficiente o sala ya reservada
   */
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

  /**
  * @swagger
  * /api/reservas/{id}:
  *   delete:
  *     summary: Cancelar una reserva
  *     description: Si faltan más de 24 horas para el turno, se reembolsan los 50 créditos.
  *     tags: [Reservas]
  *     security:
  *       - bearerAuth: []
  *     parameters:
  *       - in: path
  *         name: id
  *         required: true
  *         schema:
  *           type: string
  *     responses:
  *       200:
  *         description: Reserva cancelada (devuelve un objeto con el estado de la reserva y el campo reembolsado)
  *       403:
  *         description: No autorizado (no es dueño ni ADMIN)
  *       404:
  *         description: Reserva no encontrada
  *       409:
  *         description: La reserva ya estaba cancelada
  */
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
