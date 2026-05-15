import type { BlackjackSnapshot } from '../game/blackjack/BlackjackSnapshot';
import type { BlackjackTableActionResult } from '../game/blackjackTable/BlackjackTableActionResult';
import type { BlackjackTableOccupant } from '../game/blackjackTable/BlackjackTableOccupant';
import type { BlackjackTableSnapshot } from '../game/blackjackTable/BlackjackTableSnapshot';
import { findSlotTheme } from '../game/catalog/findSlotTheme';
import { BeatTheHouseGame } from '../game/engine/BeatTheHouseGame';
import { SlotsGame } from '../game/slots/SlotsGame';
import type { SlotSnapshot } from '../game/slots/SlotSnapshot';
import type { GameSnapshot } from '../game/types/GameSnapshot';
import type { HandId } from '../game/types/HandId';
import { handIds } from '../game/types/handIds';
import type { CasinoProfile } from '../state/profiles/CasinoProfile';
import { createMemoryServerDataStore } from '../state/serverDataStore/createMemoryServerDataStore';
import type { ServerDataStore } from '../state/serverDataStore/ServerDataStore';
import type { RoomPlayer } from './protocol/RoomPlayer';
import type { RoomSeat } from './protocol/RoomSeat';
import type { RoomSeatId } from './protocol/RoomSeatId';
import type { RoomSettlement } from './protocol/RoomSettlement';
import type { RoomSnapshot } from './protocol/RoomSnapshot';
import type { RoomSummary } from './protocol/RoomSummary';
import type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';
import { createId } from './roomAuthorityModel/createId';
import { createServerManagedBeatRoom } from './roomAuthorityModel/createServerManagedBeatRoom';
import { mainBeatRoomId } from './roomAuthorityModel/mainBeatRoomId';
import { roomPhase } from './roomAuthorityModel/roomPhase';
import type { RoomState } from './roomAuthorityModel/RoomState';
import { roomStatus } from './roomAuthorityModel/roomStatus';
import { safeBankroll } from './roomAuthorityModel/safeBankroll';
import { totalBeatStake } from './roomAuthorityModel/totalBeatStake';

export abstract class RoomAuthorityBase {
  private static readonly beatNextRoundTimeoutMs = 20_000;

  protected readonly rooms = new Map<string, RoomState>();
  private asyncResultHandler: ((result: AuthorityResult) => void) | undefined;

  public constructor(protected readonly dataStore: ServerDataStore = createMemoryServerDataStore()) {
    this.rooms.set(mainBeatRoomId, createServerManagedBeatRoom());
  }

  public setAsyncResultHandler(handler: ((result: AuthorityResult) => void) | undefined): void {
    this.asyncResultHandler = handler;
  }

  public dispose(): void {
    for (const room of this.rooms.values()) {
      this.clearBeatNextRoundDeadline(room);
    }
    this.asyncResultHandler = undefined;
  }

