# Sistema de Gestión de Reservas de Coworking - Backend Integrated with XP & BDD

Este proyecto corresponde a un backend de gestión de reservas desarrollado bajo los principios de **Extreme Programming (XP)** y **Behavior-Driven Development (BDD)** en TypeScript.

---

## 🛠️ Tecnologías Utilizadas

* **Lenguaje:** TypeScript (Strict Mode activado)
* **Framework Web:** Express.js
* **BDD/Testing Framework:** Cucumber JS + TSX
* **CI/CD:** GitHub Actions
* **Entorno de Ejecución:** Node.js

---

## 🚀 Instrucciones de Ejecución Local

### 1. Requisitos Previos
Asegúrate de tener instalado **Node.js** (versión 18 o superior) y **npm**.

### 2. Instalación de Dependencias
Clona el repositorio e instala los paquetes necesarios:

\`\`\`bash
git clone https://github.com/SolDF33/coworking-backend-xp.git
cd coworking-backend-xp
npm install
\`\`\`

### 3. Ejecutar la Suite BDD (Pruebas E2E)
Para correr los escenarios de comportamiento escritos en Gherkin:

\`\`\`bash
npm run test:e2e
\`\`\`

### 4. Levantar el Servidor en Modo Desarrollo
Para iniciar la API REST en modo observación:

\`\`\`bash
npm run dev
\`\`\`

---

## 📸 Evidencias del Ciclo TDD / BDD (XP)

En cumplimiento con la metodología XP y BDD, se evidencia el ciclo de desarrollo desde la prueba fallida hasta la solución implementada:

### 1. Fase RED (Fallo Controlado por Ausencia de Lógica)
Prueba de Cucumber ejecutada antes de implementar los servicios de negocio en TypeScript, verificando que los escenarios fallan correctamente:

![Fase RED - Prueba Fallida](docs/assets/faseRED.png)

---

### 2. Fase GREEN (Implementación del Código Mínimo)
Prueba de Cucumber ejecutada tras desarrollar la arquitectura en capas y la lógica de dominio en TypeScript, logrando el éxito de la suite BDD:

![Fase GREEN - Prueba Exitosa](docs/assets/faseGREEN.png)

---

## 🧠 Decisiones de Diseño Basadas en Prácticas XP

### 1. Desarrollo Guiado por Pruebas (TDD / BDD)
* Se redactaron las historias de usuario y sus escenarios ejecutables en Gherkin (`.feature`) antes de codificar la solución técnica.
* Se respetó la **Fase RED** confirmando el fallo controlado por ausencia de servicio, y posteriormente se implementó el código mínimo en TypeScript para llevar los escenarios a **GREEN**.

### 2. Diseño Simple (YAGNI - You Aren't Gonna Need It)
* Se priorizó una arquitectura desacoplada en capas (`domain`, `repositories`, `services`, `controllers`).
* Para evitar la sobreingeniería inicial, se utilizó un **repositorio en memoria** garantizando que la lógica responda exactamente a las necesidades de los escenarios de Cucumber sin agregar complejidad innecesaria.

### 3. Integración Continua (CI)
* Se configuró un flujo automatizado en GitHub Actions (`.github/workflows/main.yml`) que valida la compilación TypeScript (`tsc`) y la ejecución de la suite BDD en múltiples entornos de Node.js con cada `push` o `pull request`.

### 4. Propiedad Colectiva y Código Limpio
* Tipado estricto mediante `tsconfig.json` para evitar errores en tiempo de ejecución.
* Separación clara de responsabilidades asegurando mantenibilidad y facilidad para refactorizaciones continuas.
