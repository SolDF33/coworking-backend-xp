import { Reserva } from '../domain/reserva.model.js';
import { Usuario } from '../domain/usuario.model.js';
import { Articulo } from '../domain/articulo.model.js';

export class ReservaRepository {
  private readonly reservas: Reserva[] = [];
  private readonly usuarios: Usuario[] = [];
  private readonly articulos: Articulo[] = [];
  private readonly refreshTokens = new Map<string, { userId: string; expiresAt: number }>();

  // --- Métodos para Reservas ---
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

  // --- Métodos para Usuarios (Autenticación) ---
  guardarUsuario(usuario: Usuario): Usuario {
    this.usuarios.push(usuario);
    return usuario;
  }

  obtenerUsuarioPorEmail(email: string): Usuario | undefined {
    return this.usuarios.find((usuario) => usuario.email === email);
  }

  obtenerUsuarioPorId(id: string): Usuario | undefined {
    return this.usuarios.find((usuario) => usuario.id === id);
  }

  guardarArticulo(articulo: Articulo): Articulo {
    this.articulos.push(articulo);
    return articulo;
  }

  obtenerArticuloPorId(id: string): Articulo | undefined {
    return this.articulos.find((articulo) => articulo.id === id);
  }

  actualizarArticulo(articulo: Articulo): Articulo {
    const indice = this.articulos.findIndex((actual) => actual.id === articulo.id);
    if (indice === -1) {
      throw new Error('Artículo no encontrado');
    }
    this.articulos[indice] = articulo;
    return articulo;
  }

  guardarRefreshToken(tokenHash: string, userId: string, expiresAt: number): void {
    this.refreshTokens.set(tokenHash, { userId, expiresAt });
  }

  obtenerRefreshToken(tokenHash: string): { userId: string; expiresAt: number } | undefined {
    const session = this.refreshTokens.get(tokenHash);
    if (!session || session.expiresAt <= Date.now()) {
      this.refreshTokens.delete(tokenHash);
      return undefined;
    }
    return session;
  }

  revocarRefreshToken(tokenHash: string): void {
    this.refreshTokens.delete(tokenHash);
  }
}