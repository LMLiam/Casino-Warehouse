import { findGame } from '../game/catalog/findGame';
import type { BetType } from '../game/types/BetType';
import { betTypes } from '../game/types/betTypes';
import type { GameSnapshot } from '../game/types/GameSnapshot';
import type { HandId } from '../game/types/HandId';
import { handIds } from '../game/types/handIds';
import { canRoomFlowTransition } from '../state/roomMachines/canRoomFlowTransition';
import type { ProfileId } from '../schemas/casinoSchemas/ProfileId';
import type { ConnectionId } from '../schemas/casinoSchemas/ConnectionId';
import { blackjackSeatIdSchema } from '../schemas/casinoSchemas/blackjackSeatIdSchema';
import { connectionIdSchema } from '../schemas/casinoSchemas/connectionIdSchema';
import { handIdSchema } from '../schemas/casinoSchemas/handIdSchema';
import type { ClientMessage } from './protocol/ClientMessage';
import type { RoomGameId } from './protocol/RoomGameId';
import type { RoomPlayer } from './protocol/RoomPlayer';
import type { RoomRole } from './protocol/RoomRole';
import type { RoomSeatId } from './protocol/RoomSeatId';
import type { RoomSettlement } from './protocol/RoomSettlement';
import type { RoomSnapshot } from './protocol/RoomSnapshot';
import type { RoomSummary } from './protocol/RoomSummary';
import { normalizeRoomMaxPlayers } from './roomLimits/normalizeRoomMaxPlayers';
import { RoomAuthoritySlots } from './roomAuthoritySlots';
import type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';
import { cleanName } from './roomAuthorityModel/cleanName';
import { compareRoomListOrder } from './roomAuthorityModel/compareRoomListOrder';
import { createGameModel } from './roomAuthorityModel/createGameModel';
import { createSessionId } from './roomAuthorityModel/createSessionId';
import { createRoomId } from './roomAuthorityModel/createRoomId';
import { roomPhase } from './roomAuthorityModel/roomPhase';
import type { RoomState } from './roomAuthorityModel/RoomState';
import { roomStatus } from './roomAuthorityModel/roomStatus';
import { totalBeatStake } from './roomAuthorityModel/totalBeatStake';

export { mainBeatRoomId } from './roomAuthorityModel/mainBeatRoomId';
export type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';

export class RoomAuthority extends RoomAuthoritySlots {
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
      this.resetServerManagedRoom(room);
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

