import {
  PrismaClient,
  Reserva as PrismaReserva,
  Usuario as PrismaUsuario
} from '@prisma/client';
import { Reserva } from '../domain/reserva.model.js';
import { Sala } from '../domain/sala.model.js';
import { RolUsuario, Usuario } from '../domain/usuario.model.js';
import { prisma } from '../database/prisma.js';

const mapReserva = (reserva: PrismaReserva): Reserva => {
  if (reserva.estado !== 'Confirmada' && reserva.estado !== 'Cancelada') {
    throw new Error(`Estado de reserva no reconocido: ${reserva.estado}`);
  }

  return { ...reserva, estado: reserva.estado };
};

const mapUsuario = (usuario: PrismaUsuario): Usuario => {
  if (usuario.rol !== 'USER' && usuario.rol !== 'EDITOR' && usuario.rol !== 'ADMIN') {
    throw new Error(`Rol de usuario no reconocido: ${usuario.rol}`);
  }

  const rol: RolUsuario = usuario.rol;
  return { ...usuario, rol };
};

export class ReservaRepository {
  private static colaDeReservas: Promise<void> = Promise.resolve();

  constructor(private readonly database: PrismaClient = prisma) {}

  async listar(): Promise<Reserva[]> {
    const reservas = await this.database.reserva.findMany();
    return reservas.map(mapReserva);
  }

  async listarPorUsuario(usuarioId: string): Promise<Reserva[]> {
    const reservas = await this.database.reserva.findMany({
      where: { usuarioId },
      orderBy: { fecha: 'asc' }
    });
    return reservas.map(mapReserva);
  }

  async buscarPorId(id: string): Promise<Reserva | undefined> {
    const reserva = await this.database.reserva.findUnique({ where: { id } });
    return reserva ? mapReserva(reserva) : undefined;
  }

  async guardar(reserva: Reserva): Promise<Reserva> {
    const guardada = await this.database.reserva.create({ data: reserva });
    return mapReserva(guardada);
  }

  async actualizar(reservaActualizada: Reserva): Promise<Reserva> {
    const actualizada = await this.database.reserva.update({
      where: { id: reservaActualizada.id },
      data: reservaActualizada
    });
    return mapReserva(actualizada);
  }

  async listarSalasDisponibles(fecha: string, hora: string, capacidad: number): Promise<Sala[]> {
    const salas = await this.database.sala.findMany({
      where: { capacidad: { gte: capacidad } },
      orderBy: { nombre: 'asc' }
    });
    const reservasActivas = await this.database.reserva.findMany({
      where: {
        fecha: `${fecha}T${hora}`,
        estado: 'Confirmada',
        sala: { in: salas.map((sala) => sala.id) }
      },
      select: { sala: true }
    });
    const ocupadas = new Set(reservasActivas.map((reserva) => reserva.sala));
    return salas.filter((sala) => !ocupadas.has(sala.id));
  }

  async guardarUsuario(usuario: Usuario): Promise<Usuario> {
    return mapUsuario(await this.database.usuario.create({ data: usuario }));
  }

  async obtenerUsuarioPorEmail(email: string): Promise<Usuario | undefined> {
    const usuario = await this.database.usuario.findUnique({ where: { email } });
    return usuario ? mapUsuario(usuario) : undefined;
  }

  async obtenerUsuarioPorId(id: string): Promise<Usuario | undefined> {
    const usuario = await this.database.usuario.findUnique({ where: { id } });
    return usuario ? mapUsuario(usuario) : undefined;
  }

  async listarSalas(): Promise<Sala[]> {
    return this.database.sala.findMany();
  }

  async guardarSala(sala: Sala): Promise<Sala> {
    return this.database.sala.create({ data: sala });
  }

  async obtenerSalaPorId(id: string): Promise<Sala | undefined> {
    return (await this.database.sala.findUnique({ where: { id } })) ?? undefined;
  }

  async actualizarSala(sala: Sala): Promise<Sala> {
    return this.database.sala.update({ where: { id: sala.id }, data: sala });
  }

  async crearReserva(reserva: Reserva): Promise<Reserva> {
    const anterior = ReservaRepository.colaDeReservas;
    let liberar: () => void = () => undefined;
    ReservaRepository.colaDeReservas = new Promise<void>((resolve) => {
      liberar = resolve;
    });
    await anterior;

    try {
      return await this.database.$transaction(async (transaction) => {
        const actualizacionSaldo = await transaction.usuario.updateMany({
          where: {
            id: reserva.usuarioId,
            saldoCreditos: { gte: reserva.costoCreditos }
          },
          data: { saldoCreditos: { decrement: reserva.costoCreditos } }
        });
        if (actualizacionSaldo.count === 0) {
          throw new Error('Saldo insuficiente');
        }

        const guardada = await transaction.reserva.create({
          data: {
            ...reserva,
            bloqueActivo: `${reserva.sala}:${reserva.fecha}`
          }
        });
        return mapReserva(guardada);
      });
    } finally {
      liberar();
    }
  }

  async cancelarReserva(id: string, reembolsar: boolean): Promise<Reserva | undefined> {
    return this.database.$transaction(async (transaction) => {
      const reserva = await transaction.reserva.findUnique({ where: { id } });
      if (!reserva || reserva.estado !== 'Confirmada') {
        return undefined;
      }

      const cancelada = await transaction.reserva.updateMany({
        where: { id, estado: 'Confirmada' },
        data: { estado: 'Cancelada', bloqueActivo: null, canceledAt: new Date() }
      });
      if (cancelada.count === 0) {
        return undefined;
      }

      if (reembolsar) {
        await transaction.usuario.update({
          where: { id: reserva.usuarioId },
          data: { saldoCreditos: { increment: reserva.costoCreditos } }
        });
      }

      return mapReserva((await transaction.reserva.findUniqueOrThrow({ where: { id } })));
    });
  }

  async guardarRefreshToken(tokenHash: string, userId: string, expiresAt: number): Promise<void> {
    await this.database.refreshToken.create({
      data: { tokenHash, userId, expiresAt: new Date(expiresAt) }
    });
  }

  async obtenerRefreshToken(
    tokenHash: string
  ): Promise<{ userId: string; expiresAt: number } | undefined> {
    const session = await this.database.refreshToken.findUnique({ where: { tokenHash } });
    if (!session) {
      return undefined;
    }
    if (session.expiresAt.getTime() <= Date.now()) {
      await this.database.refreshToken.delete({ where: { tokenHash } });
      return undefined;
    }
    return { userId: session.userId, expiresAt: session.expiresAt.getTime() };
  }

  async revocarRefreshToken(tokenHash: string): Promise<void> {
    await this.database.refreshToken.deleteMany({ where: { tokenHash } });
  }
}
