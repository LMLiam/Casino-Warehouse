import type { BlackjackSnapshot } from '../game/blackjack/BlackjackSnapshot';
import type { BlackjackTableOccupant } from '../game/blackjackTable/BlackjackTableOccupant';
import type { BlackjackTableSnapshot } from '../game/blackjackTable/BlackjackTableSnapshot';
import { findSlotTheme } from '../game/catalog/findSlotTheme';
import { BeatTheHouseGame } from '../game/engine/BeatTheHouseGame';
import { SlotsGame } from '../game/slots/SlotsGame';
import type { SlotSnapshot } from '../game/slots/SlotSnapshot';
import type { GameSnapshot } from '../game/types/GameSnapshot';
import type { HandId } from '../game/types/HandId';
import { handIds } from '../game/types/handIds';
import type { BlackjackSeatId } from '../schemas/casinoSchemas/BlackjackSeatId';
import { blackjackSeatIdSchema } from '../schemas/casinoSchemas/blackjackSeatIdSchema';
import type { ConnectionId } from '../schemas/casinoSchemas/ConnectionId';
import type { ProfileId } from '../schemas/casinoSchemas/ProfileId';
import type { RoomSeat } from './protocol/RoomSeat';
import type { RoomSeatId } from './protocol/RoomSeatId';
import type { RoomSnapshot } from './protocol/RoomSnapshot';
import type { RoomSummary } from './protocol/RoomSummary';
import type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';
import { createSessionId } from './roomAuthorityModel/createSessionId';
import { roomPhase } from './roomAuthorityModel/roomPhase';
import type { RoomState } from './roomAuthorityModel/RoomState';
import { roomStatus } from './roomAuthorityModel/roomStatus';
import { beatNextRoundTimeoutMs } from './roomLimits/beatNextRoundTimeoutMs';
import { unrefFunctionSchema } from './roomAuthorityModel/unrefFunctionSchema';
import { RoomAuthorityMembership } from './roomAuthorityMembership';

