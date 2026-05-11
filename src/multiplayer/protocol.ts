import type { BlackjackSnapshot } from '../game/blackjack';
import type { BlackjackTableSnapshot } from '../game/blackjackTable';
import { type CasinoGameId } from '../game/catalog';
import type { SlotSnapshot } from '../game/slots';
import type { GameSnapshot, HandId } from '../game/types';
import { clientMessageSchema, zodErrorSummary, type ClientMessageFromSchema } from '../schemas/casinoSchemas';
import type { CasinoSaveState } from '../state/profiles';
import type { CasinoSessionState } from '../state/session';
import type { ServerDatabaseChoice } from '../state/serverDataStore';

export const protocolVersion = 1;

export type RoomGameId = CasinoGameId;
export type RoomRole = 'player' | 'spectator';
export type RoomStatus = 'waiting' | 'betting' | 'open' | 'in-progress' | 'settling' | 'complete' | 'closed';
export type RoomGameSnapshot = GameSnapshot | BlackjackSnapshot | BlackjackTableSnapshot | SlotSnapshot;
export type RoomSeatId = HandId | `seat-${number}`;

export type ClientMessage = ClientMessageFromSchema;

export type ServerMessage =
  | { readonly version: 1; readonly type: 'server-hello'; readonly serverInstanceId: string }
  | { readonly version: 1; readonly type: 'reload-required'; readonly reason: 'server-restarted'; readonly message: string }
  | {
      readonly version: 1;
      readonly type: 'data-state';
      readonly database: ServerDatabaseChoice;
      readonly profileState: CasinoSaveState;
      readonly session?: CasinoSessionState;
    }
  | { readonly version: 1; readonly type: 'heartbeat'; readonly sentAt: number }
  | { readonly version: 1; readonly type: 'room-created'; readonly room: RoomSnapshot; readonly invitePath: string }
  | { readonly version: 1; readonly type: 'room-list'; readonly gameId: RoomGameId; readonly rooms: readonly RoomSummary[] }
  | { readonly version: 1; readonly type: 'room-state'; readonly room: RoomSnapshot }
  | { readonly version: 1; readonly type: 'settlement'; readonly roomId: string; readonly sessionId: string; readonly settlements: readonly RoomSettlement[] }
  | { readonly version: 1; readonly type: 'error'; readonly code: string; readonly message: string };

export interface RoomPlayer {
  readonly connectionId: string;
  readonly profileId: string;
  readonly profileName: string;
  readonly bankroll: number;
  readonly sessionStartBankroll: number;
  readonly role: RoomRole;
}

export interface RoomSeat {
  readonly seatId: RoomSeatId;
  readonly profileId?: string;
}

export interface RoomSummary {
  readonly roomId: string;
  readonly roomName: string;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly hostProfileId: string;
  readonly maxPlayers: number;
  readonly currentPlayers: number;
  readonly spectators: number;
  readonly status: RoomStatus;
  readonly createdAt: number;
  readonly updatedAt: number;
}

export interface RoomSettlement {
  readonly id: string;
  readonly profileId: string;
  readonly seatId: RoomSeatId;
  readonly wagered: number;
  readonly returned: number;
  readonly profit: number;
}

export interface RoomSnapshot {
  readonly roomId: string;
  readonly roomName: string;
  readonly hostProfileId: string;
  readonly gameId: RoomGameId;
  readonly gameTitle: string;
  readonly status: RoomStatus;
  readonly phase: 'lobby' | 'betting' | 'playing' | 'settled';
  readonly sessionId: string;
  readonly revision: number;
  readonly maxPlayers: number;
  readonly allowSpectators: boolean;
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly players: readonly RoomPlayer[];
  readonly spectators: readonly RoomPlayer[];
  readonly seats: readonly RoomSeat[];
  readonly game: RoomGameSnapshot;
  readonly slots?: {
    readonly wager: number;
    readonly wagersByProfileId: Readonly<Record<string, number>>;
    readonly readyProfileIds: readonly string[];
    readonly lastSpinByProfileId?: string;
    readonly returnedByProfileId?: Readonly<Record<string, number>>;
  };
}

export interface ParsedMessage {
  readonly ok: boolean;
  readonly message?: ClientMessage;
  readonly error?: string;
}

export const parseClientMessage = (value: unknown): ParsedMessage => {
  if (!isRecord(value) || value.version !== protocolVersion || typeof value.type !== 'string') {
    return { ok: false, error: 'Message version or type is invalid.' };
  }
  if (value.type === 'join-room' && typeof value.roomId !== 'string') {
    return { ok: false, error: 'Room id is required.' };
  }

  const parsed = clientMessageSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: zodErrorSummary(parsed.error) };
  }
  if (parsed.data.type === 'create-room') {
    return {
      ok: true,
      message: {
        ...parsed.data,
        roomName: parsed.data.roomName,
        maxPlayers: parsed.data.maxPlayers,
        allowSpectators: parsed.data.allowSpectators,
      },
    };
  }
  return { ok: true, message: parsed.data };
};

export const encodeMessage = (message: ClientMessage): string => JSON.stringify(message);

