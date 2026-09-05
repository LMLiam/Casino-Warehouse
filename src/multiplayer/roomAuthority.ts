import { findGame } from '../game/catalog/findGame';
import type { ProfileId } from '../schemas/casinoSchemas/ProfileId';
import type { ConnectionId } from '../schemas/casinoSchemas/ConnectionId';
import { blackjackSeatIdSchema } from '../schemas/casinoSchemas/blackjackSeatIdSchema';
import { connectionIdSchema } from '../schemas/casinoSchemas/connectionIdSchema';
import type { ClientMessage } from './protocol/ClientMessage';
import type { RoomGameId } from './protocol/RoomGameId';
import type { RoomPlayer } from './protocol/RoomPlayer';
import type { RoomRole } from './protocol/RoomRole';
import type { RoomSeatId } from './protocol/RoomSeatId';
import type { RoomSnapshot } from './protocol/RoomSnapshot';
import type { RoomSummary } from './protocol/RoomSummary';
import { normalizeRoomMaxPlayers } from './roomLimits/normalizeRoomMaxPlayers';
import { RoomAuthorityBeat } from './roomAuthorityBeat';
import type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';
import { cleanName } from './roomAuthorityModel/cleanName';
import { compareRoomListOrder } from './roomAuthorityModel/compareRoomListOrder';
import { createGameModel } from './roomAuthorityModel/createGameModel';
import { createSessionId } from './roomAuthorityModel/createSessionId';
import { createRoomId } from './roomAuthorityModel/createRoomId';
import type { RoomState } from './roomAuthorityModel/RoomState';
import { roomStatus } from './roomAuthorityModel/roomStatus';

export { mainBeatRoomId } from './roomAuthorityModel/mainBeatRoomId';
export type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';

export class RoomAuthority extends RoomAuthorityBeat {
  public handle(rawConnectionId: string, message: ClientMessage): AuthorityResult {
    const connectionId = connectionIdSchema.parse(rawConnectionId);
    if (message.type === 'list-rooms') {
      return { broadcasts: [], settlements: [], roomList: { gameId: message.gameId, rooms: this.listRoomSummaries(message.gameId) } };
    }
    if (message.type === 'create-room') {
      return this.createRoom(connectionId, message);
    }
    if (message.type === 'join-room') {
      return this.joinRoom(connectionId, message);
    }

    const room = this.findRoomByConnection(connectionId);
    if (!room) {
      return this.error('Join a game room first.');
    }

    const member = room.connectionToMember.get(connectionId);
    if (!member) {
      return this.error('Connection is not a room member.');
    }

    switch (message.type) {
      case 'leave-room':
        return this.leaveRoom(room, connectionId);
      case 'resync':
        return { broadcasts: [], settlements: [], direct: this.snapshot(room) };
      case 'assign-seat':
        return this.assignSeat(room, member.profileId, message.seatId);
      case 'place-chip':
        return this.placeBeatChip(room, member.profileId, member.role, message.seatId, message.betType, message.amount);
      case 'place-tip':
        return this.placeBeatTip(room, member.profileId, member.role, message.seatId, message.amount);
      case 'clear-bets':
        return this.beatOnly(room, () => this.clearBeatBets(room, member.profileId, member.role));
      case 'rebet':
        return this.beatOnly(room, () => this.rebetBeat(room, member.profileId, member.role));
      case 'start-round':
        return this.beatOnly(room, () => this.startBeatRound(room, member.profileId, member.role));
      case 'player-action':
        return this.beatOnly(room, () => this.activeBeatSeatAction(room, member.profileId, member.role, message.action));
      case 'next-round':
        return this.beatOnly(room, () => this.nextBeatRound(room, member.profileId, member.role));
      case 'blackjack-deal':
        return this.blackjackOnly(room, () => this.dealBlackjack(room, member.profileId, member.role, message.wager));
      case 'blackjack-action':
        return this.blackjackOnly(room, () => this.blackjackAction(room, member.profileId, member.role, message.action));
      case 'slots-wager':
        return this.slotsOnly(room, () => this.setSlotsWager(room, member.profileId, member.role, message.wager));
      case 'slots-ready':
        return this.slotsOnly(room, () => this.setSlotsReady(room, member.profileId, member.role, message.ready));
      case 'slots-spin':
        return this.slotsOnly(room, () => this.spinSlots(room, member.profileId, member.role));
      case 'slots-pick-bonus':
        return this.slotsOnly(room, () => this.pickSlotsBonus(room, member.profileId, member.role));
      case 'admin-debug':
        if (member.profileId !== room.hostProfileId) {
          return this.error('Only the room host can use room admin controls.');
        }
        return this.resetRoom(room);
      default:
        return this.error('Unsupported room action.');
    }
  }

