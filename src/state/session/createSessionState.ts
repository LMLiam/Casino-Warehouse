import { gameCatalog } from '../../game/catalog/gameCatalog';
import { createIsoTimestamp } from '../../schemas/casinoSchemas/createIsoTimestamp';
import type { ProfileId } from '../../schemas/casinoSchemas/ProfileId';
import type { CasinoSessionState } from './CasinoSessionState';

export const createSessionState = (
  profileId: ProfileId,
  options: Partial<Omit<CasinoSessionState, 'profileId' | 'updatedAt'>> = {},
  now = new Date(),
): CasinoSessionState => {
  const fallbackGame = gameCatalog[0];
  if (!fallbackGame) {
    throw new Error('Game catalog is empty.');
  }
  return {
    profileId,
    activeGame: options.activeGame ?? fallbackGame.id,
    showingGameLobby: options.showingGameLobby ?? true,
    wagerLimit: Number.isFinite(options.wagerLimit) ? Math.max(0, Math.floor(options.wagerLimit ?? 0)) : 0,
    wagered: Number.isFinite(options.wagered) ? Math.max(0, Math.floor(options.wagered ?? 0)) : 0,
    gameSnapshot: options.gameSnapshot,
    room: options.room,
    updatedAt: createIsoTimestamp(now),
  };
};
