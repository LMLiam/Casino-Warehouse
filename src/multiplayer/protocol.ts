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
    return isRecord(value) && value.version === protocolVersion && typeof value.type === 'string' ? (value as unknown as ServerMessage) : undefined;
  } catch {
    return undefined;
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
