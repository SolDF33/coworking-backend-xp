"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservaService = void 0;
class ReservaService {
    reservaRepository;
    constructor(reservaRepository) {
        this.reservaRepository = reservaRepository;
    }
    listarReservas() {
        return this.reservaRepository.listar();
    }
    crearReserva(reserva) {
        return this.reservaRepository.guardar(reserva);
    }
    cancelarReserva(id) {
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
exports.ReservaService = ReservaService;
