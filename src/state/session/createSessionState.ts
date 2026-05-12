import type { BlackjackSnapshot } from '../../game/blackjack/BlackjackSnapshot';
import { gameCatalog } from '../../game/catalog/gameCatalog';
import type { CasinoGameId } from '../../game/ids';
import type { BeatTheHouseSaveState } from '../../game/engine/BeatTheHouseSaveState';
import type { SlotSnapshot } from '../../game/slots/SlotSnapshot';
import type { CasinoSessionRoomState } from './CasinoSessionRoomState';
import type { CasinoSessionState } from './CasinoSessionState';
import type { PlayerGameSnapshots } from './PlayerGameSnapshots';

type SessionRoomSeatId = 'left' | 'centre' | 'right' | `seat-${number}`;

export const createSessionState = (
  profileIds: readonly string[],
  options: Partial<Omit<CasinoSessionState, 'version' | 'profileIds' | 'updatedAt'>> = {},
  now = new Date(),
): CasinoSessionState => ({
  version: 1,
  profileIds: [...new Set(profileIds)].filter(Boolean),
  selectedPlayerIndex: Math.max(0, Math.floor(options.selectedPlayerIndex ?? 0)),
  activeGame: isGameId(options.activeGame) ? options.activeGame : gameCatalog[0].id,
  showingGameLobby: options.showingGameLobby ?? true,
  wagerLimit: safeMoney(options.wagerLimit),
  wagered: safeMoney(options.wagered),
  gameSnapshots: parseGameSnapshots(options.gameSnapshots),
  room: parseRoomState(options.room),
  updatedAt: now.toISOString(),
});

const isGameId = (value: unknown): value is CasinoGameId => typeof value === 'string' && gameCatalog.some((game) => game.id === value);

const safeMoney = (value: unknown): number => (Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0);

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
