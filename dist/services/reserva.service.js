"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservaService = exports.validarFechaYHoraTurno = exports.ReservaServiceError = exports.COSTO_TURNO_CREDITOS = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const ZONA_HORARIA_COWORKING = 'America/Argentina/Cordoba';
const APERTURA_HORA = 8;
const CIERRE_HORA = 20;
const DURACION_TURNO_MS = 60 * 60 * 1000;
const ANTICIPACION_REEMBOLSO_MS = 24 * DURACION_TURNO_MS;
exports.COSTO_TURNO_CREDITOS = 50;
class ReservaServiceError extends Error {
    statusCode;
    constructor(statusCode, message) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'ReservaServiceError';
    }
}
exports.ReservaServiceError = ReservaServiceError;
const fechaHoraActualLocal = () => {
    const partes = new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA_HORARIA_COWORKING,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date());
    const parte = (tipo) => partes.find((item) => item.type === tipo).value;
    return `${parte('year')}-${parte('month')}-${parte('day')}T${parte('hour')}:${parte('minute')}`;
};
const fechaHoraANumeroLocal = (fechaHora) => {
    const [fecha, hora] = fechaHora.split('T');
    const [anio, mes, dia] = fecha.split('-').map(Number);
    const [horas, minutos] = hora.split(':').map(Number);
    return Date.UTC(anio, mes - 1, dia, horas, minutos);
};
const validarFechaYHoraTurno = (fecha, hora) => {
    if (typeof fecha !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha) ||
        typeof hora !== 'string' ||
        !/^\d{2}:00$/.test(hora)) {
        throw new ReservaServiceError(400, 'fecha y hora deben tener formatos válidos');
    }
    const inicio = Number(hora.slice(0, 2));
    if (inicio < APERTURA_HORA || inicio >= CIERRE_HORA) {
        throw new ReservaServiceError(400, 'Las reservas están disponibles de 08:00 a 20:00');
    }
    const fechaHora = `${fecha}T${hora}`;
    const fechaValida = new Date(`${fechaHora}:00Z`);
    if (Number.isNaN(fechaValida.getTime()) ||
        fechaValida.toISOString().slice(0, 16) !== fechaHora) {
        throw new ReservaServiceError(400, 'La fecha y hora no son válidas');
    }
    if (fechaHora <= fechaHoraActualLocal()) {
        throw new ReservaServiceError(400, 'No se pueden reservar horarios pasados');
    }
    return fechaHora;
};
exports.validarFechaYHoraTurno = validarFechaYHoraTurno;
class ReservaService {
    reservaRepository;
    constructor(reservaRepository) {
        this.reservaRepository = reservaRepository;
    }
    listarReservas(usuarioId) {
        return this.reservaRepository.listarPorUsuario(usuarioId);
    }
    async crearReserva(usuarioId, salaId, fechaHora) {
        if (!(await this.reservaRepository.obtenerSalaPorId(salaId))) {
            throw new ReservaServiceError(404, 'Sala no encontrada');
        }
        try {
            return await this.reservaRepository.crearReserva({
                id: node_crypto_1.default.randomUUID(),
                usuarioId,
                sala: salaId,
                fecha: fechaHora,
                costoCreditos: exports.COSTO_TURNO_CREDITOS,
                estado: 'Confirmada'
            });
        }
        catch (error) {
            if (error instanceof Error && error.message === 'Saldo insuficiente') {
                throw new ReservaServiceError(409, 'Saldo insuficiente');
            }
            if (typeof error === 'object' &&
                error !== null &&
                'code' in error &&
                error.code === 'P2002') {
                throw new ReservaServiceError(409, 'La sala ya está reservada en ese horario');
            }
            throw error;
        }
    }
    async cancelarReserva(id, usuarioId, esAdmin) {
        const reserva = await this.reservaRepository.buscarPorId(id);
        if (!reserva) {
            throw new ReservaServiceError(404, 'Reserva no encontrada');
        }
        if (!esAdmin && reserva.usuarioId !== usuarioId) {
            throw new ReservaServiceError(403, 'No tienes permisos sobre esta reserva');
        }
        if (reserva.estado !== 'Confirmada') {
            throw new ReservaServiceError(409, 'La reserva ya fue cancelada');
        }
        const diferencia = fechaHoraANumeroLocal(reserva.fecha) -
            fechaHoraANumeroLocal(fechaHoraActualLocal());
        const reembolsado = diferencia > ANTICIPACION_REEMBOLSO_MS;
        const cancelada = await this.reservaRepository.cancelarReserva(id, reembolsado);
        if (!cancelada) {
            throw new ReservaServiceError(409, 'La reserva ya fue cancelada');
        }
        return { reserva: cancelada, reembolsado };
    }
}
exports.ReservaService = ReservaService;