  private placeBeatChip(room: RoomState, profileId: ProfileId, role: RoomRole, seatId: HandId, betType: BetType, amount: number): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Beat the House wagers are not valid in this room.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot wager.');
    }
    if (room.seats.get(seatId) !== profileId) {
      return this.error('You can only bet on your own seat.');
    }
    if (!betTypes.includes(betType) || amount <= 0) {
      return this.error('Bet is invalid.');
    }
    const player = room.players.get(profileId);
    if (!player || player.bankroll < amount) {
      return this.error('Insufficient profile bankroll for that wager.');
    }
    this.syncBeatBankroll(room);
    const before = room.model.game.snapshot();
    const beforeAmount = before.bets[seatId][betType];
    if (betType !== 'main' && before.bets[seatId].main <= 0) {
      return this.error('Side bets need a main bet on the same hand.');
    }
    const result = this.ownerAction(room, () => room.model.kind === 'beat-the-house' && room.model.game.placeBet(seatId, betType, amount));
    const debited = room.model.game.snapshot().bets[seatId][betType] - beforeAmount;
    if (debited > 0) {
      this.clearBeatReadyProfile(room, profileId);
      this.setPlayerBankroll(room, profileId, player.bankroll - debited);
      return this.broadcast(room, result.settlements);
    }
    return result;
  }

  private placeBeatTip(room: RoomState, profileId: ProfileId, role: RoomRole, seatId: HandId, amount: number): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Beat the House tips are not valid in this room.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot tip the dealer.');
    }
    if (room.seats.get(seatId) !== profileId) {
      return this.error('You can only tip from your own seat.');
    }
    if (amount <= 0) {
      return this.error('Dealer tip is invalid.');
    }
    const player = room.players.get(profileId);
    if (!player || player.bankroll < amount) {
      return this.error('Insufficient profile bankroll for that dealer tip.');
    }
    this.syncBeatBankroll(room);
    const before = room.model.game.snapshot();
    const beforeAmount = before.dealerTips[seatId];
    const result = this.ownerAction(room, () => room.model.kind === 'beat-the-house' && room.model.game.placeDealerTip(seatId, amount));
    const debited = room.model.game.snapshot().dealerTips[seatId] - beforeAmount;
    if (debited > 0) {
      this.clearBeatReadyProfile(room, profileId);
      this.setPlayerBankroll(room, profileId, player.bankroll - debited);
      return this.broadcast(room, result.settlements);
    }
    return result;
  }

  private clearBeatBets(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot clear bets.');
    }
    const seatId = this.profileBeatSeatId(room, profileId);
    if (!seatId) {
      return this.error('Claim a Beat the House seat before clearing bets.');
    }
    this.syncBeatBankroll(room);
    const before = room.model.game.snapshot();
    if (before.phase !== 'betting') {
      return this.error('Bets can only be cleared before the round starts.');
    }
    const refund = this.totalBeatTableCredits(before, seatId);
    if (refund <= 0) {
      return this.error('You do not have bets to clear.');
    }
    const result = this.ownerAction(room, () => room.model.kind === 'beat-the-house' && room.model.game.clearHandBets(seatId));
    const player = room.players.get(profileId);
    if (player) {
      this.setPlayerBankroll(room, profileId, player.bankroll + refund);
    }
    this.clearBeatReadyProfile(room, profileId);
    this.syncBeatBankroll(room);
    return this.broadcast(room, result.settlements);
  }

  private rebetBeat(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot rebet.');
    }
    const seatId = this.profileBeatSeatId(room, profileId);
    if (!seatId) {
      return this.error('Claim a Beat the House seat before rebetting.');
    }
    this.syncBeatBankroll(room);
    const before = room.model.game.snapshot();
    if (before.phase !== 'betting') {
      return this.error('Rebet is only available before the round starts.');
    }
    if (this.totalBeatTableCredits(before, seatId) > 0) {
      return this.error('Clear your current bets before rebetting.');
    }
    const wager = before.rebetAmounts[seatId];
    if (wager <= 0) {
      return this.error('No previous bet saved for your seat.');
    }
    if (room.lastBeatBetOwners[seatId] !== profileId) {
      return this.error('No previous bet saved for your seat.');
    }
    const player = room.players.get(profileId);
    if (!player || player.bankroll < wager) {
      return this.error(`Need £${wager} to rebet.`);
    }
    const result = this.ownerAction(room, () => room.model.kind === 'beat-the-house' && room.model.game.rebetHand(seatId));
    const after = room.model.game.snapshot();
    const debited = totalBeatStake(after, seatId) - totalBeatStake(before, seatId);
    if (debited > 0) {
      this.setPlayerBankroll(room, profileId, player.bankroll - debited);
    }
    this.clearBeatReadyProfile(room, profileId);
    this.syncBeatBankroll(room);
    return this.broadcast(room, result.settlements);
  }

  private profileBeatSeatId(room: RoomState, profileId: ProfileId): HandId | undefined {
    const seatId = this.profileSeatId(room, profileId);
    const parsed = handIdSchema.safeParse(seatId);
    return parsed.success ? parsed.data : undefined;
  }

  private startBeatRound(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot start rounds.');
    }
    if (room.model.game.snapshot().phase !== 'betting') {
      return this.error('Round is already in progress.');
    }
    if (!canRoomFlowTransition(roomPhase(room), { type: 'START_PLAY' })) {
      return this.error('Room phase does not allow starting play.');
    }
    room.model.readyPhase = 'betting';
    room.model.readyProfileIds.add(profileId);
    if (!this.everyBeatPlayerReady(room)) {
      return this.broadcast(room);
    }
    this.syncBeatBankroll(room);
    return this.dealReadyBeatRound(room);
  }

  private dealReadyBeatRound(room: RoomState): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Wrong room game.');
    }
    const model = room.model;
    const before = model.game.snapshot();
    const after = room.seats.size > 0 && room.players.size > 0 ? model.game.deal() : model.game.snapshot();
    room.lastBeatEvents = after.lastEvents;
    let settlements: readonly RoomSettlement[] = [];
    if (before.phase === 'betting' && after.phase !== 'betting') {
      this.recordBeatBetOwners(room, before);
      this.recordBeatDealerTips(room, before);
    }
    if (after.phase === 'roundOver' && before.phase !== 'roundOver') {
      settlements = this.settleBeat(room, after);
    }
    this.clearBeatReadyVotes(room);
    this.afterBeatSnapshotChange(room, before, after);
    return this.broadcast(room, settlements);
  }

  private recordBeatBetOwners(room: RoomState, snapshot: GameSnapshot): void {
    const owners: Partial<Record<HandId, ProfileId>> = {};
    for (const handId of handIds) {
      const ownerProfileId = room.seats.get(handId);
      if (ownerProfileId && totalBeatStake(snapshot, handId) > 0) {
        owners[handId] = ownerProfileId;
      }
    }
    room.lastBeatBetOwners = owners;
  }

  private recordBeatDealerTips(room: RoomState, snapshot: GameSnapshot): void {
    for (const handId of handIds) {
      const tip = snapshot.dealerTips[handId];
      const profileId = room.seats.get(handId);
      if (!profileId || tip <= 0) {
        continue;
      }
      this.recordReservedDebitTransaction(room, profileId, {
        amount: tip,
        description: 'Dealer tip taken.',
        metadata: { handId, dealerTip: tip },
      });
    }
  }

  private recordReservedDebitTransaction(
    room: RoomState,
    profileId: ProfileId,
    transaction: {
      readonly amount: number;
      readonly description: string;
      readonly metadata: Readonly<Record<string, string | number | boolean>>;
    },
  ): void {
    const profile = this.dataStore.snapshot().profileState.profiles.find((candidate) => candidate.id === profileId);
    if (!profile) {
      return;
    }
    const player = room.players.get(profileId);
    this.dataStore.setProfileBankroll(profileId, profile.bankroll + transaction.amount);
    const updated = this.dataStore.recordTransaction(profileId, {
      gameId: room.gameId,
      roomId: room.roomId,
      sessionId: room.sessionId,
      type: 'dealer_tip',
      amount: -transaction.amount,
      description: transaction.description,
      metadata: transaction.metadata,
    });
    if (player && updated) {
      room.players.set(profileId, { ...player, bankroll: updated.bankroll });
    }
  }

  private totalBeatTableCredits(snapshot: GameSnapshot, handId: HandId): number {
    return totalBeatStake(snapshot, handId) + snapshot.dealerTips[handId];
  }

  private activeBeatSeatAction(room: RoomState, profileId: ProfileId, role: RoomRole, action: 'hit' | 'stick'): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot act.');
    }
    const snapshot = room.model.game.snapshot();
    if (!snapshot.activeHand || room.seats.get(snapshot.activeHand) !== profileId) {
      return this.error('It is not your turn.');
    }
    this.syncBeatBankroll(room);
    return this.ownerAction(room, () =>
      room.model.kind === 'beat-the-house' ? (action === 'hit' ? room.model.game.hit() : room.model.game.stick()) : snapshot,
    );
  }

  private nextBeatRound(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot advance rounds.');
    }
    if (!room.players.has(profileId)) {
      return this.error('Only room players can advance rounds.');
    }
    if (!canRoomFlowTransition(roomPhase(room), { type: 'NEXT_ROUND' })) {
      return this.error('Room phase does not allow advancing rounds.');
    }
    room.model.readyPhase = 'roundOver';
    room.model.readyProfileIds.add(profileId);
    if (!this.everyBeatPlayerReady(room)) {
      return this.broadcast(room);
    }
    return this.advanceReadyBeatNextRound(room);
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
