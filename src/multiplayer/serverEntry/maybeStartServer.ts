import { fileURLToPath } from 'node:url';
import { createCasinoServer } from './createCasinoServer';

export const maybeStartServer = (entryModuleUrl: string): void => {
  if (!process.argv[1] || fileURLToPath(entryModuleUrl) !== process.argv[1]) {
    return;
  }

  /* v8 ignore next 6 -- exercised manually by dev:server/build:server; tests use createCasinoServer with ephemeral ports. */
  const port = Number(process.env.PORT ?? 8787);
  const host = process.env.HOST ?? '127.0.0.1';
  const server = createCasinoServer();
  server.listen(port, host, () => {
    console.log(`Casino Warehouse server listening on http://${host}:${port}`);
    console.log(`Expose this port with a public tunnel for tablet multiplayer testing.`);
  });
};
