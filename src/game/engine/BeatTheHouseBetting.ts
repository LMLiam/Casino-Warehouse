import type { GameSnapshot } from '../types/GameSnapshot';
import type { HandId } from '../types/HandId';
import type { BetType } from '../types/BetType';
import { betTypeLabel } from './betTypeLabel';
import { BeatTheHouseState } from './BeatTheHouseState';
import { isSideBetWithinMainBet } from './isSideBetWithinMainBet';

export abstract class BeatTheHouseBetting extends BeatTheHouseState {
  public placeDealerTip(handId: HandId, amount: number): GameSnapshot {
    const wholeAmount = Math.floor(amount);
    if (this.phase !== 'betting' || wholeAmount <= 0) {
      return this.snapshot();
    }

    if (this.bankroll < wholeAmount) {
      return this.emit([{ type: 'message', message: `Need £${wholeAmount} available.` }], `Need £${wholeAmount} available.`);
    }

    this.debitBankroll(wholeAmount);
    this.dealerTips[handId] += wholeAmount;
    this.dealerTipRewards = BeatTheHouseState.emptyDealerTips();
    this.summaries = [];
    return this.emit(
      [{ type: 'dealer-tip-placed', handId, amount: wholeAmount }],
      `${BeatTheHouseState.handName[handId]} dealer tip: £${this.dealerTips[handId]}.`,
    );
  }

  public placeBet(handId: HandId, betType: BetType, amount: number): GameSnapshot {
    if (this.phase !== 'betting' || amount <= 0) {
      return this.snapshot();
    }

    if (betType !== 'main' && this.bets[handId].main <= 0) {
      return this.emit([{ type: 'message', message: 'Side bets need a main bet on the same hand.' }], 'Side bets need a main bet on the same hand.');
    }

    if (betType !== 'main' && !isSideBetWithinMainBet(this.bets[handId].main, this.bets[handId][betType], amount)) {
      return this.emit(
        [{ type: 'message', message: 'Side bets cannot exceed the main bet on the same hand.' }],
        'Side bets cannot exceed the main bet on the same hand.',
      );
    }

    if (this.bankroll < amount) {
      return this.emit([{ type: 'message', message: `Need £${amount} available.` }], `Need £${amount} available.`);
    }

    this.debitBankroll(amount);
    this.bets[handId][betType] += amount;
    this.summaries = [];
    return this.emit(
      [{ type: 'bet-placed', handId, betType, amount }],
      `${BeatTheHouseState.handName[handId]} ${betTypeLabel(betType)} bet: £${this.bets[handId][betType]}.`,
    );
  }

  public clearBets(): GameSnapshot {
    if (this.phase !== 'betting') {
      return this.snapshot();
    }

    this.creditBankroll(BeatTheHouseState.totalBet(this.bets));
    this.creditBankroll(BeatTheHouseState.totalDealerTips(this.dealerTips));
    this.bets = BeatTheHouseState.emptyBets();
    this.dealerTips = BeatTheHouseState.emptyDealerTips();
    this.dealerTipRewards = BeatTheHouseState.emptyDealerTips();
    this.summaries = [];
    this.sideStates = BeatTheHouseState.emptySideStates();
    return this.emit([{ type: 'bets-cleared' }], 'Bets cleared.');
  }

  public clearHandBets(handId: HandId): GameSnapshot {
    if (this.phase !== 'betting') {
      return this.snapshot();
    }

    const refund = BeatTheHouseState.handStake(this.bets, handId) + this.dealerTips[handId];
    if (refund <= 0) {
      return this.snapshot();
    }

    this.creditBankroll(refund);
    this.bets[handId] = BeatTheHouseState.emptyHandBets();
    this.dealerTips[handId] = 0;
    this.dealerTipRewards[handId] = 0;
    this.summaries = [];
    this.sideStates[handId] = BeatTheHouseState.emptySideState();
    return this.emit([{ type: 'bets-cleared', handId }], `${BeatTheHouseState.handName[handId]} bets cleared.`);
  }

  public rebet(): GameSnapshot {
    const savedBets = this.lastBets;
    if (!savedBets || !BeatTheHouseState.hasValidSideBetCaps(savedBets)) {
      return this.emit([{ type: 'message', message: 'No previous bet saved.' }], 'No previous bet saved.');
    }

    const requiredBankroll = BeatTheHouseState.totalBet(savedBets);
    if (this.bankroll < requiredBankroll) {
      return this.emit([{ type: 'message', message: `Need £${requiredBankroll} to rebet.` }], `Need £${requiredBankroll} to rebet.`);
    }

    this.clearBets();
    this.bets = BeatTheHouseState.cloneBets(savedBets);
    this.debitBankroll(requiredBankroll);
    return this.emit([{ type: 'message', message: `Rebet £${requiredBankroll} placed.` }], `Rebet £${requiredBankroll} placed. Press deal.`);
  }

  public rebetHand(handId: HandId): GameSnapshot {
    const savedBets = this.lastBets;
    if (!savedBets || !BeatTheHouseState.hasValidSideBetCaps(savedBets)) {
      return this.emit([{ type: 'message', message: 'No previous bet saved.' }], 'No previous bet saved.');
    }

    const requiredBankroll = BeatTheHouseState.handStake(savedBets, handId);
    if (requiredBankroll <= 0) {
      return this.emit([{ type: 'message', message: 'No previous bet saved for this seat.' }], 'No previous bet saved for this seat.');
    }

    if (this.bankroll < requiredBankroll) {
      return this.emit([{ type: 'message', message: `Need £${requiredBankroll} to rebet.` }], `Need £${requiredBankroll} to rebet.`);
    }

    this.clearHandBets(handId);
    this.bets[handId] = { ...savedBets[handId] };
    this.debitBankroll(requiredBankroll);
    return this.emit([{ type: 'message', message: `Rebet £${requiredBankroll} placed.` }], `Rebet £${requiredBankroll} placed. Press deal.`);
  }

  protected canRebet(): boolean {
    const savedBets = this.lastBets;
    return (
      this.phase === 'betting' &&
      Boolean(savedBets) &&
      BeatTheHouseState.hasValidSideBetCaps(savedBets ?? BeatTheHouseState.emptyBets()) &&
      BeatTheHouseState.totalBet(this.bets) === 0 &&
      BeatTheHouseState.totalDealerTips(this.dealerTips) === 0 &&
      BeatTheHouseState.totalBet(savedBets ?? BeatTheHouseState.emptyBets()) <= this.bankroll
    );
  }

  protected rebetAmounts(): Record<HandId, number> {
    const savedBets = this.lastBets;
    if (!savedBets || !BeatTheHouseState.hasValidSideBetCaps(savedBets)) {
      return BeatTheHouseState.handRecord(() => 0);
    }
    return BeatTheHouseState.handRecord((handId) => BeatTheHouseState.handStake(savedBets, handId));
  }
}
