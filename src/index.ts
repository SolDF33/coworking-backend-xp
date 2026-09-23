import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { ReservaRepository } from './repositories/reserva.repository.js';
import { createAuthRouter } from './routes/auth.routes.js';
import { cargarUsuariosDemo } from './seeds/demo-users.js';

const app = express();
const port = Number(process.env.PORT ?? 3000);
const repository = new ReservaRepository();
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim());
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Demasiados intentos de inicio de sesión.' }
});

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());
const authRouter = createAuthRouter(repository);
app.use('/api/login', loginLimiter);
app.use('/api', authRouter);

app.get('/health', (_request, response) => {
  response.json({ estado: 'ok' });
});

const iniciarServidor = async (): Promise<void> => {
  if (process.env.NODE_ENV !== 'production') {
    await cargarUsuariosDemo(repository);
    console.log('Usuarios demo cargados para desarrollo.');
  }

  app.listen(port, () => {
    console.log(`Backend iniciado en http://localhost:${port}`);
  });
};

void iniciarServidor();