"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const reserva_repository_js_1 = require("./repositories/reserva.repository.js");
const auth_routes_js_1 = require("./routes/auth.routes.js");
const reserva_routes_js_1 = require("./routes/reserva.routes.js");
const reserva_service_js_1 = require("./services/reserva.service.js");
const demo_users_js_1 = require("./seeds/demo-users.js");
const prisma_js_1 = require("./database/prisma.js");
const app = (0, express_1.default)();
exports.app = app;
const port = Number(process.env.PORT ?? 3000);
const repository = new reserva_repository_js_1.ReservaRepository();
const reservaService = new reserva_service_js_1.ReservaService(repository);
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
app.use('/api/reservas', (0, reserva_routes_js_1.createReservaRouter)(reservaService));
app.get('/health', (_request, response) => {
    response.json({ estado: 'ok' });
});
app.use((error, _request, response, _next) => {
    console.error('Error no controlado en una solicitud:', error);
    response.status(500).json({ error: 'Error en el servidor' });
});
const iniciarServidor = async () => {
    await prisma_js_1.prisma.$connect();
    if (process.env.NODE_ENV !== 'production') {
        await (0, demo_users_js_1.cargarUsuariosDemo)(repository);
        console.log('Usuarios demo cargados para desarrollo.');
    }
    else {
        await (0, demo_users_js_1.cargarAdministradorInicial)(repository);
    }
    app.listen(port, () => {
        console.log(`Backend iniciado en http://localhost:${port}`);
    });
};
if (process.env.NODE_ENV !== 'test') {
    void iniciarServidor();
}
