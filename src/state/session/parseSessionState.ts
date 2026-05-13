import { sessionStateEnvelopeSchema } from '../../schemas/casinoSchemas/sessionStateEnvelopeSchema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSessionState } from './CasinoSessionState';
import { createSessionState } from './createSessionState';
import { SessionStateParser } from './SessionStateParser';

export const parseSessionState = (value: unknown): CasinoSessionState => {
  const parsed = sessionStateEnvelopeSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Session data is not valid. ${zodErrorSummary(parsed.error)}`);
  }
  const session = value as Record<string, unknown>;

  return createSessionState(
    parsed.data.profileIds.filter((id): id is string => typeof id === 'string'),
    {
      selectedPlayerIndex: Number(session.selectedPlayerIndex),
      activeGame: SessionStateParser.isGameId(session.activeGame) ? session.activeGame : undefined,
      showingGameLobby: Boolean(session.showingGameLobby),
      wagerLimit: Number(session.wagerLimit),
      wagered: Number(session.wagered),
      gameSnapshots: SessionStateParser.parseGameSnapshots(session.gameSnapshots),
      room: SessionStateParser.parseRoomState(session.room),
    },
    SessionStateParser.parseUpdatedAt(session.updatedAt),
  );
};
