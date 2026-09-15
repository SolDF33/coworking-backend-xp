"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservaController = void 0;
class ReservaController {
    reservaService;
    constructor(reservaService) {
        this.reservaService = reservaService;
    }
    listar = (_request, response) => {
        response.json(this.reservaService.listarReservas());
    };
    crear = (request, response) => {
        const reserva = this.reservaService.crearReserva(request.body);
        response.status(201).json(reserva);
    };
    cancelar = (request, response) => {
        const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
        const reserva = this.reservaService.cancelarReserva(id);
        response.json(reserva);
    };
}
exports.ReservaController = ReservaController;
