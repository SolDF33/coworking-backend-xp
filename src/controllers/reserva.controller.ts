import { Request, Response } from 'express';
import { ReservaService } from '../services/reserva.service.js';

export class ReservaController {
  constructor(private readonly reservaService: ReservaService) {}

  listar = (_request: Request, response: Response): void => {
    response.json(this.reservaService.listarReservas());
  };

  crear = (request: Request, response: Response): void => {
    const reserva = this.reservaService.crearReserva(request.body);
    response.status(201).json(reserva);
  };

  cancelar = (request: Request, response: Response): void => {
    const id = Array.isArray(request.params.id) ? request.params.id[0] : request.params.id;
    const reserva = this.reservaService.cancelarReserva(id);
    response.json(reserva);
  };
}