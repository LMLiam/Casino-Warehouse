import { sessionStateV2Schema } from '../../schemas/casinoSchemas/sessionStateV2Schema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSessionState } from './CasinoSessionState';
import { createSessionState } from './createSessionState';
import { SessionStateParser } from './SessionStateParser';
import type { SessionStateInput } from './SessionStateInput';

export const parseSessionStateV2 = (value: SessionStateInput): CasinoSessionState => {
  const parsed = sessionStateV2Schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Session v2 data is not valid. ${zodErrorSummary(parsed.error)}`);
  }
  const session = { ...value, profileId: parsed.data.profileId };

  return createSessionState(
    session.profileId,
    {
      activeGame: SessionStateParser.isGameId(session.activeGame) ? session.activeGame : undefined,
      showingGameLobby: typeof session.showingGameLobby === 'boolean' ? session.showingGameLobby : undefined,
      wagerLimit: Number(session.wagerLimit),
      wagered: Number(session.wagered),
      gameSnapshot: SessionStateParser.parseGameSnapshot(session.gameSnapshot),
      room: SessionStateParser.parseRoomState(session.room),
    },
    SessionStateParser.parseUpdatedAt(session.updatedAt),
  );
};
