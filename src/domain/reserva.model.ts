export interface Reserva {
  id: string;
  usuarioId: string;
  sala: string;
  fecha: string;
  costoCreditos: number;
  estado: 'Confirmada' | 'Cancelada';
}