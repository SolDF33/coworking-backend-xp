import { Reserva } from '../domain/reserva.model.js';
import { ReservaRepository } from '../repositories/reserva.repository.js';

export class ReservaService {
  constructor(private readonly reservaRepository: ReservaRepository) {}

  listarReservas(): Reserva[] {
    return this.reservaRepository.listar();
  }

  crearReserva(reserva: Reserva): Reserva {
    return this.reservaRepository.guardar(reserva);
  }

  cancelarReserva(id: string): Reserva {
    const reserva = this.reservaRepository.buscarPorId(id);

    if (!reserva) {
      throw new Error('Reserva no encontrada');
    }

    return this.reservaRepository.actualizar({
      ...reserva,
      estado: 'Cancelada'
    });
  }
}