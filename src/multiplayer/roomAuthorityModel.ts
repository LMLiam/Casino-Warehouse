import type { BlackjackSnapshot } from '../game/blackjack';
import { BlackjackTable } from '../game/blackjackTable';
import { findGame, findSlotTheme } from '../game/catalog';
import { BeatTheHouseGame } from '../game/engine';
import { SlotsGame, type SlotSnapshot } from '../game/slots';
import { betTypes, handIds, type GameSnapshot, type HandId } from '../game/types';
import type { RoomGameId, RoomPlayer, RoomRole, RoomSeatId, RoomSettlement, RoomSnapshot, RoomSummary } from './protocol';
import { normalizeRoomMaxPlayers } from './roomLimits';

export const mainBeatRoomId = 'BEATMAIN';

export interface AuthorityResult {
  readonly broadcasts: readonly RoomSnapshot[];
  readonly settlements: readonly RoomSettlement[];
  readonly direct?: RoomSnapshot;
  readonly roomList?: { readonly gameId: RoomGameId; readonly rooms: readonly RoomSummary[] };
  readonly error?: string;
}

export type GameModel =
  | { readonly kind: 'beat-the-house'; readonly game: BeatTheHouseGame }
  | { readonly kind: 'blackjack'; readonly table: BlackjackTable; settledSessionIds: Set<string> }
  | {
      readonly kind: 'slots';
      readonly game: SlotsGame;
      wagersByProfileId: Map<string, number>;
      readyProfileIds: Set<string>;
      lastSpinByProfileId?: string;
      returnedByProfileId: Map<string, number>;
      settledSpinKeys: Set<string>;
    };

export interface RoomState {
  readonly roomId: string;
  readonly roomName: string;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly hostProfileId: string;
  readonly maxPlayers: number;
  readonly allowSpectators: boolean;
  readonly players: Map<string, RoomPlayer>;
  readonly spectators: Map<string, RoomPlayer>;
  readonly connectionToMember: Map<string, { readonly profileId: string; readonly role: RoomRole }>;
  readonly seats: Map<RoomSeatId, string>;
  readonly model: GameModel;
  readonly createdAt: number;
  updatedAt: number;
  sessionId: string;
  revision: number;
  readonly serverManaged: boolean;
  settledSessionIds: Set<string>;
  lastBeatEvents: GameSnapshot['lastEvents'];
}

export type RoomAuthoritySnapshot = GameSnapshot | BlackjackSnapshot | SlotSnapshot;
export type { RoomSettlement, RoomSummary } from './protocol';

export const createGameModel = (gameId: RoomGameId, bankroll: number): GameModel => {
  if (gameId === 'beat-the-house') {
    return { kind: 'beat-the-house', game: new BeatTheHouseGame({ initialBankroll: bankroll }) };
  }
  if (gameId === 'blackjack') {
    return { kind: 'blackjack', table: new BlackjackTable(), settledSessionIds: new Set() };
  }
  return {
    kind: 'slots',
    game: new SlotsGame({ theme: findSlotTheme(gameId) }),
    wagersByProfileId: new Map(),
    readyProfileIds: new Set(),
    returnedByProfileId: new Map(),
    settledSpinKeys: new Set(),
  };
};

export const createServerManagedBeatRoom = (): RoomState => {
  const catalogGame = findGame('beat-the-house');
  const now = Date.now();
  return {
    roomId: mainBeatRoomId,
    roomName: 'Beat the House Main Room',
    gameId: 'beat-the-house',
    gameTitle: catalogGame.title,
    hostProfileId: 'server',
    maxPlayers: normalizeRoomMaxPlayers('beat-the-house', undefined),
    allowSpectators: true,
    players: new Map(),
    spectators: new Map(),
    connectionToMember: new Map(),
    seats: new Map(),
    model: createGameModel('beat-the-house', 0),
    createdAt: now,
    updatedAt: now,
    sessionId: createId('session'),
    revision: 0,
    serverManaged: true,
    settledSessionIds: new Set(),
    lastBeatEvents: [],
  };
};

export const compareRoomListOrder = (left: RoomState, right: RoomState): number => {
  const leftActive = left.players.size + left.spectators.size > 0;
  const rightActive = right.players.size + right.spectators.size > 0;
  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1;
  }
  if (left.serverManaged !== right.serverManaged) {
    return left.serverManaged ? 1 : -1;
  }
  return left.createdAt - right.createdAt;
};

export const roomPhase = (room: RoomState): RoomSnapshot['phase'] => {
  if (room.model.kind === 'beat-the-house') {
    const phase = room.model.game.snapshot().phase;
    return phase === 'roundOver' ? 'settled' : phase === 'playing' || phase === 'dealing' ? 'playing' : 'betting';
  }
  if (room.model.kind === 'blackjack') {
    const phase = room.model.table.snapshot(room.seats.size > 0 ? [] : []).phase;
    return phase === 'settled' ? 'settled' : phase === 'playing' ? 'playing' : 'betting';
  }
  return room.model.game.snapshot().phase === 'bonus' ? 'playing' : 'betting';
};

export const roomStatus = (room: RoomState): RoomSnapshot['status'] => {
  if (room.players.size === 0) {
    return 'waiting';
  }
  const phase = roomPhase(room);
  if (phase === 'settled') {
    return 'complete';
  }
  if (phase === 'playing') {
    return 'in-progress';
  }
  return room.model.kind === 'slots' ? 'open' : 'betting';
};

export const createRoomId = (rooms: ReadonlyMap<string, RoomState>): string => {
  while (true) {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!rooms.has(id)) {
      return id;
    }
  }
};

export const safeBankroll = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

export const createId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export const cleanName = (name?: string): string => (name ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);

export const totalBeatStake = (snapshot: GameSnapshot, handId: HandId): number => betTypes.reduce((sum, betType) => sum + snapshot.bets[handId][betType], 0);

export { handIds };
