# Importación y validación de datos

Proyecto 01 de **CHAMBA DIARIA**: una API REST para importar productos desde
archivos CSV, validar los datos y guardar importaciones válidas en PostgreSQL.

## Estado actual

Sesión 01: base técnica local con Express y TypeScript, endpoint `GET /health`,
prueba automatizada con Vitest y Supertest y documentación inicial.

Todavía no se han implementado la base de datos, la importación CSV ni las
consultas de productos e importaciones. No hay despliegue.

## Tecnologías y requisitos

- Node.js 24 LTS, versión 24.13.0 o superior dentro de la rama 24.
- npm (comprobación inicial con 11.6.2).
- TypeScript y Express.
- Vitest y Supertest para pruebas; tsx para ejecutar TypeScript en desarrollo.
- Git y GitHub para control de versiones.
- PostgreSQL previsto para sesiones posteriores; no es necesario para arrancar ahora.
- Docker es opcional. Apache, PHP y MySQL no participan en esta API.

Las versiones exactas de las dependencias quedan fijadas en `package-lock.json`.

## Instalación

Abre esta carpeta como proyecto independiente en VS Code y ejecuta:

```powershell
npm ci
```

Opcionalmente, crea la configuración local:

```powershell
Copy-Item .env.example .env
```

`.env` está excluido de Git. La única variable actual es `PORT`, con valor
predeterminado `3000` y rango válido de 1 a 65535. Los scripts de arranque
leen el archivo si existe; no es necesario crearlo. Las variables del proceso
tienen prioridad sobre ese archivo.

## Ejecutar la API

```powershell
npm run dev
```

El proceso se reinicia al cambiar el código. Para detenerlo, pulsa `Ctrl+C`.

En otra terminal:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Respuesta HTTP 200, con Content-Type JSON:

```json
{ "status": "ok" }
```

Este endpoint confirma que el proceso HTTP responde; todavía no comprueba
conexión con una base de datos. El servidor escucha únicamente en
`127.0.0.1` para trabajar en local. Si el puerto está ocupado, cambia `PORT`.

Para compilar y ejecutar JavaScript:

```powershell
npm run build
npm start
```

## Pruebas y comprobaciones

```powershell
npm run typecheck
npm test
npm run build
```

`typecheck` comprueba los tipos de código y pruebas. `build` genera solo la
aplicación en `dist/`. La prueba HTTP valida estado 200, Content-Type y cuerpo
de `GET /health`; no necesita PostgreSQL ni un servidor iniciado.
Para mantener Vitest observando cambios, usa `npm run test:watch`.

## Estructura

```text
src/
  app.ts                 # Aplicación Express y rutas
  server.ts              # Arranque del servidor local
tests/
  health.test.ts         # Contrato HTTP de /health
docs/
  PROJECT_BRIEF.md        # Alcance y criterios de finalización
  STATUS.md               # Estado real y siguiente paso
AGENTS.md                 # Instrucciones operativas para Codex
.env.example              # Configuración local de ejemplo
package.json
package-lock.json
tsconfig.json
tsconfig.build.json
```

## Desarrollo y seguimiento

Consulta [el alcance](docs/PROJECT_BRIEF.md), [el estado](docs/STATUS.md) y
[las instrucciones operativas](AGENTS.md) antes de continuar.

La sesión 01 termina con esta base comprobada y su commit inicial.
La creación de un repositorio público en GitHub exige confirmar expresamente
cuenta, nombre y visibilidad. Publicar el código no despliega el servicio.
