import { gameCatalog } from '../../game/catalog/gameCatalog';
import type { CasinoSessionState } from './CasinoSessionState';

export const createSessionState = (
  profileId: string,
  options: Partial<Omit<CasinoSessionState, 'profileId' | 'updatedAt'>> = {},
  now = new Date(),
): CasinoSessionState => ({
  profileId,
  activeGame: options.activeGame ?? gameCatalog[0].id,
  showingGameLobby: options.showingGameLobby ?? true,
  wagerLimit: Number.isFinite(options.wagerLimit) ? Math.max(0, Math.floor(options.wagerLimit ?? 0)) : 0,
  wagered: Number.isFinite(options.wagered) ? Math.max(0, Math.floor(options.wagered ?? 0)) : 0,
  gameSnapshot: options.gameSnapshot,
  room: options.room,
  updatedAt: now.toISOString(),
});
