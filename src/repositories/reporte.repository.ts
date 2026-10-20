import { PrismaClient } from '@prisma/client';
import { EstadoReporte, Reporte, ResultadoReporte } from '../domain/reporte.model.js';
import { prisma } from '../database/prisma.js';

interface ReportJobRecord {
  id: string;
  dateFrom: string;
  dateTo: string;
  status: string;
  resultJson: string | null;
  error: string | null;
  createdAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}

const ESTADOS_REPORTE: EstadoReporte[] = ['queued', 'running', 'completed', 'failed'];

const mapReporte = (record: ReportJobRecord): Reporte => {
  if (!ESTADOS_REPORTE.includes(record.status as EstadoReporte)) {
    throw new Error(`Estado de reporte no reconocido: ${record.status}`);
  }

  return {
    id: record.id,
    fechaDesde: record.dateFrom,
    fechaHasta: record.dateTo,
    estado: record.status as EstadoReporte,
    resultado: record.resultJson === null ? null : JSON.parse(record.resultJson) as ResultadoReporte,
    error: record.error,
    creadoEn: record.createdAt.toISOString(),
    iniciadoEn: record.startedAt?.toISOString() ?? null,
    completadoEn: record.completedAt?.toISOString() ?? null
  };
};

export class ReporteRepository {
  constructor(private readonly database: PrismaClient = prisma) {}

  async crear(id: string, fechaDesde: string, fechaHasta: string): Promise<Reporte> {
    const record = await this.database.reportJob.create({
      data: { id, dateFrom: fechaDesde, dateTo: fechaHasta }
    });
    return mapReporte(record);
  }

  async buscarPorId(id: string): Promise<Reporte | undefined> {
    const record = await this.database.reportJob.findUnique({ where: { id } });
    return record ? mapReporte(record) : undefined;
  }

  async listarRecientes(limite = 20): Promise<Reporte[]> {
    const records = await this.database.reportJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limite
    });
    return records.map(mapReporte);
  }

  async listarPendientes(): Promise<Reporte[]> {
    const records = await this.database.reportJob.findMany({
      where: { status: 'queued' },
      orderBy: { createdAt: 'asc' }
    });
    return records.map(mapReporte);
  }

  async recuperarInterrumpidos(): Promise<void> {
    await this.database.reportJob.updateMany({
      where: { status: 'running' },
      data: { status: 'queued', startedAt: null }
    });
  }

  async marcarIniciado(id: string): Promise<void> {
    await this.database.reportJob.update({
      where: { id },
      data: { status: 'running', startedAt: new Date(), error: null }
    });
  }

  async marcarCompletado(id: string, resultado: ResultadoReporte): Promise<void> {
    await this.database.reportJob.update({
      where: { id },
      data: {
        status: 'completed',
        resultJson: JSON.stringify(resultado),
        error: null,
        completedAt: new Date()
      }
    });
  }

  async marcarFallido(id: string, error: string): Promise<void> {
    await this.database.reportJob.update({
      where: { id },
      data: { status: 'failed', error, completedAt: new Date() }
    });
  }
}
