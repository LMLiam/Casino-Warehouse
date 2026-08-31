import type { CasinoGameId } from '../../game/ids';
import type { RoomId } from '../../schemas/casinoSchemas/RoomId';
import type { SessionId } from '../../schemas/casinoSchemas/SessionId';

export interface GameplaySettlementContext {
  readonly gameId: CasinoGameId;
  readonly roomId?: RoomId | undefined;
  readonly sessionId?: SessionId | undefined;
}