export const decodeServerMessage = (data: string): ServerMessage | undefined => {
  try {
    const value: unknown = JSON.parse(data);
    return isServerMessage(value) ? value : undefined;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const isServerMessage = (value: unknown): value is ServerMessage => {
  if (!isRecord(value) || value.version !== protocolVersion || typeof value.type !== 'string') {
    return false;
  }

  switch (value.type) {
    case 'server-hello':
      return typeof value.serverInstanceId === 'string';
    case 'reload-required':
      return value.reason === 'server-restarted' && typeof value.message === 'string';
    case 'data-state':
      return isServerDatabaseChoice(value.database) && isCasinoSaveState(value.profileState) && (value.session === undefined || isRecord(value.session));
    case 'heartbeat':
      return isFiniteNumber(value.sentAt);
    case 'room-created':
      return isRoomSnapshot(value.room) && typeof value.invitePath === 'string';
    case 'room-list':
      return isRoomGameId(value.gameId) && Array.isArray(value.rooms) && value.rooms.every(isRoomSummary);
    case 'room-state':
      return isRoomSnapshot(value.room);
    case 'settlement':
      return (
        typeof value.roomId === 'string' && typeof value.sessionId === 'string' && Array.isArray(value.settlements) && value.settlements.every(isRoomSettlement)
      );
    case 'error':
      return typeof value.code === 'string' && typeof value.message === 'string';
    default:
      return false;
  }
};

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const isOneOf = <Value extends string>(value: unknown, allowed: readonly Value[]): value is Value =>
  typeof value === 'string' && allowed.some((allowedValue) => allowedValue === value);

const isServerDatabaseChoice = (value: unknown): value is ServerDatabaseChoice => isOneOf(value, ['memory', 'sqlite']);

const isRoomGameId = (value: unknown): value is RoomGameId => isOneOf(value, ['beat-the-house', 'blackjack', 'slots:thai-princess']);

const isRoomRole = (value: unknown): value is RoomRole => isOneOf(value, ['player', 'spectator']);

const isRoomStatus = (value: unknown): value is RoomStatus => isOneOf(value, ['waiting', 'betting', 'open', 'in-progress', 'settling', 'complete', 'closed']);

const isRoomPhase = (value: unknown): value is RoomSnapshot['phase'] => isOneOf(value, ['lobby', 'betting', 'playing', 'settled']);

const isRoomSeatId = (value: unknown): value is RoomSeatId =>
  isOneOf(value, ['left', 'centre', 'right']) || (typeof value === 'string' && /^seat-[1-9]\d*$/.test(value));

const isCasinoSaveState = (value: unknown): value is CasinoSaveState => isRecord(value) && value.version === protocolVersion && Array.isArray(value.profiles);

const isRoomGameSnapshot = (value: unknown): value is RoomGameSnapshot => isRecord(value);

const isRoomPlayer = (value: unknown): value is RoomPlayer =>
  isRecord(value) &&
  typeof value.connectionId === 'string' &&
  typeof value.profileId === 'string' &&
  typeof value.profileName === 'string' &&
  isFiniteNumber(value.bankroll) &&
  isFiniteNumber(value.sessionStartBankroll) &&
  isRoomRole(value.role);

const isRoomSeat = (value: unknown): value is RoomSeat =>
  isRecord(value) && isRoomSeatId(value.seatId) && (value.profileId === undefined || typeof value.profileId === 'string');

const isRoomSummary = (value: unknown): value is RoomSummary =>
  isRecord(value) &&
  typeof value.roomId === 'string' &&
  typeof value.roomName === 'string' &&
  isRoomGameId(value.gameId) &&
  typeof value.gameTitle === 'string' &&
  typeof value.hostProfileId === 'string' &&
  isFiniteNumber(value.maxPlayers) &&
  isFiniteNumber(value.currentPlayers) &&
  isFiniteNumber(value.spectators) &&
  isRoomStatus(value.status) &&
  isFiniteNumber(value.createdAt) &&
  isFiniteNumber(value.updatedAt);

const isRoomSnapshot = (value: unknown): value is RoomSnapshot =>
  isRecord(value) &&
  typeof value.roomId === 'string' &&
  typeof value.roomName === 'string' &&
  typeof value.hostProfileId === 'string' &&
  isRoomGameId(value.gameId) &&
  typeof value.gameTitle === 'string' &&
  isRoomStatus(value.status) &&
  isRoomPhase(value.phase) &&
  typeof value.sessionId === 'string' &&
  isFiniteNumber(value.revision) &&
  isFiniteNumber(value.maxPlayers) &&
  typeof value.allowSpectators === 'boolean' &&
  isFiniteNumber(value.createdAt) &&
  isFiniteNumber(value.updatedAt) &&
  Array.isArray(value.players) &&
  value.players.every(isRoomPlayer) &&
  Array.isArray(value.spectators) &&
  value.spectators.every(isRoomPlayer) &&
  Array.isArray(value.seats) &&
  value.seats.every(isRoomSeat) &&
  isRoomGameSnapshot(value.game) &&
  (value.slots === undefined || isSlotsRoomState(value.slots));

const isSlotsRoomState = (value: unknown): value is NonNullable<RoomSnapshot['slots']> =>
  isRecord(value) &&
  isFiniteNumber(value.wager) &&
  isRecord(value.wagersByProfileId) &&
  Array.isArray(value.readyProfileIds) &&
  value.readyProfileIds.every((profileId) => typeof profileId === 'string') &&
  (value.lastSpinByProfileId === undefined || typeof value.lastSpinByProfileId === 'string') &&
  (value.returnedByProfileId === undefined || isRecord(value.returnedByProfileId));

const isRoomSettlement = (value: unknown): value is RoomSettlement =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.profileId === 'string' &&
  isRoomSeatId(value.seatId) &&
  isFiniteNumber(value.wagered) &&
  isFiniteNumber(value.returned) &&
  isFiniteNumber(value.profit);
