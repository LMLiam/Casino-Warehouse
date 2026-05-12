import type { Server } from 'node:http';

export interface CasinoServer extends Server {
  readonly closePeers: () => void;
}
