"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const reserva_repository_js_1 = require("./repositories/reserva.repository.js");
const auth_routes_js_1 = require("./routes/auth.routes.js");
const demo_users_js_1 = require("./seeds/demo-users.js");
const app = (0, express_1.default)();
const port = Number(process.env.PORT ?? 3000);
const repository = new reserva_repository_js_1.ReservaRepository();
const allowedOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:3000').split(',').map((origin) => origin.trim());
const loginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de inicio de sesión.' }
});
app.use((0, cors_1.default)({ origin: allowedOrigins }));
app.use(express_1.default.json());
const authRouter = (0, auth_routes_js_1.createAuthRouter)(repository);
app.use('/api/login', loginLimiter);
app.use('/api', authRouter);
app.get('/health', (_request, response) => {
    response.json({ estado: 'ok' });
});
const iniciarServidor = async () => {
    if (process.env.NODE_ENV !== 'production') {
        await (0, demo_users_js_1.cargarUsuariosDemo)(repository);
        console.log('Usuarios demo cargados para desarrollo.');
    }
    app.listen(port, () => {
        console.log(`Backend iniciado en http://localhost:${port}`);
    });
};
void iniciarServidor();
