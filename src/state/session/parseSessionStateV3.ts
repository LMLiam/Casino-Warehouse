import { sessionStateV3Schema } from '../../schemas/casinoSchemas/sessionStateV3Schema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSessionStateV3 } from './CasinoSessionStateV3';
import { parseBeatTheHouseSaveStateV3 } from './parseBeatTheHouseSaveStateV3';
import { SessionStateParser } from './SessionStateParser';
import type { SessionStateInput } from './SessionStateInput';

export const parseSessionStateV3 = (value: SessionStateInput | CasinoSessionStateV3): CasinoSessionStateV3 => {
  const parsed = sessionStateV3Schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Session v3 data is not valid. ${zodErrorSummary(parsed.error)}`);
  }
  const session = { ...value, profileId: parsed.data.profileId };
  const gameSnapshot = (() => {
    if (session.gameSnapshot === undefined) {
      return undefined;
    }
    const parsedSnapshot = SessionStateParser.parseGameSnapshot(session.gameSnapshot);
    if (!parsedSnapshot) {
      return undefined;
    }
    return {
      ...parsedSnapshot,
      beatTheHouse: parseBeatTheHouseSaveStateV3(parsedSnapshot.beatTheHouse),
    };
  })();
  return {
    version: 3,
    profileId: session.profileId,
    activeGame: SessionStateParser.isGameId(session.activeGame) ? session.activeGame : 'beat-the-house',
    showingGameLobby: typeof session.showingGameLobby === 'boolean' ? session.showingGameLobby : true,
    wagerLimit: SessionStateParser.safeMoney(session.wagerLimit),
    wagered: SessionStateParser.safeMoney(session.wagered),
    gameSnapshot,
    room: SessionStateParser.parseRoomState(session.room),
    updatedAt: SessionStateParser.parseUpdatedAt(session.updatedAt).toISOString(),
  };
};
