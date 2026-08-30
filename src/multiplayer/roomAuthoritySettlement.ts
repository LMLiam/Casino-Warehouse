import type { BlackjackTableActionResult } from '../game/blackjackTable/BlackjackTableActionResult';
import type { BlackjackSnapshot } from '../game/blackjack/BlackjackSnapshot';
import type { SlotSnapshot } from '../game/slots/SlotSnapshot';
import type { GameSnapshot } from '../game/types/GameSnapshot';
import { handIds } from '../game/types/handIds';
import { blackjackSeatIdSchema } from '../schemas/casinoSchemas/blackjackSeatIdSchema';
import type { ProfileId } from '../schemas/casinoSchemas/ProfileId';
import type { RoomId } from '../schemas/casinoSchemas/RoomId';
import { createMemoryServerDataStore } from '../state/serverDataStore/createMemoryServerDataStore';
import type { ServerDataStore } from '../state/serverDataStore/ServerDataStore';
import type { RoomSettlement } from './protocol/RoomSettlement';
import type { RoomSeatId } from './protocol/RoomSeatId';
import type { RoomSnapshot } from './protocol/RoomSnapshot';
import type { AuthorityResult } from './roomAuthorityModel/AuthorityResult';
import { createSettlementId } from './roomAuthorityModel/createSettlementId';
import { createServerManagedBeatRoom } from './roomAuthorityModel/createServerManagedBeatRoom';
import { mainBeatRoomId } from './roomAuthorityModel/mainBeatRoomId';
import { safeBankroll } from './roomAuthorityModel/safeBankroll';
import type { RoomState } from './roomAuthorityModel/RoomState';
import { totalBeatStake } from './roomAuthorityModel/totalBeatStake';

export abstract class RoomAuthoritySettlement {
  protected readonly rooms = new Map<RoomId, RoomState>();
  protected asyncResultHandler: ((result: AuthorityResult) => void) | undefined;

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

  protected abstract snapshot(room: RoomState): RoomSnapshot;

  protected abstract afterBeatSnapshotChange(room: RoomState, before: GameSnapshot, after: GameSnapshot): void;

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
          id: createSettlementId(),
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
          id: createSettlementId(),
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
      const profileId = room.seats.get(settlement.seatId);
      if (!profileId) {
        return [];
      }
      const player = room.players.get(profileId);
      const houseAdvanceRepayment = player && settlement.returned > 0 ? this.applyPlayerSettlement(room, profileId, settlement.returned, settlement.profit) : 0;
      return [
        {
          id: createSettlementId(),
          profileId,
          seatId: settlement.seatId,
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
        id: createSettlementId(),
        profileId: player.profileId,
        seatId: this.profileSeatId(room, player.profileId) ?? blackjackSeatIdSchema.parse('seat-1'),
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

  protected applyPlayerSettlement(room: RoomState, profileId: ProfileId, returned: number, profit: number): number {
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

  protected error(message: string): AuthorityResult {
    return { broadcasts: [], settlements: [], error: message };
  }

  protected abstract profileSeatId(room: RoomState, profileId: ProfileId): RoomSeatId | undefined;
}
