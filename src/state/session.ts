import type { BlackjackSnapshot } from '../game/blackjack';
import { gameCatalog, type CasinoGameId } from '../game/catalog';
import type { BeatTheHouseSaveState } from '../game/engine';
import type { SlotSnapshot } from '../game/slots';
import { sessionStateEnvelopeSchema, zodErrorSummary } from '../schemas/casinoSchemas';
import type { StorageLike } from './profiles';

type SessionRoomSeatId = 'left' | 'centre' | 'right' | `seat-${number}`;

export interface PlayerGameSnapshots {
  readonly beatTheHouse?: BeatTheHouseSaveState;
  readonly blackjack?: BlackjackSnapshot;
  readonly slots?: Readonly<Record<string, SlotSnapshot>>;
}

export interface CasinoSessionRoomState {
  readonly roomId: string;
  readonly gameId: CasinoGameId;
  readonly role: 'player' | 'spectator';
  readonly seatId?: SessionRoomSeatId;
}

export interface CasinoSessionState {
  readonly version: 1;
  readonly profileIds: readonly string[];
  readonly selectedPlayerIndex: number;
  readonly activeGame: CasinoGameId;
  readonly showingGameLobby: boolean;
  readonly wagerLimit: number;
  readonly wagered: number;
  readonly gameSnapshots: Readonly<Record<string, PlayerGameSnapshots>>;
  readonly room?: CasinoSessionRoomState;
  readonly updatedAt: string;
}

export interface SessionLoadResult {
  readonly session?: CasinoSessionState;
  readonly recovered: boolean;
  readonly error?: string;
}

export const sessionStorageKey = 'casino_warehouse_session_v1';

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

export const loadSessionState = (storage: StorageLike, key = sessionStorageKey): SessionLoadResult => {
  const raw = storage.getItem(key);
  if (!raw) {
    return { recovered: false };
  }

  try {
    return { session: parseSessionState(JSON.parse(raw)), recovered: false };
  } catch (error) {
    return {
      recovered: true,
      error: error instanceof Error ? error.message : 'Unknown session-data error.',
    };
  }
};

export const saveSessionState = (storage: StorageLike, session: CasinoSessionState, key = sessionStorageKey): void => {
  storage.setItem(key, JSON.stringify(parseSessionState(session)));
};

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