export abstract class RoomAuthorityBase extends RoomAuthorityMembership {
  protected resetRoom(room: RoomState): AuthorityResult {
    const recovery = this.retryUnsettledBeatSettlement(room);
    if (recovery) {
      return recovery;
    }
    room.sessionId = createSessionId();
    room.settledSessionIds.clear();
    if (room.model.kind === 'beat-the-house') {
      this.clearBeatReadiness(room);
      room.model.game.restoreState(new BeatTheHouseGame({ initialBankroll: 0 }).saveState());
      room.lastBeatBetOwners = {};
      room.beatHandOwners = {};
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

  protected afterBeatSnapshotChange(room: RoomState, before: GameSnapshot, after: GameSnapshot): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    if (after.phase === 'roundOver' && before.phase !== 'roundOver') {
      this.clearBeatReadyVotes(room);
      if (room.settledSessionIds.has(room.sessionId)) {
        this.scheduleBeatNextRoundDeadline(room);
      }
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

  protected snapshot(room: RoomState): RoomSnapshot {
    const game = this.gameSnapshot(room);
    const beat =
      room.model.kind === 'beat-the-house'
        ? {
            rebetSeatIds: this.beatRebetSeatIds(room),
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

  protected resetServerManagedRoom(room: RoomState): AuthorityResult | undefined {
    const recovery = this.retryUnsettledBeatSettlement(room);
    if (recovery) {
      if (recovery.error) {
        return recovery;
      }
      this.resetServerManagedRoomState(room);
      return { broadcasts: [], settlements: recovery.settlements };
    }
    this.resetServerManagedRoomState(room);
    return undefined;
  }

  private resetServerManagedRoomState(room: RoomState): void {
    room.seats.clear();
    room.settledSessionIds.clear();
    room.lastBeatEvents = [];
    room.lastBeatBetOwners = {};
    room.beatHandOwners = {};
    room.sessionId = createSessionId();
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

  protected clearBeatReadyProfile(room: RoomState, profileId: ProfileId): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    room.model.readyProfileIds.delete(profileId);
    if (room.model.readyProfileIds.size === 0) {
      room.model.readyPhase = undefined;
    }
  }

  protected syncBeatBankroll(room: RoomState): void {
    if (room.model.kind !== 'beat-the-house') {
      return;
    }
    room.model.game.syncBankroll([...room.players.values()].reduce((total, player) => total + player.bankroll, 0));
  }

  protected beatReadyProfileIds(room: RoomState): readonly ProfileId[] {
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
    const recovery = this.retryUnsettledBeatSettlement(room);
    if (recovery) {
      return recovery;
    }
    room.sessionId = createSessionId();
    this.clearBeatReadiness(room);
    this.syncBeatBankroll(room);
    return this.ownerAction(room, () => (room.model.kind === 'beat-the-house' ? room.model.game.nextRound() : undefined));
  }

  private scheduleBeatNextRoundDeadline(room: RoomState): void {
    if (room.model.kind !== 'beat-the-house' || room.model.nextRoundDeadlineAt) {
      return;
    }
    const timeoutMs = beatNextRoundTimeoutMs();
    const deadlineAt = Date.now() + timeoutMs;
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
    }, timeoutMs);
    const parsedUnrefFunction = unrefFunctionSchema.safeParse(timer.unref);
    if (parsedUnrefFunction.success) {
      timer.unref();
    }
    room.model.nextRoundTimer = timer;
  }

  private retryUnsettledBeatSettlement(room: RoomState): AuthorityResult | undefined {
    if (room.model.kind !== 'beat-the-house' || room.model.game.snapshot().phase !== 'roundOver' || room.settledSessionIds.has(room.sessionId)) {
      return undefined;
    }
    try {
      const settlements = this.settleBeat(room, room.model.game.snapshot([...room.lastBeatEvents]));
      this.clearBeatReadyVotes(room);
      this.clearBeatNextRoundDeadline(room);
      this.scheduleBeatNextRoundDeadline(room);
      return this.broadcast(room, settlements);
    } catch {
      this.syncBeatBankroll(room);
      return { ...this.broadcast(room), error: 'Beat the House settlement is pending. Try again.' };
    }
  }

  protected seatIds(room: RoomState): readonly RoomSeatId[] {
    if (room.model.kind === 'beat-the-house') {
      return handIds;
    }
    return Array.from({ length: room.maxPlayers }, (_, index) => blackjackSeatIdSchema.parse(`seat-${index + 1}`));
  }

  protected profileSeatId(room: RoomState, profileId: ProfileId): RoomSeatId | undefined {
    return [...room.seats.entries()].find(([, owner]) => owner === profileId)?.[0];
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

  private beatRebetSeatIds(room: RoomState): readonly HandId[] {
    if (room.model.kind !== 'beat-the-house') {
      return [];
    }
    const snapshot = room.model.game.snapshot([...room.lastBeatEvents]);
    return handIds.filter((handId) => {
      const profileId = room.seats.get(handId);
      return Boolean(profileId && room.lastBeatBetOwners[handId] === profileId && snapshot.rebetAmounts[handId] > 0);
    });
  }

  protected blackjackOccupants(room: RoomState): readonly BlackjackTableOccupant[] {
    return this.seatIds(room).flatMap((candidateSeatId): BlackjackTableOccupant[] => {
      const parsedSeatId = blackjackSeatIdSchema.safeParse(candidateSeatId);
      if (!parsedSeatId.success) {
        return [];
      }
      const seatId: BlackjackSeatId = parsedSeatId.data;
      const profileId = room.seats.get(seatId);
      const player = profileId ? room.players.get(profileId) : undefined;
      return [{ seatId, profileId, profileName: player?.profileName, bankroll: player?.bankroll }];
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

  protected findRoomByConnection(connectionId: ConnectionId): RoomState | undefined {
    return [...this.rooms.values()].find((room) => room.connectionToMember.has(connectionId));
  }
}
