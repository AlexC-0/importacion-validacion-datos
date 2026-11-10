import { app } from './app.js';

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT debe ser un número entero entre 1 y 65535.');
}

app.listen(port, '127.0.0.1', (error) => {
  if (error) {
    console.error('No se pudo iniciar la API:', error.message);
    process.exitCode = 1;
    return;
  }

  console.log(`API disponible en http://127.0.0.1:${port}`);
});