  public listRooms(gameId?: RoomGameId): readonly RoomSnapshot[] {
    return [...this.rooms.values()].filter((room) => !gameId || room.gameId === gameId).map((room) => this.snapshot(room));
  }

  public listRoomSummaries(gameId: RoomGameId): readonly RoomSummary[] {
    return [...this.rooms.values()]
      .filter((room) => room.gameId === gameId)
      .sort(compareRoomListOrder)
      .map((room) => this.summary(room));
  }

  public disconnect(rawConnectionId: string): AuthorityResult {
    const connectionId = connectionIdSchema.parse(rawConnectionId);
    const room = this.findRoomByConnection(connectionId);
    return room ? this.leaveRoom(room, connectionId) : { broadcasts: [], settlements: [] };
  }

  public removeProfile(profileId: ProfileId, reason: string): AuthorityResult {
    return this.reconcileRooms(reason, profileId);
  }

  public reconcileProfiles(reason: string): AuthorityResult {
    return this.reconcileRooms(reason);
  }

  public clearRooms(reason: string): AuthorityResult {
    return this.clearAllRooms(reason);
  }

  private createRoom(connectionId: ConnectionId, message: Extract<ClientMessage, { type: 'create-room' }>): AuthorityResult {
    this.disconnect(connectionId);
    const catalogGame = findGame(message.gameId);
    const bankroll = this.centralBankroll(message.profileId, message.profileName, message.bankroll);
    const now = Date.now();
    const room: RoomState = {
      roomId: createRoomId(this.rooms),
      roomName: cleanName(message.roomName) || `${catalogGame.title} Room`,
      gameId: message.gameId,
      gameTitle: catalogGame.title,
      hostProfileId: message.profileId,
      maxPlayers: normalizeRoomMaxPlayers(message.gameId, message.maxPlayers),
      allowSpectators: message.allowSpectators ?? true,
      players: new Map(),
      spectators: new Map(),
      connectionToMember: new Map(),
      seats: new Map(),
      model: createGameModel(message.gameId, bankroll),
      createdAt: now,
      updatedAt: now,
      sessionId: createSessionId(),
      revision: 0,
      serverManaged: false,
      settledSessionIds: new Set(),
      lastBeatEvents: [],
      lastBeatBetOwners: {},
      beatHandOwners: {},
    };
    this.rooms.set(room.roomId, room);
    this.addMember(room, connectionId, 'spectator', message.profileId, message.profileName, bankroll);
    this.syncBeatBankroll(room);
    return { broadcasts: [this.snapshot(room)], settlements: [], direct: this.snapshot(room) };
  }

  private joinRoom(connectionId: ConnectionId, message: Extract<ClientMessage, { type: 'join-room' }>): AuthorityResult {
    const room = this.rooms.get(message.roomId);
    if (!room) {
      return this.error('Room was not found.');
    }
    if (room.gameId !== message.gameId) {
      return this.error('Room belongs to a different game.');
    }
    const role = message.role ?? 'player';
    if (role === 'spectator' && !room.allowSpectators) {
      return this.error('Spectators are not allowed in this room.');
    }
    if (role === 'player' && roomStatus(room) === 'settling') {
      return this.error('Join after this room finishes settling.');
    }

    const existingMember = room.players.get(message.profileId) ?? room.spectators.get(message.profileId);
    const existingSeatId = this.profileSeatId(room, message.profileId);
    this.disconnect(connectionId);
    this.removeExistingMember(room, message.profileId);
    this.addMember(room, connectionId, 'spectator', message.profileId, message.profileName, message.bankroll, existingMember?.sessionStartBankroll);
    const requestedSeatId = message.seatId ?? existingSeatId;
    if (role === 'player' && requestedSeatId) {
      const assigned = this.assignSeat(room, message.profileId, requestedSeatId);
      if (assigned.error) {
        return assigned;
      }
    }
    this.syncBeatBankroll(room);
    return this.broadcast(room);
  }

  private leaveRoom(room: RoomState, connectionId: ConnectionId): AuthorityResult {
    const member = room.connectionToMember.get(connectionId);
    if (!member) {
      return { broadcasts: [], settlements: [] };
    }
    room.connectionToMember.delete(connectionId);
    room.players.delete(member.profileId);
    room.spectators.delete(member.profileId);
    for (const [seatId, ownerProfileId] of room.seats.entries()) {
      if (ownerProfileId === member.profileId) {
        room.seats.delete(seatId);
      }
    }
    this.removeProfileGameState(room, member.profileId);
    if (room.model.kind === 'beat-the-house') {
      this.clearBeatReadyVotes(room);
    }
    if (room.players.size === 0 && room.spectators.size === 0 && !room.serverManaged) {
      this.clearBeatReadiness(room);
      this.rooms.delete(room.roomId);
      return { broadcasts: [], settlements: [] };
    }
    if (room.players.size === 0 && room.spectators.size === 0 && room.serverManaged) {
      const resetResult = this.resetServerManagedRoom(room);
      if (resetResult?.error) {
        return resetResult;
      }
      this.syncBeatBankroll(room);
      return this.broadcast(room, resetResult?.settlements ?? []);
    }
    this.syncBeatBankroll(room);
    return this.broadcast(room);
  }

