import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import { gameCatalog } from '../../game/catalog/gameCatalog';
import type { CasinoGameId } from '../../game/ids';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import { sessionStateEnvelopeSchema } from '../../schemas/casinoSchemas/sessionStateEnvelopeSchema';
import { zodErrorSummary } from '../../schemas/casinoSchemas/zodErrorSummary';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { CasinoSessionState } from './CasinoSessionState';
import { createSessionState } from './createSessionState';
import type { PlayerGameSnapshots } from './PlayerGameSnapshots';

type SessionRoomSeatId = 'left' | 'centre' | 'right' | `seat-${number}`;

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
      activeGame: isGameId(session.activeGame) ? session.activeGame : undefined,
      showingGameLobby: Boolean(session.showingGameLobby),
      wagerLimit: Number(session.wagerLimit),
      wagered: Number(session.wagered),
      gameSnapshots: parseGameSnapshots(session.gameSnapshots),
      room: parseRoomState(session.room),
    },
    parseUpdatedAt(session.updatedAt),
  );
};

const isGameId = (value: unknown): value is CasinoGameId => typeof value === 'string' && gameCatalog.some((game) => game.id === value);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const parseRoomState = (value: unknown): CasinoSessionRoomState | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const roomId = typeof value.roomId === 'string' ? value.roomId.trim().toUpperCase() : '';
  const gameId = isGameId(value.gameId) ? value.gameId : undefined;
  const role = value.role === 'player' || value.role === 'spectator' ? value.role : undefined;
  const seatId = parseRoomSeatId(value.seatId);
  return roomId && gameId && role ? { roomId, gameId, role, seatId } : undefined;
};

const parseRoomSeatId = (value: unknown): SessionRoomSeatId | undefined => {
  if (typeof value !== 'string') {
    return undefined;
  }
  const seatId = value.trim();
  return seatId === 'left' || seatId === 'centre' || seatId === 'right' || /^seat-\d+$/.test(seatId) ? (seatId as SessionRoomSeatId) : undefined;
};

const parseUpdatedAt = (value: unknown): Date => {
  const date = typeof value === 'string' ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

const parseGameSnapshots = (value: unknown): Readonly<Record<string, PlayerGameSnapshots>> => {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([profileId, snapshots]) => {
      if (!isRecord(snapshots)) {
        return [];
      }

      return [
        [
          profileId,
          {
            beatTheHouse: parseSnapshotRecord<BeatTheHouseSaveState>(snapshots.beatTheHouse),
            blackjack: parseSnapshotRecord<BlackjackSnapshot>(snapshots.blackjack),
            slots: parseSlotSnapshots(snapshots.slots),
          },
        ],
      ];
    }),
  );
};

const parseSnapshotRecord = <Snapshot>(value: unknown): Snapshot | undefined => (isRecord(value) ? (value as Snapshot) : undefined);

const parseSlotSnapshots = (value: unknown): Readonly<Record<string, SlotSnapshot>> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  return Object.fromEntries(Object.entries(value).filter(([, snapshot]) => isRecord(snapshot))) as Readonly<Record<string, SlotSnapshot>>;
};
