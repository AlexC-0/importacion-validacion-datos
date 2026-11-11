# Importación y validación de datos

Proyecto 01 de **CHAMBA DIARIA**: una API REST para importar productos desde
archivos CSV, validar los datos y guardar importaciones válidas en PostgreSQL.

## Estado actual

La base de la sesión 01 está publicada en el repositorio público
[AlexC-0/importacion-validacion-datos](https://github.com/AlexC-0/importacion-validacion-datos),
en la rama principal `main`, con el commit inicial `852e829`.
La versión actual del proyecto en `package.json` es `0.1.0`.

Está preparada la API con Express y TypeScript, el endpoint `GET /health`
y su prueba con Vitest y Supertest. La sesión 02 actualiza la documentación y
añade una [propuesta de contrato CSV](docs/CONTRATO_CSV.md), pendiente de revisión
y aprobación antes de implementar sus reglas.

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
  CONTRATO_CSV.md         # Propuesta técnica pendiente de aprobación
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

Todos los commits y push los realiza exclusivamente el usuario desde GitHub
Desktop. Codex deja los cambios locales para revisión y propone un Summary
en castellano y una Description fiel al trabajo realizado; tiene prohibido
ejecutar `git commit`, `git push` o acciones equivalentes mientras el usuario
no modifique expresamente esta norma.

El código está publicado en GitHub; la API no está desplegada. El siguiente
paso es revisar las decisiones abiertas de `docs/CONTRATO_CSV.md`.
La documentación de la sesión 02 debe confirmarse y subirse manualmente.
