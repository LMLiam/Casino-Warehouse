import { gameCatalog } from '../../game/catalog/gameCatalog';
import type { CasinoSessionState } from './CasinoSessionState';
import { currentSessionStateVersion } from './currentSessionStateVersion';
import { SessionStateParser } from './SessionStateParser';

export const createSessionState = (
  profileIds: readonly string[],
  options: Partial<Omit<CasinoSessionState, 'version' | 'profileIds' | 'updatedAt'>> = {},
  now = new Date(),
): CasinoSessionState => ({
  version: currentSessionStateVersion,
  profileIds: [...new Set(profileIds)].filter(Boolean),
  selectedPlayerIndex: Math.max(0, Math.floor(options.selectedPlayerIndex ?? 0)),
  activeGame: SessionStateParser.isGameId(options.activeGame) ? options.activeGame : gameCatalog[0].id,
  showingGameLobby: options.showingGameLobby ?? true,
  wagerLimit: SessionStateParser.safeMoney(options.wagerLimit),
  wagered: SessionStateParser.safeMoney(options.wagered),
  gameSnapshots: SessionStateParser.parseGameSnapshots(options.gameSnapshots),
  room: SessionStateParser.parseRoomState(options.room),
  updatedAt: now.toISOString(),
});
