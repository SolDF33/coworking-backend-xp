import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';
import { ReservaRepository } from '../repositories/reserva.repository.js';
import { RolUsuario, Usuario } from '../domain/usuario.model.js';
import { JWT_SECRET } from '../middlewares/auth.middleware.js';

export class AuthController {
  constructor(private readonly repository: ReservaRepository) {}

  register = async (req: Request, res: Response) => {
    try {
      const { nombre, email, password } = req.body;

      if (
        typeof nombre !== 'string' ||
        typeof email !== 'string' ||
        typeof password !== 'string' ||
        !nombre.trim() ||
        !email.trim() ||
        !password
      ) {
        return res.status(400).json({
          error: 'nombre, email y password son obligatorios'
        });
      }

      const emailNormalizado = email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNormalizado)) {
        return res.status(400).json({ error: 'El email no tiene un formato válido' });
      }

      if (password.length < 6) {
        return res.status(400).json({
          error: 'La contraseña debe tener al menos 6 caracteres'
        });
      }

      if (await this.repository.obtenerUsuarioPorEmail(emailNormalizado)) {
        return res.status(409).json({ error: 'El email ya está registrado' });
      }

      const rolUsuario: RolUsuario = 'USER';

      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      const nuevoUsuario: Usuario = {
        id: crypto.randomUUID(),
        nombre: nombre.trim(),
        email: emailNormalizado,
        password: hashedPassword,
        rol: rolUsuario,
        saldoCreditos: 100
      };

      await this.repository.guardarUsuario(nuevoUsuario);
      return res.status(201).json({ mensaje: 'Usuario registrado exitosamente' });
    } catch (error: unknown) {
      const detalle = error instanceof Error ? error.message : 'Error desconocido';
      return res.status(500).json({ error: 'Error en el servidor', detalle });
    }
  };

  login = async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) {
        return res.status(400).json({
          error: 'email y password son obligatorios'
        });
      }

      const usuario = await this.repository.obtenerUsuarioPorEmail(email.trim().toLowerCase());

      if (!usuario) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const passwordValida = await bcrypt.compare(password, usuario.password);
      if (!passwordValida) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      const payload = { id: usuario.id, rol: usuario.rol };
      const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
      const refreshToken = crypto.randomBytes(48).toString('hex');
      const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.repository.guardarRefreshToken(
        refreshTokenHash,
        usuario.id,
        Date.now() + 7 * 24 * 60 * 60 * 1000
      );

      return res.json({ mensaje: 'Inicio de sesión exitoso', token, refreshToken });
    } catch (error: unknown) {
      console.error('Error al iniciar sesión:', error);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
  };

  refresh = async (req: Request, res: Response) => {
    try {
      const { refreshToken } = req.body;
      if (typeof refreshToken !== 'string' || !refreshToken) {
        return res.status(400).json({ error: 'refreshToken es obligatorio' });
      }

      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      const session = await this.repository.obtenerRefreshToken(hash);
      if (!session) {
        return res.status(401).json({ error: 'Refresh token inválido o expirado' });
      }

      const usuario = await this.repository.obtenerUsuarioPorId(session.userId);
      if (!usuario) {
        return res.status(401).json({ error: 'Usuario no encontrado' });
      }

      await this.repository.revocarRefreshToken(hash);
      const token = jwt.sign({ id: usuario.id, rol: usuario.rol }, JWT_SECRET, { expiresIn: '15m' });
      const nuevoRefreshToken = crypto.randomBytes(48).toString('hex');
      const nuevoHash = crypto.createHash('sha256').update(nuevoRefreshToken).digest('hex');
      await this.repository.guardarRefreshToken(
        nuevoHash,
        usuario.id,
        Date.now() + 7 * 24 * 60 * 60 * 1000
      );
      return res.json({ token, refreshToken: nuevoRefreshToken });
    } catch (error: unknown) {
      console.error('Error al renovar la sesión:', error);
      return res.status(500).json({ error: 'Error en el servidor' });
    }
  };
}