import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Sur Cowork API',
      version: '1.0.0',
      description: 'API REST para la gestión de reservas de espacios de coworking.',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Servidor de desarrollo',
      },
    ],
    tags: [
      { name: 'Sistema', description: 'Estado de la API' },
      { name: 'Auth', description: 'Autenticación y sesiones' },
      { name: 'Usuarios', description: 'Gestión de perfil' },
      { name: 'Salas', description: 'Administración de espacios de coworking' },
      { name: 'Reservas', description: 'Gestión de turnos y reservas' },
      { name: 'Reportes', description: 'Reportes de utilización (solo ADMIN)' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'], 
};

export const swaggerSpec = swaggerJsdoc(options) as any;
console.log(`Swagger routes loaded: ${Object.keys(swaggerSpec.paths || {}).length}`);