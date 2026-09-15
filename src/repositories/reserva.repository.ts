import { Reserva } from '../domain/reserva.model.js';

export class ReservaRepository {
  private readonly reservas: Reserva[] = [];

  listar(): Reserva[] {
    return [...this.reservas];
  }

  buscarPorId(id: string): Reserva | undefined {
    return this.reservas.find((reserva) => reserva.id === id);
  }

  guardar(reserva: Reserva): Reserva {
    this.reservas.push(reserva);
    return reserva;
  }

  actualizar(reservaActualizada: Reserva): Reserva {
    const indice = this.reservas.findIndex((reserva) => reserva.id === reservaActualizada.id);

    if (indice === -1) {
      throw new Error('Reserva no encontrada');
    }

    this.reservas[indice] = reservaActualizada;
    return reservaActualizada;
  }
}