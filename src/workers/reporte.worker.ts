import { PrismaClient } from '@prisma/client';
import { parentPort, workerData } from 'node:worker_threads';
import { ResultadoReporte, ResumenSala } from '../domain/reporte.model.js';

interface DatosWorker {
  fechaDesde: string;
  fechaHasta: string;
}

if (!parentPort) {
  throw new Error('El worker de reportes requiere un parentPort');
}

const database = new PrismaClient();
const datos = workerData as DatosWorker;
const inicio = new Date(`${datos.fechaDesde}T00:00:00.000Z`);
const diaPosteriorAlFinal = new Date(`${datos.fechaHasta}T00:00:00.000Z`);
diaPosteriorAlFinal.setUTCDate(diaPosteriorAlFinal.getUTCDate() + 1);

const ejecutar = async (): Promise<ResultadoReporte> => {
  const eventos = await database.reserva.findMany({
    where: {
      OR: [
        { createdAt: { gte: inicio, lt: diaPosteriorAlFinal } },
        { canceledAt: { gte: inicio, lt: diaPosteriorAlFinal } }
      ]
    },
    select: { sala: true, createdAt: true, canceledAt: true }
  });

  let reservas = 0;
  let cancelaciones = 0;
  const salas = new Map<string, ResumenSala>();

  for (const evento of eventos) {
    let resumen = salas.get(evento.sala);
    if (!resumen) {
      resumen = { salaId: evento.sala, reservas: 0, cancelaciones: 0 };
      salas.set(evento.sala, resumen);
    }

    if (evento.createdAt >= inicio && evento.createdAt < diaPosteriorAlFinal) {
      reservas += 1;
      resumen.reservas += 1;
    }
    if (evento.canceledAt && evento.canceledAt >= inicio && evento.canceledAt < diaPosteriorAlFinal) {
      cancelaciones += 1;
      resumen.cancelaciones += 1;
    }
  }

  return {
    fechaDesde: datos.fechaDesde,
    fechaHasta: datos.fechaHasta,
    reservas,
    cancelaciones,
    porSala: [...salas.values()].sort((a, b) => a.salaId.localeCompare(b.salaId)),
    generadoEn: new Date().toISOString()
  };
};

void ejecutar()
  .then((resultado) => parentPort!.postMessage({ resultado }))
  .catch((error: unknown) => {
    const mensaje = error instanceof Error ? error.message : 'No se pudo generar el reporte';
    parentPort!.postMessage({ error: mensaje });
  })
  .finally(async () => {
    await database.$disconnect();
  });
