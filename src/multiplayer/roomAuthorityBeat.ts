import { canRoomFlowTransition } from '../state/roomMachines/canRoomFlowTransition';
import type { BetType } from '../game/types/BetType';
import { betTypes } from '../game/types/betTypes';
import { isSideBetWithinMainBet } from '../game/engine/isSideBetWithinMainBet';
import type { GameSnapshot } from '../game/types/GameSnapshot';
import type { HandId } from '../game/types/HandId';
import { handIds } from '../game/types/handIds';
import type { ProfileId } from '../schemas/casinoSchemas/ProfileId';
import { handIdSchema } from '../schemas/casinoSchemas/handIdSchema';
import type { RoomRole } from './protocol/RoomRole';
import type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';
import type { RoomState } from './roomAuthorityModel/RoomState';
import { roomPhase } from './roomAuthorityModel/roomPhase';
import { totalBeatStake } from './roomAuthorityModel/totalBeatStake';
import { RoomAuthoritySlots } from './roomAuthoritySlots';

export abstract class RoomAuthorityBeat extends RoomAuthoritySlots {
  protected placeBeatChip(room: RoomState, profileId: ProfileId, role: RoomRole, seatId: HandId, betType: BetType, amount: number): AuthorityResult {
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
    const before = room.model.game.snapshot();
    if (betType !== 'main' && before.bets[seatId].main <= 0) {
      return this.error('Side bets need a main bet on the same hand.');
    }
    if (betType !== 'main' && !isSideBetWithinMainBet(before.bets[seatId].main, before.bets[seatId][betType], amount)) {
      return this.error('Side bets cannot exceed the main bet on the same hand.');
    }
    this.syncBeatBankroll(room);
    const beforeAmount = room.model.game.snapshot().bets[seatId][betType];
    const result = this.ownerAction(room, () => room.model.kind === 'beat-the-house' && room.model.game.placeBet(seatId, betType, amount));
    const debited = room.model.game.snapshot().bets[seatId][betType] - beforeAmount;
    if (debited > 0) {
      this.clearBeatReadyProfile(room, profileId);
      this.setPlayerBankroll(room, profileId, player.bankroll - debited);
      return this.broadcast(room, result.settlements);
    }
    return result;
  }

  protected placeBeatTip(room: RoomState, profileId: ProfileId, role: RoomRole, seatId: HandId, amount: number): AuthorityResult {
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

  protected clearBeatBets(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
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

  protected rebetBeat(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
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
    this.syncBeatBankroll(room);
    const syncedBefore = room.model.game.snapshot();
    const result = this.ownerAction(room, () => room.model.kind === 'beat-the-house' && room.model.game.rebetHand(seatId));
    const after = room.model.game.snapshot();
    const debited = totalBeatStake(after, seatId) - totalBeatStake(syncedBefore, seatId);
    if (debited > 0) {
      this.setPlayerBankroll(room, profileId, player.bankroll - debited);
    }
    this.clearBeatReadyProfile(room, profileId);
    this.syncBeatBankroll(room);
    return this.broadcast(room, result.settlements);
  }

  protected startBeatRound(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
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
    let settlements: readonly import('./protocol/RoomSettlement').RoomSettlement[] = [];
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

  protected activeBeatSeatAction(room: RoomState, profileId: ProfileId, role: RoomRole, action: 'hit' | 'stick'): AuthorityResult {
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

  protected nextBeatRound(room: RoomState, profileId: ProfileId, role: RoomRole): AuthorityResult {
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

  private profileBeatSeatId(room: RoomState, profileId: ProfileId): HandId | undefined {
    const seatId = this.profileSeatId(room, profileId);
    const parsed = handIdSchema.safeParse(seatId);
    return parsed.success ? parsed.data : undefined;
  }
}
