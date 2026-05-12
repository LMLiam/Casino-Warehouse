import type { CasinoSaveState } from '../../state/profiles/CasinoSaveState';
import type { ServerDatabaseChoice } from '../../state/serverDataStore/ServerDatabaseChoice';
import { protocolVersion } from './protocolVersion';
import type { RoomGameId } from './RoomGameId';
import type { RoomGameSnapshot } from './RoomGameSnapshot';
import type { RoomPlayer } from './RoomPlayer';
import type { RoomRole } from './RoomRole';
import type { RoomSeat } from './RoomSeat';
import type { RoomSeatId } from './RoomSeatId';
import type { RoomSettlement } from './RoomSettlement';
import type { RoomSnapshot } from './RoomSnapshot';
import type { RoomStatus } from './RoomStatus';
import type { RoomSummary } from './RoomSummary';
import type { ServerMessage } from './ServerMessage';

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
    case 'profile-credentials':
      return typeof value.profileId === 'string' && typeof value.profileToken === 'string';
    case 'profile-access':
      return Array.isArray(value.ownedProfileIds) && value.ownedProfileIds.every((profileId) => typeof profileId === 'string');
    case 'admin-access':
      return typeof value.authorized === 'boolean';
    case 'data-state':
      return isServerDatabaseChoice(value.database) && isCasinoSaveState(value.profileState) && (value.session === undefined || isRecord(value.session));
    case 'heartbeat':
      return isFiniteNumber(value.sentAt);
    case 'room-created':
      return isRoomSnapshot(value.room) && typeof value.invitePath === 'string';
    case 'room-closed':
      return typeof value.roomId === 'string' && isRoomGameId(value.gameId) && typeof value.reason === 'string';
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
