import { Router } from 'express';
import { RequestAutenticado, requerirRol, verificarToken } from '../middlewares/auth.middleware.js';
import { ReporteService, ReporteServiceError, validarRangoFechas } from '../services/reporte.service.js';

export const createReporteRouter = (reporteService: ReporteService): Router => {
  const router = Router();
  router.use(verificarToken, requerirRol(['ADMIN']));

  router.get('/', async (_req, res) => {
    return res.json(await reporteService.listarRecientes());
  });

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
