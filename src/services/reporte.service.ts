import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { Reporte, ResultadoReporte } from '../domain/reporte.model.js';
import { ReporteRepository } from '../repositories/reporte.repository.js';

export class ReporteServiceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'ReporteServiceError';
  }
}

export const validarRangoFechas = (fechaDesde: unknown, fechaHasta: unknown): [string, string] => {
  const fechaValida = (valor: unknown): valor is string => {
    if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
    const fecha = new Date(`${valor}T00:00:00.000Z`);
    return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
  };

  if (!fechaValida(fechaDesde) || !fechaValida(fechaHasta)) {
    throw new ReporteServiceError(400, 'fechaDesde y fechaHasta deben ser fechas válidas con formato AAAA-MM-DD');
  }
  if (fechaDesde > fechaHasta) {
    throw new ReporteServiceError(400, 'fechaDesde no puede ser posterior a fechaHasta');
  }
  return [fechaDesde, fechaHasta];
};

export class ReporteService {
  private readonly activos = new Set<string>();

  constructor(private readonly reporteRepository: ReporteRepository) {}

  async solicitar(fechaDesde: string, fechaHasta: string): Promise<Reporte> {
    const reporte = await this.reporteRepository.crear(randomUUID(), fechaDesde, fechaHasta);
    this.encolar(reporte);
    return reporte;
  }

  async consultar(id: string): Promise<Reporte> {
    const reporte = await this.reporteRepository.buscarPorId(id);
    if (!reporte) {
      throw new ReporteServiceError(404, 'Reporte no encontrado');
    }
    return reporte;
  }

  listarRecientes(): Promise<Reporte[]> {
    return this.reporteRepository.listarRecientes();
  }

  async reanudarPendientes(): Promise<void> {
    await this.reporteRepository.recuperarInterrumpidos();
    const pendientes = await this.reporteRepository.listarPendientes();
    for (const reporte of pendientes) this.encolar(reporte);
  }

  private encolar(reporte: Reporte): void {
    if (this.activos.has(reporte.id)) return;
    this.activos.add(reporte.id);
    setImmediate(() => {
      void this.procesar(reporte)
        .catch((error: unknown) => {
          console.error(`No se pudo persistir el estado del reporte ${reporte.id}:`, error);
        })
        .finally(() => this.activos.delete(reporte.id));
    });
  }

  private async procesar(reporte: Reporte): Promise<void> {
    try {
      await this.reporteRepository.marcarIniciado(reporte.id);
      const resultado = await this.ejecutarWorker(reporte.fechaDesde, reporte.fechaHasta);
      await this.reporteRepository.marcarCompletado(reporte.id, resultado);
    } catch (error: unknown) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo generar el reporte';
      console.error(`Falló el reporte ${reporte.id}:`, error);
      await this.reporteRepository.marcarFallido(reporte.id, mensaje);
    }
  }

  private ejecutarWorker(fechaDesde: string, fechaHasta: string): Promise<ResultadoReporte> {
    const archivoJavascript = resolve(__dirname, '../workers/reporte.worker.js');
    const archivoTypescript = resolve(__dirname, '../workers/reporte.worker.ts');
    const archivoWorker = existsSync(archivoJavascript) ? archivoJavascript : archivoTypescript;
    const worker = new Worker(archivoWorker, {
      workerData: { fechaDesde, fechaHasta },
      ...(archivoWorker.endsWith('.ts') ? { execArgv: ['--import', 'tsx'] } : {})
    });

    return new Promise((resolveResultado, reject) => {
      let finalizado = false;
      worker.on('message', (mensaje: { resultado?: ResultadoReporte; error?: string }) => {
        if (mensaje.error) {
          finalizado = true;
          reject(new Error(mensaje.error));
        } else if (mensaje.resultado) {
          finalizado = true;
          resolveResultado(mensaje.resultado);
        } else {
          finalizado = true;
          reject(new Error('El worker devolvió una respuesta inválida'));
        }
      });
      worker.once('error', (error) => {
        if (!finalizado) {
          finalizado = true;
          reject(error);
        }
      });
      worker.once('exit', (code) => {
        if (!finalizado) {
          finalizado = true;
          reject(new Error(`El worker de reportes terminó sin resultado (código ${code})`));
        }
      });
    });
  }
}
