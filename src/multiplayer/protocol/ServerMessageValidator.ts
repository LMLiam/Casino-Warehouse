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

export class ServerMessageValidator {
  public static isServerMessage(value: unknown): value is ServerMessage {
    if (!ServerMessageValidator.isRecord(value) || value.version !== protocolVersion || typeof value.type !== 'string') {
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
        return (
          ServerMessageValidator.isServerDatabaseChoice(value.database) &&
          ServerMessageValidator.isCasinoSaveState(value.profileState) &&
          (value.session === undefined || ServerMessageValidator.isRecord(value.session))
        );
      case 'heartbeat':
        return ServerMessageValidator.isFiniteNumber(value.sentAt);
      case 'room-created':
        return ServerMessageValidator.isRoomSnapshot(value.room) && typeof value.invitePath === 'string';
      case 'room-closed':
        return typeof value.roomId === 'string' && ServerMessageValidator.isRoomGameId(value.gameId) && typeof value.reason === 'string';
      case 'room-list':
        return ServerMessageValidator.isRoomGameId(value.gameId) && Array.isArray(value.rooms) && value.rooms.every(ServerMessageValidator.isRoomSummary);
      case 'room-state':
        return ServerMessageValidator.isRoomSnapshot(value.room);
      case 'settlement':
        return (
          typeof value.roomId === 'string' &&
          typeof value.sessionId === 'string' &&
          Array.isArray(value.settlements) &&
          value.settlements.every(ServerMessageValidator.isRoomSettlement)
        );
      case 'error':
        return typeof value.code === 'string' && typeof value.message === 'string';
      default:
        return false;
    }
  }

  private static isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private static isFiniteNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }

  private static isOneOf<Value extends string>(value: unknown, allowed: readonly Value[]): value is Value {
    return typeof value === 'string' && allowed.some((allowedValue) => allowedValue === value);
  }

  private static isServerDatabaseChoice(value: unknown): value is ServerDatabaseChoice {
    return ServerMessageValidator.isOneOf(value, ['memory', 'sqlite']);
  }

  private static isRoomGameId(value: unknown): value is RoomGameId {
    return ServerMessageValidator.isOneOf(value, ['beat-the-house', 'blackjack', 'slots:thai-princess']);
  }

  private static isRoomRole(value: unknown): value is RoomRole {
    return ServerMessageValidator.isOneOf(value, ['player', 'spectator']);
  }

  private static isRoomStatus(value: unknown): value is RoomStatus {
    return ServerMessageValidator.isOneOf(value, ['waiting', 'betting', 'open', 'in-progress', 'settling', 'complete', 'closed']);
  }

  private static isRoomPhase(value: unknown): value is RoomSnapshot['phase'] {
    return ServerMessageValidator.isOneOf(value, ['lobby', 'betting', 'playing', 'settled']);
  }

  private static isRoomSeatId(value: unknown): value is RoomSeatId {
    return ServerMessageValidator.isOneOf(value, ['left', 'centre', 'right']) || (typeof value === 'string' && /^seat-[1-9]\d*$/.test(value));
  }

  private static isCasinoSaveState(value: unknown): value is CasinoSaveState {
    return ServerMessageValidator.isRecord(value) && value.version === protocolVersion && Array.isArray(value.profiles);
  }

  private static isRoomGameSnapshot(value: unknown): value is RoomGameSnapshot {
    return ServerMessageValidator.isRecord(value);
  }

  private static isRoomPlayer(value: unknown): value is RoomPlayer {
    return (
      ServerMessageValidator.isRecord(value) &&
      typeof value.connectionId === 'string' &&
      typeof value.profileId === 'string' &&
      typeof value.profileName === 'string' &&
      ServerMessageValidator.isFiniteNumber(value.bankroll) &&
      ServerMessageValidator.isFiniteNumber(value.sessionStartBankroll) &&
      ServerMessageValidator.isRoomRole(value.role)
    );
  }

  private static isRoomSeat(value: unknown): value is RoomSeat {
    return (
      ServerMessageValidator.isRecord(value) &&
      ServerMessageValidator.isRoomSeatId(value.seatId) &&
      (value.profileId === undefined || typeof value.profileId === 'string')
    );
  }

  private static isRoomSummary(value: unknown): value is RoomSummary {
    return (
      ServerMessageValidator.isRecord(value) &&
      typeof value.roomId === 'string' &&
      typeof value.roomName === 'string' &&
      ServerMessageValidator.isRoomGameId(value.gameId) &&
      typeof value.gameTitle === 'string' &&
      typeof value.hostProfileId === 'string' &&
      ServerMessageValidator.isFiniteNumber(value.maxPlayers) &&
      ServerMessageValidator.isFiniteNumber(value.currentPlayers) &&
      ServerMessageValidator.isFiniteNumber(value.spectators) &&
      ServerMessageValidator.isRoomStatus(value.status) &&
      ServerMessageValidator.isFiniteNumber(value.createdAt) &&
      ServerMessageValidator.isFiniteNumber(value.updatedAt)
    );
  }

  private static isRoomSnapshot(value: unknown): value is RoomSnapshot {
    return (
      ServerMessageValidator.isRecord(value) &&
      typeof value.roomId === 'string' &&
      typeof value.roomName === 'string' &&
      typeof value.hostProfileId === 'string' &&
      ServerMessageValidator.isRoomGameId(value.gameId) &&
      typeof value.gameTitle === 'string' &&
      ServerMessageValidator.isRoomStatus(value.status) &&
      ServerMessageValidator.isRoomPhase(value.phase) &&
      typeof value.sessionId === 'string' &&
      ServerMessageValidator.isFiniteNumber(value.revision) &&
      ServerMessageValidator.isFiniteNumber(value.maxPlayers) &&
      typeof value.allowSpectators === 'boolean' &&
      ServerMessageValidator.isFiniteNumber(value.createdAt) &&
      ServerMessageValidator.isFiniteNumber(value.updatedAt) &&
      Array.isArray(value.players) &&
      value.players.every(ServerMessageValidator.isRoomPlayer) &&
      Array.isArray(value.spectators) &&
      value.spectators.every(ServerMessageValidator.isRoomPlayer) &&
      Array.isArray(value.seats) &&
      value.seats.every(ServerMessageValidator.isRoomSeat) &&
      ServerMessageValidator.isRoomGameSnapshot(value.game) &&
      (value.slots === undefined || ServerMessageValidator.isSlotsRoomState(value.slots))
    );
  }

  private static isSlotsRoomState(value: unknown): value is NonNullable<RoomSnapshot['slots']> {
    return (
      ServerMessageValidator.isRecord(value) &&
      ServerMessageValidator.isFiniteNumber(value.wager) &&
      ServerMessageValidator.isRecord(value.wagersByProfileId) &&
      Array.isArray(value.readyProfileIds) &&
      value.readyProfileIds.every((profileId) => typeof profileId === 'string') &&
      (value.lastSpinByProfileId === undefined || typeof value.lastSpinByProfileId === 'string') &&
      (value.returnedByProfileId === undefined || ServerMessageValidator.isRecord(value.returnedByProfileId))
    );
  }

  private static isRoomSettlement(value: unknown): value is RoomSettlement {
    return (
      ServerMessageValidator.isRecord(value) &&
      typeof value.id === 'string' &&
      typeof value.profileId === 'string' &&
      ServerMessageValidator.isRoomSeatId(value.seatId) &&
      ServerMessageValidator.isFiniteNumber(value.wagered) &&
      ServerMessageValidator.isFiniteNumber(value.returned) &&
      ServerMessageValidator.isFiniteNumber(value.profit)
    );
  }
}