  private assignSeat(room: RoomState, profileId: ProfileId, seatId: RoomSeatId): AuthorityResult {
    if (!this.seatIds(room).includes(seatId)) {
      return this.error('Seat does not belong to this game room.');
    }
    if ([...room.seats.entries()].some(([ownedSeat, owner]) => owner === profileId && ownedSeat !== seatId)) {
      return this.error('Release your current seat before claiming another one.');
    }
    const owner = room.seats.get(seatId);
    if (owner && owner !== profileId) {
      return this.error('Seat is already occupied.');
    }
    if (!room.players.has(profileId) && room.players.size >= room.maxPlayers) {
      return this.error('Room has no open player seats.');
    }
    const member = room.players.get(profileId) ?? room.spectators.get(profileId);
    if (!member) {
      return this.error('Join this room before claiming a seat.');
    }
    const seatedPlayer: RoomPlayer = { ...member, role: 'player' };
    room.players.set(profileId, seatedPlayer);
    room.spectators.delete(profileId);
    room.connectionToMember.set(seatedPlayer.connectionId, { profileId, role: 'player' });
    room.seats.set(seatId, profileId);
    if (room.model.kind === 'beat-the-house') {
      this.clearBeatReadyVotes(room);
    }
    this.syncBeatBankroll(room);
    return this.broadcast(room);
  }

  private dealBlackjack(room: RoomState, profileId: ProfileId, role: RoomRole, wager: number): AuthorityResult {
    if (room.model.kind !== 'blackjack') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot deal Blackjack.');
    }
    const seatId = this.profileSeatId(room, profileId);
    if (!seatId) {
      return this.error('Claim a Blackjack seat before dealing.');
    }
    const blackjackSeatId = blackjackSeatIdSchema.safeParse(seatId);
    if (!blackjackSeatId.success) {
      return this.error('Claim a Blackjack seat before dealing.');
    }
    const player = room.players.get(profileId);
    if (!player || wager <= 0 || player.bankroll < wager) {
      return this.error('Insufficient profile bankroll for that wager.');
    }
    const result = room.model.table.deal(blackjackSeatId.data, wager, this.blackjackOccupants(room));
    if (result.error) {
      return this.error(result.error);
    }
    this.setPlayerBankroll(room, profileId, player.bankroll - result.debit);
    if (result.settlements.length > 0) {
      room.model.settledSessionIds.add(room.sessionId);
    }
    return this.broadcast(room, this.applyBlackjackSettlements(room, result));
  }

  private blackjackAction(
    room: RoomState,
    profileId: ProfileId,
    role: RoomRole,
    action: Extract<ClientMessage, { type: 'blackjack-action' }>['action'],
  ): AuthorityResult {
    if (room.model.kind !== 'blackjack') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot act.');
    }
    const seatId = this.profileSeatId(room, profileId);
    if (!seatId) {
      return this.error('Claim a Blackjack seat before acting.');
    }
    const blackjackSeatId = blackjackSeatIdSchema.safeParse(seatId);
    if (!blackjackSeatId.success) {
      return this.error('Claim a Blackjack seat before acting.');
    }
    const player = room.players.get(profileId);
    if (!player) {
      return this.error('Join a game room first.');
    }
    if (action === 'new-hand') {
      room.sessionId = createSessionId();
      room.model.settledSessionIds.clear();
    }
    const seatBefore = room.model.table.snapshot(this.blackjackOccupants(room)).seats.find((seat) => seat.seatId === blackjackSeatId.data);
    const requiredDebit =
      action === 'double' || action === 'split' ? (seatBefore?.wager ?? 0) : action === 'insurance' ? Math.floor((seatBefore?.wager ?? 0) / 2) : 0;
    if (requiredDebit > 0 && player.bankroll < requiredDebit) {
      return this.error('Insufficient profile bankroll for that Blackjack action.');
    }
    const result = room.model.table.act(action, blackjackSeatId.data, this.blackjackOccupants(room));
    if (result.error) {
      return this.error(result.error);
    }
    if (result.debit > 0) {
      if (player.bankroll < result.debit) {
        return this.error('Insufficient profile bankroll for that Blackjack action.');
      }
      this.setPlayerBankroll(room, profileId, player.bankroll - result.debit);
    }
    if (result.settlements.length > 0) {
      room.model.settledSessionIds.add(room.sessionId);
    }
    return this.broadcast(room, this.applyBlackjackSettlements(room, result));
  }
}
