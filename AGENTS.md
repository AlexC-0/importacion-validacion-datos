# Instrucciones para Codex

## Alcance y forma de trabajo

- Lee `README.md`, `docs/PROJECT_BRIEF.md` y `docs/STATUS.md` antes de modificar.
- Inspecciona primero la ruta, `git status --short --branch`, la rama y los remotos.
- Trabaja exclusivamente dentro de este proyecto independiente. No modifiques
  archivos, historial ni remotos de otros proyectos.
- Respeta la sesión y el alcance autorizados. La sesión 01 incluye solo la base
  técnica, `GET /health`, su prueba y documentación. No implementes todavía CSV
  ni PostgreSQL.
- Mantén cambios pequeños, comprensibles y enfocados en una funcionalidad verificable.
- Conserva los cambios existentes del usuario; no los sobrescribas ni reviertas
  sin autorización.
- Evita arquitecturas complejas, microservicios y dependencias anticipadas.
- Mantén TypeScript en modo estricto y separa la aplicación del arranque HTTP.
- Usa imports internos con extensión `.js`, compatibles con NodeNext y la
  ejecución del JavaScript compilado.
- Escribe documentación principalmente en castellano y conserva términos técnicos
  habituales en inglés.

## Comprobaciones

- Usa `npm ci` para instalar las versiones fijadas en `package-lock.json`.
- Ante cambios de código, ejecuta `npm run typecheck`, `npm test` y
  `npm run build`. Ajusta la verificación al alcance de cambios documentales.
- Para cambios en el arranque, comprueba también una petición real a `/health`.
- Añade o modifica pruebas que verifiquen comportamiento observable.
- Actualiza `docs/STATUS.md` con resultados reales, bloqueos y siguiente paso.
- No declares comprobaciones correctas si no se han ejecutado.

## Git, configuración y publicación

- Usa `main` como rama principal y commits descriptivos.
- Antes de cada commit, revisa el diff preparado y los archivos que se incluirán.
- Versiona `package-lock.json`. Excluye dependencias, `dist/`, cobertura,
  logs, `.env` y credenciales; usa solo valores de ejemplo en `.env.example`.
- No muestres ni guardes secretos en Git, documentación, pruebas o salida de consola.
- Comprueba identidad autenticada y ausencia de un repositorio homónimo antes
  de crear el remoto.
- La creación remota inicial requiere confirmación explícita del usuario sobre
  cuenta, nombre y visibilidad. No repitas una confirmación ya concedida.
- Publica únicamente commits comprobados y autorizados. No despliegues la aplicación.
