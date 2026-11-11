# Instrucciones para Codex

## Alcance y forma de trabajo

- Lee `README.md`, `docs/PROJECT_BRIEF.md` y `docs/STATUS.md` antes de modificar.
  Si el encargo afecta a la importación, lee también `docs/CONTRATO_CSV.md`.
- Inspecciona primero la ruta, `git status --short --branch`, la rama y los remotos.
- Trabaja exclusivamente dentro de este proyecto independiente. No modifiques
  archivos, historial ni remotos de otros proyectos.
- La sesión 09 autoriza validación integral, pruebas de aceptación faltantes,
  reproducción en copia aislada, documentación y preparación de GitHub Actions.
- No añadas funcionalidades de producto. Corrige solo defectos demostrables de V1;
  conserva D01–D10, las garantías de importación y las migraciones publicadas.
- La CI remota queda pendiente hasta el commit/push manual y la revisión de su
  ejecución real. No declares V1 cerrada definitivamente antes de comprobarla.
- Usa la instancia PostgreSQL existente, comprobando su estado antes de arrancarla;
  no reinstales PostgreSQL ni reinicialices el cluster.
- Antes de instalar software o iniciar servicios nuevos, solicita autorización.
  Alex autorizó PostgreSQL local aislado en `.local/`, con acceso únicamente
  por `127.0.0.1:55432`, bases de desarrollo y pruebas separadas y sin servicio
  de Windows. No alteres Docker, WSL ni XAMPP como parte de esta preparación.
- Las pruebas de integración usan una base exclusiva terminada en `_test` y
  esquemas nuevos propios; nunca limpies datos o esquemas de procedencia desconocida.
- Conserva las reglas de `docs/CONTRATO_CSV.md`. Si surge una incompatibilidad,
  informa antes de cambiar el comportamiento aprobado.
- D01–D10 están aprobadas en `docs/CONTRATO_CSV.md`: una creación confirmada
  devuelve 201, una repetición exacta recupera el resultado existente con 200 y
  otro archivo con conflictos de SKU devuelve 409.
- La aprobación del contrato no autoriza por sí sola su implementación.
  Distingue reglas aprobadas de aspectos internos aún pendientes y conserva
  los límites de cada encargo.
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

- Usa `npm ci` cuando sea necesario instalar las versiones de `package-lock.json`.
- Ante cambios de código, ejecuta `npm run typecheck`, `npm test` y
  `npm run build`. Para cambios solo documentales, revisa el diff, enlaces,
  ejemplos y coherencia; no presentes resultados históricos como pruebas nuevas.
- Para cambios en el arranque, comprueba también una petición real a `/health`.
- Añade o modifica pruebas que verifiquen comportamiento observable cuando proceda.
- Actualiza `docs/STATUS.md` con resultados reales, bloqueos y siguiente paso.
- No declares comprobaciones correctas si no se han ejecutado.

## Norma permanente: commits y push manuales

**Todos los commits y push serán realizados exclusivamente por el usuario
desde GitHub Desktop.**

- Codex tiene prohibido ejecutar `git commit`, `git push` o acciones equivalentes,
  incluidas operaciones mediante otras herramientas, API, automatizaciones o la
  interfaz de GitHub Desktop, salvo que el usuario modifique expresamente esta norma.
- Una petición genérica de terminar, guardar o publicar el trabajo no modifica
  esta regla. No crees commits, no reescribas commits existentes ni publiques cambios.
- Codex puede inspeccionar Git, implementar código dentro del alcance autorizado,
  ejecutar pruebas, preparar documentación y proponer mensajes de commit.
- Deja los cambios locales para que el usuario los revise, seleccione y confirme
  en GitHub Desktop. No prepares archivos en staging salvo petición expresa.
- Mantén `main` como rama principal y comprueba que `origin` corresponde a
  `AlexC-0/importacion-validacion-datos`.
- Antes de entregar, revisa el diff y enumera los archivos modificados o creados.

## Entrega obligatoria cuando haya modificaciones

Incluye siempre:

1. Resumen fiel de los cambios realizados.
2. Pruebas y comprobaciones ejecutadas, sus resultados y las que no procedan.
3. Propuesta de Summary en castellano para GitHub Desktop.
4. Propuesta de Description fiel al trabajo realizado.
5. Indicación explícita de que el commit y el push quedan pendientes de la
   intervención manual del usuario desde GitHub Desktop.

## Configuración y alcance de publicación

- Conserva `package-lock.json` en el repositorio. Excluye dependencias, `dist/`,
  cobertura, logs, `.env` y credenciales; usa solo ejemplos en `.env.example`.
- No muestres ni guardes secretos en Git, documentación, pruebas o salida de consola.
- El repositorio público ya existe. No crees otro remoto ni cambies su visibilidad
  como parte de una actualización de documentación.
- No despliegues la aplicación.
