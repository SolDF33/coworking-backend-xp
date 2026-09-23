"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReservaRepository = void 0;
class ReservaRepository {
    reservas = [];
    usuarios = [];
    articulos = [];
    refreshTokens = new Map();
    // --- Métodos para Reservas ---
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
    // --- Métodos para Usuarios (Autenticación) ---
    guardarUsuario(usuario) {
        this.usuarios.push(usuario);
        return usuario;
    }
    obtenerUsuarioPorEmail(email) {
        return this.usuarios.find((usuario) => usuario.email === email);
    }
    obtenerUsuarioPorId(id) {
        return this.usuarios.find((usuario) => usuario.id === id);
    }
    guardarArticulo(articulo) {
        this.articulos.push(articulo);
        return articulo;
    }
    obtenerArticuloPorId(id) {
        return this.articulos.find((articulo) => articulo.id === id);
    }
    actualizarArticulo(articulo) {
        const indice = this.articulos.findIndex((actual) => actual.id === articulo.id);
        if (indice === -1) {
            throw new Error('Artículo no encontrado');
        }
        this.articulos[indice] = articulo;
        return articulo;
    }
    guardarRefreshToken(tokenHash, userId, expiresAt) {
        this.refreshTokens.set(tokenHash, { userId, expiresAt });
    }
    obtenerRefreshToken(tokenHash) {
        const session = this.refreshTokens.get(tokenHash);
        if (!session || session.expiresAt <= Date.now()) {
            this.refreshTokens.delete(tokenHash);
            return undefined;
        }
        return session;
    }
    revocarRefreshToken(tokenHash) {
        this.refreshTokens.delete(tokenHash);
    }
}
exports.ReservaRepository = ReservaRepository;
