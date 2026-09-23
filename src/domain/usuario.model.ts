export type RolUsuario = 'USER' | 'EDITOR' | 'ADMIN';

export interface Usuario {
  id: string;
  nombre: string;
  email: string;
  password: string; // Hasheada con bcrypt
  rol: RolUsuario;
  saldoCreditos: number;
}