  protected resetRoom(room: RoomState): AuthorityResult {
    room.sessionId = createId('session');
    room.settledSessionIds.clear();
    if (room.model.kind === 'beat-the-house') {
      this.clearBeatReadiness(room);
      room.model.game.restoreState(new BeatTheHouseGame({ initialBankroll: 0 }).saveState());
      room.lastBeatBetOwners = {};
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

  protected ownerAction(room: RoomState, action: () => GameSnapshot | BlackjackSnapshot | SlotSnapshot | false | undefined): AuthorityResult {
    const before = room.model.kind === 'beat-the-house' ? room.model.game.snapshot() : undefined;
    const snapshot = action();
    if (room.model.kind === 'beat-the-house' && snapshot && 'lastEvents' in snapshot) {
      room.lastBeatEvents = snapshot.lastEvents;
    }
    const settlements =
      room.model.kind === 'beat-the-house' && snapshot && before && 'summaries' in snapshot && snapshot.phase === 'roundOver' && before.phase !== 'roundOver'
        ? this.settleBeat(room, snapshot)
        : [];
    if (room.model.kind === 'beat-the-house' && snapshot && before && 'summaries' in snapshot) {
      this.afterBeatSnapshotChange(room, before, snapshot);
    }
    return this.broadcast(room, settlements);
  }

  protected afterBeatSnapshotChange(room: RoomState, before: GameSnapshot, after: GameSnapshot): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    if (after.phase === 'roundOver' && before.phase !== 'roundOver') {
      this.clearBeatReadyVotes(room);
      this.scheduleBeatNextRoundDeadline(room);
      return;
    }
    if (before.phase === 'roundOver' && after.phase !== 'roundOver') {
      this.clearBeatReadiness(room);
      return;
    }
    if (before.phase === 'betting' && after.phase !== 'betting') {
      this.clearBeatReadyVotes(room);
    }
  }

  protected settleBeat(room: RoomState, snapshot: GameSnapshot): readonly RoomSettlement[] {
    if (room.settledSessionIds.has(room.sessionId)) {
      return [];
    }
    room.settledSessionIds.add(room.sessionId);
    const gameplaySettlements = snapshot.summaries.flatMap((summary) => {
      const profileId = room.seats.get(summary.handId);
      if (!profileId) {
        return [];
      }
      const wagered = totalBeatStake(snapshot, summary.handId);
      const returned = wagered + summary.profit;
      const player = room.players.get(profileId);
      const houseAdvanceRepayment = player && returned > 0 ? this.applyPlayerSettlement(room, profileId, returned, summary.profit) : 0;
      return [
        {
          id: createId('settlement'),
          kind: 'gameplay' as const,
          profileId,
          seatId: summary.handId,
          wagered,
          returned,
          profit: summary.profit,
          houseAdvanceRepayment,
        },
      ];
    });
    const dealerThanksSettlements = handIds.flatMap((handId): RoomSettlement[] => {
      const dealerThanks = snapshot.dealerTipRewards[handId];
      const profileId = room.seats.get(handId);
      if (!profileId || dealerThanks <= 0) {
        return [];
      }
      const player = room.players.get(profileId);
      const dealerTip = snapshot.dealerTips[handId];
      const updated = this.dataStore.recordTransaction(profileId, {
        gameId: room.gameId,
        roomId: room.roomId,
        sessionId: room.sessionId,
        type: 'dealer_thanks',
        amount: dealerThanks,
        description: "Dealer's Thanks reward.",
        metadata: { handId, dealerTip, dealerThanks },
      });
      if (player && updated) {
        room.players.set(profileId, { ...player, bankroll: updated.bankroll });
      }
      return [
        {
          id: createId('settlement'),
          kind: 'dealer-thanks',
          profileId,
          seatId: handId,
          wagered: 0,
          returned: dealerThanks,
          profit: 0,
          dealerTip,
          dealerThanks,
          houseAdvanceRepayment: 0,
        },
      ];
    });
    return [...gameplaySettlements, ...dealerThanksSettlements];
  }

  protected applyBlackjackSettlements(room: RoomState, result: BlackjackTableActionResult): readonly RoomSettlement[] {
    if (room.model.kind !== 'blackjack') {
      return [];
    }
    return result.settlements.flatMap((settlement) => {
      const profileId = room.seats.get(settlement.seatId as RoomSeatId);
      if (!profileId) {
        return [];
      }
      const player = room.players.get(profileId);
      const houseAdvanceRepayment = player && settlement.returned > 0 ? this.applyPlayerSettlement(room, profileId, settlement.returned, settlement.profit) : 0;
      return [
        {
          id: createId('settlement'),
          profileId,
          seatId: settlement.seatId as RoomSeatId,
          wagered: settlement.wagered,
          returned: settlement.returned,
          profit: settlement.profit,
          houseAdvanceRepayment,
        },
      ];
    });
  }

  protected settleSlots(room: RoomState, before: SlotSnapshot, snapshot: SlotSnapshot): readonly RoomSettlement[] {
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
      const houseAdvanceRepayment = returned > 0 ? this.applyPlayerSettlement(room, player.profileId, returned, returned - wager) : 0;
      return {
        id: createId('settlement'),
        profileId: player.profileId,
        seatId: this.profileSeatId(room, player.profileId) ?? 'seat-1',
        wagered: wager,
        returned,
        profit: returned - wager,
        houseAdvanceRepayment,
      };
    });
  }

  protected broadcast(room: RoomState, settlements: readonly RoomSettlement[] = []): AuthorityResult {
    room.revision += 1;
    room.updatedAt = Date.now();
    return { broadcasts: [this.snapshot(room)], settlements };
  }

  protected reconcileRooms(reason: string, profileId?: string): AuthorityResult {
    const profiles = new Map(this.dataStore.snapshot().profileState.profiles.map((profile) => [profile.id, profile]));
    const broadcasts: RoomSnapshot[] = [];
    const roomClosures: Array<NonNullable<AuthorityResult['roomClosures']>[number]> = [];

    for (const room of [...this.rooms.values()]) {
      if (profileId && !this.roomHasProfile(room, profileId)) {
        continue;
      }
      const beforeConnectionIds = this.roomConnectionIds(room);
      const removedConnectionIds: string[] = [];
      let changed = false;

      for (const memberProfileId of this.roomProfileIds(room)) {
        const profile = profiles.get(memberProfileId);
        if (!profile) {
          removedConnectionIds.push(...this.profileConnectionIds(room, memberProfileId));
          this.removeExistingMember(room, memberProfileId);
          changed = true;
          continue;
        }
        changed = this.updateRoomProfile(room, profile) || changed;
      }

      if (!changed) {
        continue;
      }

      if (!room.serverManaged && (!this.roomHasProfile(room, room.hostProfileId) || this.roomMemberCount(room) === 0)) {
        this.clearBeatReadiness(room);
        this.rooms.delete(room.roomId);
        roomClosures.push({ roomId: room.roomId, gameId: room.gameId, connectionIds: RoomAuthorityBase.unique(beforeConnectionIds), reason });
        continue;
      }

      if (room.serverManaged && this.roomMemberCount(room) === 0) {
        this.resetServerManagedRoom(room);
      }
      this.syncBeatBankroll(room);
      if (removedConnectionIds.length > 0) {
        roomClosures.push({ roomId: room.roomId, gameId: room.gameId, connectionIds: RoomAuthorityBase.unique(removedConnectionIds), reason });
      }
      broadcasts.push(this.broadcast(room).broadcasts[0]);
    }

    return { broadcasts, settlements: [], roomClosures };
  }

  protected clearAllRooms(reason: string): AuthorityResult {
    const broadcasts: RoomSnapshot[] = [];
    const roomClosures: Array<NonNullable<AuthorityResult['roomClosures']>[number]> = [];
    const broadcastRecipients: Array<NonNullable<AuthorityResult['broadcastRecipients']>[number]> = [];

    for (const room of [...this.rooms.values()]) {
      const connectionIds = this.roomConnectionIds(room);
      if (!room.serverManaged) {
        this.clearBeatReadiness(room);
        roomClosures.push({ roomId: room.roomId, gameId: room.gameId, connectionIds, reason });
        this.rooms.delete(room.roomId);
        continue;
      }
      room.players.clear();
      room.spectators.clear();
      room.connectionToMember.clear();
      this.resetServerManagedRoom(room);
      const snapshot = this.broadcast(room).broadcasts[0];
      broadcasts.push(snapshot);
      if (connectionIds.length > 0) {
        broadcastRecipients.push({ roomId: snapshot.roomId, connectionIds });
      }
    }

    return { broadcasts, settlements: [], roomClosures, broadcastRecipients };
  }

  protected snapshot(room: RoomState): RoomSnapshot {
    const game = this.gameSnapshot(room);
    const beat =
      room.model.kind === 'beat-the-house'
        ? {
            rebetSeatIds: this.beatRebetSeatIds(room, game as GameSnapshot),
            readyProfileIds: this.beatReadyProfileIds(room),
            readyCount: this.beatReadyProfileIds(room).length,
            playerCount: room.players.size,
            readyPhase: room.model.readyPhase,
            nextRoundDeadlineAt: room.model.nextRoundDeadlineAt,
            nextRoundRemainingMs: room.model.nextRoundDeadlineAt ? Math.max(0, room.model.nextRoundDeadlineAt - Date.now()) : undefined,
          }
        : undefined;
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
      beat,
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

  protected summary(room: RoomState): RoomSummary {
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

  protected addMember(
    room: RoomState,
    connectionId: string,
    role: 'player' | 'spectator',
    profileId: string,
    profileName: string,
    bankroll: number,
    sessionStartBankroll?: number,
  ): void {
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

  protected centralBankroll(profileId: string, profileName: string, fallback: number): number {
    return this.dataStore.ensureProfile(profileId, profileName, fallback).bankroll;
  }

  protected setPlayerBankroll(room: RoomState, profileId: string, bankroll: number): void {
    const player = room.players.get(profileId);
    if (!player) {
      return;
    }
    const nextBankroll = safeBankroll(bankroll);
    const updated = this.dataStore.setProfileBankroll(profileId, nextBankroll);
    room.players.set(profileId, { ...player, bankroll: updated?.bankroll ?? nextBankroll });
  }

  protected applyPlayerSettlement(room: RoomState, profileId: string, returned: number, profit: number): number {
    const player = room.players.get(profileId);
    if (!player) {
      return 0;
    }
    const result = this.dataStore.applyGameplaySettlement(profileId, returned, profit, {
      gameId: room.gameId,
      roomId: room.roomId,
      sessionId: room.sessionId,
    });
    const nextBankroll = result?.profile.bankroll ?? safeBankroll(player.bankroll + returned);
    room.players.set(profileId, { ...player, bankroll: nextBankroll });
    return result?.houseAdvanceRepayment ?? 0;
  }

  protected syncBeatBankroll(room: RoomState): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    room.model.game.syncBankroll([...room.players.values()].reduce((total, player) => total + player.bankroll, 0));
  }

  protected removeExistingMember(room: RoomState, profileId: string): void {
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

  protected removeProfileGameState(room: RoomState, profileId: string): void {
    if (room.model.kind === 'beat-the-house') {
      room.model.readyProfileIds.delete(profileId);
    }
    if (room.model.kind === 'slots') {
      room.model.readyProfileIds.delete(profileId);
      room.model.wagersByProfileId.delete(profileId);
      room.model.returnedByProfileId.delete(profileId);
    }
  }

  protected resetServerManagedRoom(room: RoomState): void {
    room.seats.clear();
    room.settledSessionIds.clear();
    room.lastBeatEvents = [];
    room.lastBeatBetOwners = {};
    room.sessionId = createId('session');
    if (room.model.kind === 'beat-the-house') {
      this.clearBeatReadiness(room);
      room.model.game.restoreState(new BeatTheHouseGame({ initialBankroll: 0 }).saveState());
    }
  }

  protected clearBeatReadiness(room: RoomState): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    room.model.readyProfileIds.clear();
    room.model.readyPhase = undefined;
    this.clearBeatNextRoundDeadline(room);
  }

  protected clearBeatReadyVotes(room: RoomState): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    room.model.readyProfileIds.clear();
    room.model.readyPhase = undefined;
  }

  protected clearBeatReadyProfile(room: RoomState, profileId: string): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    room.model.readyProfileIds.delete(profileId);
    if (room.model.readyProfileIds.size === 0) {
      room.model.readyPhase = undefined;
    }
  }

  protected clearBeatNextRoundDeadline(room: RoomState): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    if (room.model.nextRoundTimer) {
      clearTimeout(room.model.nextRoundTimer);
    }
    room.model.nextRoundTimer = undefined;
    room.model.nextRoundDeadlineAt = undefined;
  }

  protected beatReadyProfileIds(room: RoomState): readonly string[] {
    if (room.model.kind !== 'beat-the-house') {
      return [];
    }
    return [...room.model.readyProfileIds].filter((profileId) => room.players.has(profileId));
  }

  protected everyBeatPlayerReady(room: RoomState): boolean {
    if (room.model.kind !== 'beat-the-house' || room.players.size <= 0) {
      return false;
    }
    const readyProfileIds = room.model.readyProfileIds;
    return [...room.players.keys()].every((profileId) => readyProfileIds.has(profileId));
  }

  protected advanceReadyBeatNextRound(room: RoomState): AuthorityResult {
    room.sessionId = createId('session');
    this.clearBeatReadiness(room);
    this.syncBeatBankroll(room);
    return this.ownerAction(room, () => (room.model.kind === 'beat-the-house' ? room.model.game.nextRound() : undefined));
  }

  private scheduleBeatNextRoundDeadline(room: RoomState): void {
    if (room.model.kind !== 'beat-the-house' || room.model.nextRoundDeadlineAt) {
      return;
    }
    const deadlineAt = Date.now() + RoomAuthorityBase.beatNextRoundTimeoutMs;
    room.model.nextRoundDeadlineAt = deadlineAt;
    const timer = setTimeout(() => {
      const currentRoom = this.rooms.get(room.roomId);
      if (
        !currentRoom ||
        currentRoom.model.kind !== 'beat-the-house' ||
        currentRoom.model.nextRoundDeadlineAt !== deadlineAt ||
        currentRoom.model.game.snapshot().phase !== 'roundOver'
      ) {
        return;
      }
      const result = this.advanceReadyBeatNextRound(currentRoom);
      if (result.broadcasts.length > 0 || result.settlements.length > 0) {
        this.asyncResultHandler?.(result);
      }
    }, RoomAuthorityBase.beatNextRoundTimeoutMs);
    if (typeof timer === 'object' && 'unref' in timer && typeof timer.unref === 'function') {
      timer.unref();
    }
    room.model.nextRoundTimer = timer;
  }

  protected seatIds(room: RoomState): readonly RoomSeatId[] {
    if (room.model.kind === 'beat-the-house') {
      return handIds;
    }
    return Array.from({ length: room.maxPlayers }, (_, index) => `seat-${index + 1}` as const);
  }

  protected profileSeatId(room: RoomState, profileId: string): RoomSeatId | undefined {
    return [...room.seats.entries()].find(([, owner]) => owner === profileId)?.[0];
  }

  private roomProfileIds(room: RoomState): readonly string[] {
    return RoomAuthorityBase.unique([
      ...room.players.keys(),
      ...room.spectators.keys(),
      ...[...room.seats.values()].filter((profileId): profileId is string => Boolean(profileId)),
    ]);
  }

  private roomConnectionIds(room: RoomState): readonly string[] {
    return RoomAuthorityBase.unique([
      ...room.connectionToMember.keys(),
      ...[...room.players.values(), ...room.spectators.values()].map((player) => player.connectionId),
    ]);
  }

  private profileConnectionIds(room: RoomState, profileId: string): readonly string[] {
    return RoomAuthorityBase.unique(
      [room.players.get(profileId)?.connectionId, room.spectators.get(profileId)?.connectionId].filter((connectionId): connectionId is string =>
        Boolean(connectionId),
      ),
    );
  }

  private roomHasProfile(room: RoomState, profileId: string): boolean {
    return this.roomProfileIds(room).includes(profileId);
  }

  private roomMemberCount(room: RoomState): number {
    return room.players.size + room.spectators.size;
  }

  private updateRoomProfile(room: RoomState, profile: CasinoProfile): boolean {
    let changed = false;
    const update = (player: RoomPlayer): RoomPlayer => {
      if (player.profileName === profile.name && Object.is(player.bankroll, profile.bankroll)) {
        return player;
      }
      changed = true;
      return { ...player, profileName: profile.name, bankroll: profile.bankroll };
    };
    const player = room.players.get(profile.id);
    if (player) {
      room.players.set(profile.id, update(player));
    }
    const spectator = room.spectators.get(profile.id);
    if (spectator) {
      room.spectators.set(profile.id, update(spectator));
    }
    return changed;
  }

  protected gameSnapshot(room: RoomState): GameSnapshot | BlackjackSnapshot | BlackjackTableSnapshot | SlotSnapshot {
    if (room.model.kind === 'blackjack') {
      return room.model.table.snapshot(this.blackjackOccupants(room));
    }
    if (room.model.kind === 'beat-the-house') {
      return room.model.game.snapshot([...room.lastBeatEvents]);
    }
    return room.model.game.snapshot();
  }

  private beatRebetSeatIds(room: RoomState, snapshot: GameSnapshot): readonly HandId[] {
    return handIds.filter((handId) => {
      const profileId = room.seats.get(handId);
      return Boolean(profileId && room.lastBeatBetOwners[handId] === profileId && snapshot.rebetAmounts[handId] > 0);
    });
  }

  protected blackjackOccupants(room: RoomState): readonly BlackjackTableOccupant[] {
    return this.seatIds(room).map((seatId) => {
      const profileId = room.seats.get(seatId);
      const player = profileId ? room.players.get(profileId) : undefined;
      return { seatId, profileId, profileName: player?.profileName, bankroll: player?.bankroll };
    });
  }

  protected beatOnly(room: RoomState, action: () => AuthorityResult): AuthorityResult {
    return room.model.kind === 'beat-the-house' ? action() : this.error('This action only applies to Beat the House rooms.');
  }

  protected blackjackOnly(room: RoomState, action: () => AuthorityResult): AuthorityResult {
    return room.model.kind === 'blackjack' ? action() : this.error('This action only applies to Blackjack rooms.');
  }

  protected slotsOnly(room: RoomState, action: () => AuthorityResult): AuthorityResult {
    return room.model.kind === 'slots' ? action() : this.error('This action only applies to Slots rooms.');
  }

  protected findRoomByConnection(connectionId: string): RoomState | undefined {
    return [...this.rooms.values()].find((room) => room.connectionToMember.has(connectionId));
  }

  protected error(message: string): AuthorityResult {
    return { broadcasts: [], settlements: [], error: message };
  }

  private static unique<Value>(values: readonly Value[]): Value[] {
    return [...new Set(values)];
  }
}
