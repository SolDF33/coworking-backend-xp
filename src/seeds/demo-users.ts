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
    if (repository.obtenerUsuarioPorEmail(usuarioDemo.email)) {
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

    repository.guardarUsuario(usuario);
  }
};
