import { Router } from 'express';
import { RequestAutenticado, requerirRol, verificarToken } from '../middlewares/auth.middleware.js';
import { ReporteService, ReporteServiceError, validarRangoFechas } from '../services/reporte.service.js';

export const createReporteRouter = (reporteService: ReporteService): Router => {
  const router = Router();
  router.use(verificarToken, requerirRol(['ADMIN']));

  /**
  * @swagger
  * /api/reportes:
  *   get:
  *     summary: Listar los reportes más recientes
  *     tags: [Reportes]
  *     security:
  *       - bearerAuth: []
  *     responses:
  *       200:
  *         description: Lista de reportes
  *       403:
  *         description: No autorizado (requiere ADMIN)
  */
  router.get('/', async (_req, res) => {
    return res.json(await reporteService.listarRecientes());
  });

  /**
  * @swagger
  * /api/reportes:
  *   post:
  *     summary: Solicitar la generación de un reporte asíncrono
  *     tags: [Reportes]
  *     security:
  *       - bearerAuth: []
  *     requestBody:
  *       required: true
  *       content:
  *         application/json:
  *           schema:
  *             type: object
  *             required: [fechaDesde, fechaHasta]
  *             properties:
  *               fechaDesde:
  *                 type: string
  *                 format: date
  *                 example: "2026-10-01"
  *               fechaHasta:
  *                 type: string
  *                 format: date
  *                 example: "2026-10-31"
  *     responses:
  *       202:
  *         description: Solicitud aceptada, el reporte se está procesando
  *       400:
  *         description: Fechas inválidas
  *       403:
  *         description: No autorizado
  */
  router.post('/', async (req, res) => {
    try {
      const [fechaDesde, fechaHasta] = validarRangoFechas(req.body?.fechaDesde, req.body?.fechaHasta);
      const reporte = await reporteService.solicitar(fechaDesde, fechaHasta);
      return res.status(202).json(reporte);
    } catch (error: unknown) {
      if (error instanceof ReporteServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  });

  /**
  * @swagger
  * /api/reportes/{id}:
  *   get:
  *     summary: Consultar el estado y resultado de un reporte
  *     tags: [Reportes]
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
  *         description: Datos del reporte (estado queued, running, completed o failed)
  *       403:
  *         description: No autorizado
  *       404:
  *         description: Reporte no encontrado
  */
  router.get('/:id', async (req: RequestAutenticado, res) => {
    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      return res.json(await reporteService.consultar(id));
    } catch (error: unknown) {
      if (error instanceof ReporteServiceError) {
        return res.status(error.statusCode).json({ error: error.message });
      }
      throw error;
    }
  });

  return router;
};
