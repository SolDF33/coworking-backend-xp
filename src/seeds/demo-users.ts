import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { ReservaRepository } from '../repositories/reserva.repository.js';
import { RolUsuario, Usuario } from '../domain/usuario.model.js';

const USUARIOS_DEMO: ReadonlyArray<{
  nombre: string;
  email: string;
  password: string;
  rol: RolUsuario;
}> = [
  {
    nombre: 'Administrador Demo',
    email: 'admin@example.com',
    password: 'Admin123',
    rol: 'ADMIN'
  },
  {
    nombre: 'Editor Demo',
    email: 'editor@example.com',
    password: 'Editor123',
    rol: 'EDITOR'
  },
  {
    nombre: 'Usuario Demo',
    email: 'usuario@example.com',
    password: 'User123',
    rol: 'USER'
  }
];

export const cargarUsuariosDemo = async (repository: ReservaRepository): Promise<void> => {
  for (const usuarioDemo of USUARIOS_DEMO) {
    if (await repository.obtenerUsuarioPorEmail(usuarioDemo.email)) {
      continue;
    }

    const usuario: Usuario = {
      id: randomUUID(),
      nombre: usuarioDemo.nombre,
      email: usuarioDemo.email,
      password: await bcrypt.hash(usuarioDemo.password, 12),
      rol: usuarioDemo.rol,
      saldoCreditos: 100
    };

    await repository.guardarUsuario(usuario);
  }
};

export const cargarAdministradorInicial = async (repository: ReservaRepository): Promise<void> => {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email && !password) {
    return;
  }
  if (!email || !password) {
    throw new Error('ADMIN_EMAIL y ADMIN_PASSWORD deben configurarse juntos');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('ADMIN_EMAIL no tiene un formato válido');
  }
  if (password.length < 12) {
    throw new Error('ADMIN_PASSWORD debe tener al menos 12 caracteres');
  }

  const existente = await repository.obtenerUsuarioPorEmail(email);
  if (existente) {
    if (existente.rol !== 'ADMIN') {
      throw new Error('ADMIN_EMAIL ya pertenece a un usuario que no es administrador');
    }
    return;
  }

  await repository.guardarUsuario({
    id: randomUUID(),
    nombre: 'Administrador',
    email,
    password: await bcrypt.hash(password, 12),
    rol: 'ADMIN',
    saldoCreditos: 100
  });
};
