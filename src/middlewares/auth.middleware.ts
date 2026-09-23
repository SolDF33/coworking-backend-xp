import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RolUsuario } from '../domain/usuario.model.js';

const configuredSecret = process.env.JWT_SECRET;

if (process.env.NODE_ENV === 'production' && !configuredSecret) {
  throw new Error('JWT_SECRET debe estar configurado en producción');
}

export const JWT_SECRET = configuredSecret ?? `development-${process.pid}-${Date.now()}`;

export interface RequestAutenticado extends Request {
  usuario?: {
    id: string;
    rol: RolUsuario;
  };
}

export const verificarToken = (req: RequestAutenticado, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const [scheme, token] = authHeader?.split(' ') ?? [];

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Acceso denegado. No se proporcionó un token.' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);

    if (
      typeof payload !== 'object' ||
      payload === null ||
      typeof payload.id !== 'string' ||
      !['USER', 'EDITOR', 'ADMIN'].includes(payload.rol)
    ) {
      return res.status(403).json({ error: 'Token inválido o expirado.' });
    }

    const payloadDecodificado = {
      id: payload.id,
      rol: payload.rol as RolUsuario
    };

    req.usuario = payloadDecodificado;
    next();
  } catch {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
};

export const requerirRol = (rolesPermitidos: RolUsuario[]) => {
  return (req: RequestAutenticado, res: Response, next: NextFunction) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No tienes los permisos necesarios.' });
    }
    next();
  };
};

export const requerirPropietario = (obtenerPropietario: (id: string) => string | undefined) => {
  return (req: RequestAutenticado, res: Response, next: NextFunction) => {
    const usuario = req.usuario;
    const recursoId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const propietarioId = obtenerPropietario(recursoId);

    if (!propietarioId) {
      return res.status(404).json({ error: 'Recurso no encontrado' });
    }
    if (usuario?.rol !== 'ADMIN' && propietarioId !== usuario?.id) {
      return res.status(403).json({ error: 'No tienes permisos sobre este recurso' });
    }
    next();
  };
};