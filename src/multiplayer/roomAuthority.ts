import type { BlackjackSnapshot } from '../game/blackjack';
import { BlackjackTable, type BlackjackTableActionResult, type BlackjackTableOccupant, type BlackjackTableSnapshot } from '../game/blackjackTable';
import { findGame, findSlotTheme } from '../game/catalog';
import { BeatTheHouseGame } from '../game/engine';
import { SlotsGame, type SlotSnapshot } from '../game/slots';
import { betTypes, handIds, type BetType, type GameSnapshot, type HandId } from '../game/types';
import { canRoomFlowTransition, canSharedSlotsTransition, deriveSharedSlotsPhase } from '../state/roomMachines';
import { createMemoryServerDataStore, type ServerDataStore } from '../state/serverDataStore';
import type { ClientMessage, RoomGameId, RoomPlayer, RoomRole, RoomSeat, RoomSeatId, RoomSettlement, RoomSnapshot, RoomSummary } from './protocol';
import { normalizeRoomMaxPlayers } from './roomLimits';

export const mainBeatRoomId = 'BEATMAIN';

export interface AuthorityResult {
  readonly broadcasts: readonly RoomSnapshot[];
  readonly settlements: readonly RoomSettlement[];
  readonly direct?: RoomSnapshot;
  readonly roomList?: { readonly gameId: RoomGameId; readonly rooms: readonly RoomSummary[] };
  readonly error?: string;
}

type GameModel =
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

interface RoomState {
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

export class RoomAuthority {
  private readonly rooms = new Map<string, RoomState>();

  public constructor(private readonly dataStore: ServerDataStore = createMemoryServerDataStore()) {
    this.rooms.set(mainBeatRoomId, createServerManagedBeatRoom());
  }

  public handle(connectionId: string, message: ClientMessage): AuthorityResult {
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
      case 'clear-bets':
        return this.beatOnly(room, () => this.clearBeatBets(room));
      case 'rebet':
        return this.beatOnly(room, () => this.rebetBeat(room));
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

  public disconnect(connectionId: string): AuthorityResult {
    const room = this.findRoomByConnection(connectionId);
    return room ? this.leaveRoom(room, connectionId) : { broadcasts: [], settlements: [] };
  }

  private createRoom(connectionId: string, message: Extract<ClientMessage, { type: 'create-room' }>): AuthorityResult {
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
      sessionId: createId('session'),
      revision: 0,
      serverManaged: false,
      settledSessionIds: new Set(),
      lastBeatEvents: [],
    };
    this.rooms.set(room.roomId, room);
    this.addMember(room, connectionId, 'spectator', message.profileId, message.profileName, bankroll);
    this.syncBeatBankroll(room);
    return { broadcasts: [this.snapshot(room)], settlements: [], direct: this.snapshot(room) };
  }

  private joinRoom(connectionId: string, message: Extract<ClientMessage, { type: 'join-room' }>): AuthorityResult {
    const room = this.rooms.get(message.roomId.toUpperCase());
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

  private leaveRoom(room: RoomState, connectionId: string): AuthorityResult {
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
    if (room.players.size === 0 && room.spectators.size === 0 && !room.serverManaged) {
      this.rooms.delete(room.roomId);
      return { broadcasts: [], settlements: [] };
    }
    if (room.players.size === 0 && room.spectators.size === 0 && room.serverManaged) {
      this.resetServerManagedRoom(room);
    }
    this.syncBeatBankroll(room);
    return this.broadcast(room);
  }

  private assignSeat(room: RoomState, profileId: string, seatId: RoomSeatId): AuthorityResult {
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
    this.syncBeatBankroll(room);
    return this.broadcast(room);
  }

  private placeBeatChip(room: RoomState, profileId: string, role: RoomRole, seatId: HandId, betType: BetType, amount: number): AuthorityResult {
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
      this.setPlayerBankroll(room, profileId, player.bankroll - debited);
      return this.broadcast(room, result.settlements);
    }
    return result;
  }

