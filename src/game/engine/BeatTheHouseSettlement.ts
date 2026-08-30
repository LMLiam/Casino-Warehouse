import { rankValue } from '../cards/rankValue';
import type { DealerTips } from '../types/DealerTips';
import type { GameEvent } from '../types/GameEvent';
import type { GameSnapshot } from '../types/GameSnapshot';
import type { RoundSummary } from '../types/RoundSummary';
import { resolveSideBets } from './beatTheHouseSideBetResolver';
import { BeatTheHouseRound } from './BeatTheHouseRound';
import { BeatTheHouseState } from './BeatTheHouseState';

export abstract class BeatTheHouseSettlement extends BeatTheHouseRound {
  protected settle(previousEvents: GameEvent[]): GameSnapshot {
    let returned = 0;
    const summaries: RoundSummary[] = [];
    const sideStates = BeatTheHouseState.emptySideStates();
    const dealerTipRewards = this.resolveDealerThanks();

    for (const handId of BeatTheHouseState.playableHands(this.bets)) {
      const hand = this.hands[handId];
      const bets = this.bets[handId];
      let handReturned = 0;
      let mainResult: RoundSummary['mainResult'] = 'lose';

      if (hand.result === 'lose') {
        mainResult = 'lose';
      } else if (hand.automaticWin) {
        mainResult = 'win';
        handReturned += BeatTheHouseState.wholeChipPayout(bets.main, 1).returned;
      } else if (this.dealer.blackAce) {
        mainResult = 'lose';
      } else if (this.dealer.bust) {
        mainResult = 'win';
        handReturned += BeatTheHouseState.wholeChipPayout(bets.main, 1).returned;
      } else {
        const playerFinalCard = hand.finalCard;
        const dealerFinalCard = this.dealer.finalCard;
        if (!playerFinalCard || !dealerFinalCard) {
          mainResult = 'push';
          handReturned += Math.floor(bets.main);
        } else {
          const playerValue = rankValue(playerFinalCard.rank);
          const dealerValue = rankValue(dealerFinalCard.rank);
          if (playerValue > dealerValue) {
            mainResult = 'win';
            handReturned += BeatTheHouseState.wholeChipPayout(bets.main, 1).returned;
          } else if (playerValue === dealerValue) {
            mainResult = 'push';
            handReturned += Math.floor(bets.main);
          }
        }
      }

      this.hands[handId] = { ...hand, result: mainResult };
      const sideResult = resolveSideBets(this.bets[handId], hand, this.dealer, mainResult, BeatTheHouseState.sideBetMultipliers);
      handReturned += sideResult.returned;
      returned += handReturned;
      sideStates[handId] = sideResult.states;

      const stake = BeatTheHouseState.handStake(this.bets, handId);
      summaries.push({
        handId,
        mainResult,
        stake,
        returned: handReturned,
        profit: handReturned - stake,
        sideWins: sideResult.wins,
      });
    }

    const dealerThanksTotal = BeatTheHouseState.totalDealerTips(dealerTipRewards);
    this.creditBankroll(returned + dealerThanksTotal);
    this.summaries = summaries;
    this.sideStates = sideStates;
    this.dealerTipRewards = dealerTipRewards;
    this.phase = 'roundOver';
    const totalProfit = summaries.reduce((total, summary) => total + summary.profit, 0);
    const events: GameEvent[] = [...previousEvents, { type: 'round-settled', summaries, totalProfit, dealerThanksTotal }];
    const thanksStatus = dealerThanksTotal > 0 ? ` Dealer's Thanks ${BeatTheHouseState.formatMoneyDelta(dealerThanksTotal)}.` : '';
    return this.emit(events, `Round complete. Total ${BeatTheHouseState.formatMoneyDelta(totalProfit)}.${thanksStatus}`);
  }

  private resolveDealerThanks(): DealerTips {
    return BeatTheHouseState.handRecord((handId) => {
      const tip = this.dealerTips[handId];
      return tip > 0 && this.randomInt(BeatTheHouseState.dealerThanksChanceDenominator) === BeatTheHouseState.dealerThanksWinningRoll
        ? tip * BeatTheHouseState.dealerThanksMultiplier
        : 0;
    });
  }
}
