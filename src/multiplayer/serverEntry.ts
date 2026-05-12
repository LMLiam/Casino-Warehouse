import { maybeStartServer } from './serverEntry/maybeStartServer';

export type { CasinoServerOptions } from './serverEntry/CasinoServerOptions';
export type { CasinoRoomAuthority } from './serverEntry/CasinoRoomAuthority';
export type { CasinoServer } from './serverEntry/CasinoServer';
export { createCasinoServer } from './serverEntry/createCasinoServer';

maybeStartServer(import.meta.url);
