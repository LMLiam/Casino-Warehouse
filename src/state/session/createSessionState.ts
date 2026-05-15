import { gameCatalog } from '../../game/catalog/gameCatalog';
import type { CasinoSessionState } from './CasinoSessionState';
import { currentSessionStateVersion } from './currentSessionStateVersion';
import { SessionStateParser } from './SessionStateParser';

export const createSessionState = (
  profileId: string,
  options: Partial<Omit<CasinoSessionState, 'version' | 'profileId' | 'updatedAt'>> = {},
  now = new Date(),
): CasinoSessionState => ({
  version: currentSessionStateVersion,
  profileId,
  activeGame: SessionStateParser.isGameId(options.activeGame) ? options.activeGame : gameCatalog[0].id,
  showingGameLobby: options.showingGameLobby ?? true,
  wagerLimit: SessionStateParser.safeMoney(options.wagerLimit),
  wagered: SessionStateParser.safeMoney(options.wagered),
  gameSnapshot: SessionStateParser.parseGameSnapshot(options.gameSnapshot),
  room: SessionStateParser.parseRoomState(options.room),
  updatedAt: now.toISOString(),
});