  private clearBeatBets(room: RoomState): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Wrong room game.');
    }
    const before = room.model.game.snapshot();
    if (before.phase !== 'betting') {
      return this.error('Bets can only be cleared before the round starts.');
    }
    const result = this.ownerAction(room, () => room.model.kind === 'beat-the-house' && room.model.game.clearBets());
    for (const seatId of handIds) {
      const ownerProfileId = room.seats.get(seatId);
      const player = ownerProfileId ? room.players.get(ownerProfileId) : undefined;
      const refund = totalBeatStake(before, seatId);
      if (ownerProfileId && player && refund > 0) {
        this.setPlayerBankroll(room, ownerProfileId, player.bankroll + refund);
      }
    }
    this.syncBeatBankroll(room);
    return this.broadcast(room, result.settlements);
  }

  private rebetBeat(room: RoomState): AuthorityResult {
    if (room.model.kind !== 'beat-the-house') {
      return this.error('Wrong room game.');
    }
    const beforeState = room.model.game.saveState();
    const before = room.model.game.snapshot();
    if (before.phase !== 'betting') {
      return this.error('Rebet is only available before the round starts.');
    }
    this.syncBeatBankroll(room);
    const playersBefore = new Map(room.players);
    const result = this.ownerAction(room, () => room.model.kind === 'beat-the-house' && room.model.game.rebet());
    const after = room.model.game.snapshot();
    for (const seatId of handIds) {
      const ownerProfileId = room.seats.get(seatId);
      const player = ownerProfileId ? playersBefore.get(ownerProfileId) : undefined;
      const wager = totalBeatStake(after, seatId) - totalBeatStake(before, seatId);
      if (ownerProfileId && player && wager > 0) {
        if (player.bankroll < wager) {
          room.model.game.restoreState(beforeState);
          this.syncBeatBankroll(room);
          return this.error('Rebet is not affordable for every occupied seat.');
        }
        this.setPlayerBankroll(room, ownerProfileId, player.bankroll - wager);
      }
    }
    this.syncBeatBankroll(room);
    return this.broadcast(room, result.settlements);
  }

  private startBeatRound(room: RoomState, profileId: string, role: RoomRole): AuthorityResult {
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
    this.syncBeatBankroll(room);
    const model = room.model;
    return this.ownerAction(room, () => (room.seats.size > 0 && room.players.has(profileId) ? model.game.deal() : model.game.snapshot()));
  }

  private activeBeatSeatAction(room: RoomState, profileId: string, role: RoomRole, action: 'hit' | 'stick'): AuthorityResult {
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
    return this.ownerAction(room, () => (room.model.kind === 'beat-the-house' ? (action === 'hit' ? room.model.game.hit() : room.model.game.stick()) : snapshot));
  }

  private nextBeatRound(room: RoomState, profileId: string, role: RoomRole): AuthorityResult {
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
    room.sessionId = createId('session');
    this.syncBeatBankroll(room);
    return this.ownerAction(room, () => (room.model.kind === 'beat-the-house' ? room.model.game.nextRound() : undefined));
  }

  private dealBlackjack(room: RoomState, profileId: string, role: RoomRole, wager: number): AuthorityResult {
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
    const player = room.players.get(profileId);
    if (!player || wager <= 0 || player.bankroll < wager) {
      return this.error('Insufficient profile bankroll for that wager.');
    }
    const result = room.model.table.deal(seatId, wager, this.blackjackOccupants(room));
    if (result.error) {
      return this.error(result.error);
    }
    this.setPlayerBankroll(room, profileId, player.bankroll - result.debit);
    if (result.settlements.length > 0) {
      room.model.settledSessionIds.add(room.sessionId);
    }
    return this.broadcast(room, this.applyBlackjackSettlements(room, result));
  }

  private blackjackAction(room: RoomState, profileId: string, role: RoomRole, action: Extract<ClientMessage, { type: 'blackjack-action' }>['action']): AuthorityResult {
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
    const player = room.players.get(profileId);
    if (!player) {
      return this.error('Join a game room first.');
    }
    if (action === 'new-hand') {
      room.sessionId = createId('session');
      room.model.settledSessionIds.clear();
    }
    const seatBefore = room.model.table.snapshot(this.blackjackOccupants(room)).seats.find((seat) => seat.seatId === seatId);
    const requiredDebit = action === 'double' || action === 'split' ? (seatBefore?.wager ?? 0) : action === 'insurance' ? Math.floor((seatBefore?.wager ?? 0) / 2) : 0;
    if (requiredDebit > 0 && player.bankroll < requiredDebit) {
      return this.error('Insufficient profile bankroll for that Blackjack action.');
    }
    const result = room.model.table.act(action, seatId, this.blackjackOccupants(room));
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

  private setSlotsWager(room: RoomState, profileId: string, role: RoomRole, wager: number): AuthorityResult {
    if (room.model.kind !== 'slots') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot wager.');
    }
    const player = room.players.get(profileId);
    if (!player || wager <= 0 || player.bankroll < wager) {
      return this.error('Insufficient profile bankroll for that wager.');
    }
    room.model.wagersByProfileId.set(profileId, wager);
    room.model.readyProfileIds.delete(profileId);
    return this.broadcast(room);
  }

  private setSlotsReady(room: RoomState, profileId: string, role: RoomRole, ready: boolean): AuthorityResult {
    if (room.model.kind !== 'slots') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot ready spins.');
    }
    if (ready && !room.model.wagersByProfileId.has(profileId) && room.model.game.snapshot().freeSpinsRemaining <= 0) {
      return this.error('Set your Slots wager before readying.');
    }
    if (ready) {
      room.model.readyProfileIds.add(profileId);
    } else {
      room.model.readyProfileIds.delete(profileId);
    }
    return this.broadcast(room);
  }

  private spinSlots(room: RoomState, profileId: string, role: RoomRole): AuthorityResult {
    if (room.model.kind !== 'slots') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot spin.');
    }
    if (room.model.game.snapshot().phase === 'bonus') {
      return this.error('Finish the Slots bonus before spinning again.');
    }
    const sharedPhase = deriveSharedSlotsPhase(room.players.size, room.model.wagersByProfileId.size, room.model.readyProfileIds.size, room.model.game.snapshot().phase);
    if (!canSharedSlotsTransition(sharedPhase, { type: 'SPIN' })) {
      return this.error('Every room player must be ready before the shared spin.');
    }
    const snapshot = room.model.game.snapshot();
    const usingFreeSpin = snapshot.freeSpinsRemaining > 0;
    if (!usingFreeSpin) {
      for (const player of room.players.values()) {
        const wager = room.model.wagersByProfileId.get(player.profileId) ?? 0;
        if (wager <= 0) {
          return this.error('Every room player must set a wager before the shared spin.');
        }
        if (player.bankroll < wager) {
          return this.error('Every room player must be able to afford their wager.');
        }
      }
      for (const player of room.players.values()) {
        const wager = room.model.wagersByProfileId.get(player.profileId) ?? 0;
        this.setPlayerBankroll(room, player.profileId, player.bankroll - wager);
      }
    }
    room.sessionId = createId('session');
    room.model.lastSpinByProfileId = profileId;
    room.model.readyProfileIds.clear();
    room.model.returnedByProfileId.clear();
    const model = room.model;
    const before = model.game.snapshot();
    const baseWager = Math.max(1, ...[...room.players.keys()].map((playerId) => model.wagersByProfileId.get(playerId) ?? 0));
    const after = model.game.spin(baseWager);
    return this.broadcast(room, this.settleSlots(room, before, after));
  }

  private pickSlotsBonus(room: RoomState, profileId: string, role: RoomRole): AuthorityResult {
    if (room.model.kind !== 'slots') {
      return this.error('Wrong room game.');
    }
    if (role !== 'player') {
      return this.error('Spectators cannot pick bonus prizes.');
    }
    const before = room.model.game.snapshot();
    const after = room.model.game.pickBonus();
    room.model.lastSpinByProfileId = profileId;
    return this.broadcast(room, this.settleSlots(room, before, after));
  }

  private resetRoom(room: RoomState): AuthorityResult {
    room.sessionId = createId('session');
    room.settledSessionIds.clear();
    if (room.model.kind === 'beat-the-house') {
      room.model.game.restoreState(new BeatTheHouseGame({ initialBankroll: 0 }).saveState());
      this.syncBeatBankroll(room);
    } else if (room.model.kind === 'blackjack') {
      room.model.table.reset(this.blackjackOccupants(room));
      room.model.settledSessionIds.clear();
    } else {
      room.model.game.restore(new SlotsGame({ theme: findSlotTheme(room.gameId) }).snapshot());
      room.model.readyProfileIds.clear();
      room.model.wagersByProfileId.clear();
      room.model.returnedByProfileId.clear();
      room.model.settledSpinKeys.clear();
      room.model.lastSpinByProfileId = undefined;
    }
    return this.broadcast(room);
  }

  private ownerAction(room: RoomState, action: () => GameSnapshot | BlackjackSnapshot | SlotSnapshot | false | undefined): AuthorityResult {
    const before = room.model.kind === 'beat-the-house' ? room.model.game.snapshot() : undefined;
    const snapshot = action();
    if (room.model.kind === 'beat-the-house' && snapshot && 'lastEvents' in snapshot) {
      room.lastBeatEvents = snapshot.lastEvents;
    }
    const settlements =
      room.model.kind === 'beat-the-house' && snapshot && before && 'summaries' in snapshot && snapshot.phase === 'roundOver' && before.phase !== 'roundOver'
        ? this.settleBeat(room, snapshot)
        : [];
    return this.broadcast(room, settlements);
  }

  private settleBeat(room: RoomState, snapshot: GameSnapshot): readonly RoomSettlement[] {
    if (room.settledSessionIds.has(room.sessionId)) {
      return [];
    }
    room.settledSessionIds.add(room.sessionId);
    return snapshot.summaries.flatMap((summary) => {
      const profileId = room.seats.get(summary.handId);
      if (!profileId) {
        return [];
      }
      const wagered = totalBeatStake(snapshot, summary.handId);
      const returned = wagered + summary.profit;
      const player = room.players.get(profileId);
      if (player && returned > 0) {
        this.setPlayerBankroll(room, profileId, player.bankroll + returned);
      }
      return [{ id: createId('settlement'), profileId, seatId: summary.handId, wagered, returned, profit: summary.profit }];
    });
  }

  private applyBlackjackSettlements(room: RoomState, result: BlackjackTableActionResult): readonly RoomSettlement[] {
    if (room.model.kind !== 'blackjack') {
      return [];
    }
    return result.settlements.flatMap((settlement) => {
      const profileId = room.seats.get(settlement.seatId as RoomSeatId);
      if (!profileId) {
        return [];
      }
      const player = room.players.get(profileId);
      if (player && settlement.returned > 0) {
        this.setPlayerBankroll(room, profileId, player.bankroll + settlement.returned);
      }
      return [
        {
          id: createId('settlement'),
          profileId,
          seatId: settlement.seatId as RoomSeatId,
          wagered: settlement.wagered,
          returned: settlement.returned,
          profit: settlement.profit,
        },
      ];
    });
  }

  private settleSlots(room: RoomState, before: SlotSnapshot, snapshot: SlotSnapshot): readonly RoomSettlement[] {
    if (room.model.kind !== 'slots' || snapshot.phase !== 'spun' || before === snapshot) {
      return [];
    }
    const key = `${room.sessionId}:${snapshot.returned}:${snapshot.reels.join('-')}:${snapshot.bonusPicksRemaining}`;
    if (room.model.settledSpinKeys.has(key)) {
      return [];
    }
    room.model.settledSpinKeys.add(key);
    const model = room.model;
    const baseWager = Math.max(1, ...[...room.players.keys()].map((playerId) => model.wagersByProfileId.get(playerId) ?? 0));
    return [...room.players.values()].map((player) => {
      const wager = before.freeSpinsRemaining > 0 ? 0 : (model.wagersByProfileId.get(player.profileId) ?? 0);
      const returned = Math.floor(snapshot.returned * (baseWager > 0 ? Math.max(1, wager || baseWager) / baseWager : 1));
      model.returnedByProfileId.set(player.profileId, returned);
      if (returned > 0) {
        this.setPlayerBankroll(room, player.profileId, player.bankroll + returned);
      }
      return {
        id: createId('settlement'),
        profileId: player.profileId,
        seatId: this.profileSeatId(room, player.profileId) ?? 'seat-1',
        wagered: wager,
        returned,
        profit: returned - wager,
      };
    });
  }

  private broadcast(room: RoomState, settlements: readonly RoomSettlement[] = []): AuthorityResult {
    room.revision += 1;
    room.updatedAt = Date.now();
    return { broadcasts: [this.snapshot(room)], settlements };
  }

  private snapshot(room: RoomState): RoomSnapshot {
    const game = this.gameSnapshot(room);
    return {
      roomId: room.roomId,
      roomName: room.roomName,
      hostProfileId: room.hostProfileId,
      gameId: room.gameId,
      gameTitle: room.gameTitle,
      status: roomStatus(room),
      phase: roomPhase(room),
      sessionId: room.sessionId,
      revision: room.revision,
      maxPlayers: room.maxPlayers,
      allowSpectators: room.allowSpectators,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      players: [...room.players.values()],
      spectators: [...room.spectators.values()],
      seats: this.seatIds(room).map((seatId): RoomSeat => ({ seatId, profileId: room.seats.get(seatId) })),
      game,
      slots:
        room.model.kind === 'slots'
          ? {
              wager: Math.max(0, ...room.model.wagersByProfileId.values()),
              wagersByProfileId: Object.fromEntries(room.model.wagersByProfileId),
              readyProfileIds: [...room.model.readyProfileIds],
              lastSpinByProfileId: room.model.lastSpinByProfileId,
              returnedByProfileId: Object.fromEntries(room.model.returnedByProfileId),
            }
          : undefined,
    };
  }

  private summary(room: RoomState): RoomSummary {
    return {
      roomId: room.roomId,
      roomName: room.roomName,
      gameId: room.gameId,
      gameTitle: room.gameTitle,
      hostProfileId: room.hostProfileId,
      maxPlayers: room.maxPlayers,
      currentPlayers: room.players.size,
      spectators: room.spectators.size,
      status: roomStatus(room),
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
    };
  }

  private addMember(room: RoomState, connectionId: string, role: RoomRole, profileId: string, profileName: string, bankroll: number, sessionStartBankroll?: number): void {
    const centralBankroll = this.centralBankroll(profileId, profileName, bankroll);
    const player: RoomPlayer = {
      connectionId,
      profileId,
      profileName,
      bankroll: centralBankroll,
      sessionStartBankroll: sessionStartBankroll ?? centralBankroll,
      role,
    };
    room.connectionToMember.set(connectionId, { profileId, role });
    if (role === 'spectator') {
      room.spectators.set(profileId, player);
      room.players.delete(profileId);
    } else {
      room.players.set(profileId, player);
      room.spectators.delete(profileId);
    }
  }

  private centralBankroll(profileId: string, profileName: string, fallback: number): number {
    return this.dataStore.ensureProfile(profileId, profileName, fallback).bankroll;
  }

  private setPlayerBankroll(room: RoomState, profileId: string, bankroll: number): void {
    const player = room.players.get(profileId);
    if (!player) {
      return;
    }
    const nextBankroll = safeBankroll(bankroll);
    const updated = this.dataStore.setProfileBankroll(profileId, nextBankroll);
    room.players.set(profileId, { ...player, bankroll: updated?.bankroll ?? nextBankroll });
  }

  private syncBeatBankroll(room: RoomState): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    room.model.game.syncBankroll([...room.players.values()].reduce((total, player) => total + player.bankroll, 0));
  }

  private removeExistingMember(room: RoomState, profileId: string): void {
    const existing = room.players.get(profileId) ?? room.spectators.get(profileId);
    if (existing) {
      room.connectionToMember.delete(existing.connectionId);
    }
    room.players.delete(profileId);
    room.spectators.delete(profileId);
    for (const [seatId, ownerProfileId] of room.seats.entries()) {
      if (ownerProfileId === profileId) {
        room.seats.delete(seatId);
      }
    }
    this.removeProfileGameState(room, profileId);
  }

  private removeProfileGameState(room: RoomState, profileId: string): void {
    if (room.model.kind === 'slots') {
      room.model.readyProfileIds.delete(profileId);
      room.model.wagersByProfileId.delete(profileId);
      room.model.returnedByProfileId.delete(profileId);
    }
  }

  private resetServerManagedRoom(room: RoomState): void {
    room.seats.clear();
    room.settledSessionIds.clear();
    room.lastBeatEvents = [];
    room.sessionId = createId('session');
    if (room.model.kind === 'beat-the-house') {
      room.model.game.restoreState(new BeatTheHouseGame({ initialBankroll: 0 }).saveState());
    }
  }

  private seatIds(room: RoomState): readonly RoomSeatId[] {
    if (room.model.kind === 'beat-the-house') {
      return handIds;
    }
    return Array.from({ length: room.maxPlayers }, (_, index) => `seat-${index + 1}` as const);
  }

  private profileSeatId(room: RoomState, profileId: string): RoomSeatId | undefined {
    return [...room.seats.entries()].find(([, owner]) => owner === profileId)?.[0];
  }

  private gameSnapshot(room: RoomState): GameSnapshot | BlackjackSnapshot | BlackjackTableSnapshot | SlotSnapshot {
    if (room.model.kind === 'blackjack') {
      return room.model.table.snapshot(this.blackjackOccupants(room));
    }
    if (room.model.kind === 'beat-the-house') {
      return room.model.game.snapshot([...room.lastBeatEvents]);
    }
    return room.model.game.snapshot();
  }

  private blackjackOccupants(room: RoomState): readonly BlackjackTableOccupant[] {
    return this.seatIds(room).map((seatId) => {
      const profileId = room.seats.get(seatId);
      const player = profileId ? room.players.get(profileId) : undefined;
      return { seatId, profileId, profileName: player?.profileName, bankroll: player?.bankroll };
    });
  }

  private beatOnly(room: RoomState, action: () => AuthorityResult): AuthorityResult {
    return room.model.kind === 'beat-the-house' ? action() : this.error('This action only applies to Beat the House rooms.');
  }

  private blackjackOnly(room: RoomState, action: () => AuthorityResult): AuthorityResult {
    return room.model.kind === 'blackjack' ? action() : this.error('This action only applies to Blackjack rooms.');
  }

  private slotsOnly(room: RoomState, action: () => AuthorityResult): AuthorityResult {
    return room.model.kind === 'slots' ? action() : this.error('This action only applies to Slots rooms.');
  }

  private findRoomByConnection(connectionId: string): RoomState | undefined {
    return [...this.rooms.values()].find((room) => room.connectionToMember.has(connectionId));
  }

  private error(message: string): AuthorityResult {
    return { broadcasts: [], settlements: [], error: message };
  }
}

const createGameModel = (gameId: RoomGameId, bankroll: number): GameModel => {
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

const createServerManagedBeatRoom = (): RoomState => {
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

const compareRoomListOrder = (left: RoomState, right: RoomState): number => {
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

const roomPhase = (room: RoomState): RoomSnapshot['phase'] => {
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

const roomStatus = (room: RoomState): RoomSnapshot['status'] => {
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

const createRoomId = (rooms: ReadonlyMap<string, RoomState>): string => {
  while (true) {
    const id = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!rooms.has(id)) {
      return id;
    }
  }
};

const safeBankroll = (value: number): number => (Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0);

const createId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const cleanName = (name?: string): string => (name ?? '').trim().replace(/\s+/g, ' ').slice(0, 48);

const totalBeatStake = (snapshot: GameSnapshot, handId: HandId): number => betTypes.reduce((sum, betType) => sum + snapshot.bets[handId][betType], 0);
