"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservaRepository = void 0;
class ReservaRepository {
    reservas = [];
    listar() {
        return [...this.reservas];
    }
    buscarPorId(id) {
        return this.reservas.find((reserva) => reserva.id === id);
    }
    guardar(reserva) {
        this.reservas.push(reserva);
        return reserva;
    }
    actualizar(reservaActualizada) {
        const indice = this.reservas.findIndex((reserva) => reserva.id === reservaActualizada.id);
        if (indice === -1) {
            throw new Error('Reserva no encontrada');
        }
        this.reservas[indice] = reservaActualizada;
        return reservaActualizada;
    }
}
exports.ReservaRepository = ReservaRepository;
