export type EstadoReporte = 'queued' | 'running' | 'completed' | 'failed';

export interface ResumenSala {
  salaId: string;
  reservas: number;
  cancelaciones: number;
}

export interface ResultadoReporte {
  fechaDesde: string;
  fechaHasta: string;
  reservas: number;
  cancelaciones: number;
  porSala: ResumenSala[];
  generadoEn: string;
}

export interface Reporte {
  id: string;
  fechaDesde: string;
  fechaHasta: string;
  estado: EstadoReporte;
  resultado: ResultadoReporte | null;
  error: string | null;
  creadoEn: string;
  iniciadoEn: string | null;
  completadoEn: string | null;
}
