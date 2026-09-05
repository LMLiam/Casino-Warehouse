import type { DealerTips } from '../types/DealerTips';
import type { GameEvent } from '../types/GameEvent';
import type { GameSnapshot } from '../types/GameSnapshot';
import type { RoundSummary } from '../types/RoundSummary';
import { sideBetTypes } from '../types/sideBetTypes';
import { asHalfUnits } from '../beatTheHouse/asHalfUnits';
import { settleBeatTheHouseMain } from '../beatTheHouse/settlement/settleBeatTheHouseMain';
import { settleBeatTheHouseSideBets } from '../beatTheHouse/settlement/settleBeatTheHouseSideBets';
import { BeatTheHouseRound } from './BeatTheHouseRound';
import { BeatTheHouseState } from './BeatTheHouseState';

export abstract class BeatTheHouseSettlement extends BeatTheHouseRound {
  protected settle(previousEvents: GameEvent[]): GameSnapshot {
    let returnedHalfUnits = 0;
    const summaries: RoundSummary[] = [];
    const sideStates = BeatTheHouseState.emptySideStates();
    const dealerTipRewards = this.resolveDealerThanks();

    for (const handId of BeatTheHouseState.playableHands(this.bets)) {
      const hand = this.hands[handId];
      const bets = this.bets[handId];
      const playerFirstCard = hand.cards[0];
      const dealerFirstCard = this.dealer.cards[0];
      if (!playerFirstCard || !dealerFirstCard) {
        throw new Error('A settled Beat the House hand requires first cards.');
      }

      const main = settleBeatTheHouseMain({
        mainStake: bets.main,
        playerFirstCard,
        playerMode: hand.result === 'lose' ? 'immediateLoss' : hand.automaticWin ? 'automaticWin' : 'compare',
        playerFinalCard: hand.finalCard,
        dealerFirstCard,
        dealerBust: this.dealer.bust,
        dealerFinalCard: this.dealer.finalCard,
      });
      const side = settleBeatTheHouseSideBets({
        sideBets: {
          aceFlash: bets.aceFlash,
          dealerBust: bets.dealerBust,
          matchPush: bets.matchPush,
          dealerSevens: bets.dealerSevens,
        },
        mainResult: main.result,
        playerFirstCard,
        playerFinalCard: hand.finalCard,
        dealer: this.dealer,
      });
      const handReturnedHalfUnits = asHalfUnits(main.returnedHalfUnits + side.returnedHalfUnits);
      const handProfitHalfUnits = asHalfUnits(main.profitHalfUnits + side.profitHalfUnits);
      const handSideStates = BeatTheHouseState.emptySideState();
      for (const betType of sideBetTypes) {
        if (bets[betType] > 0) {
          handSideStates[betType] = 'lose';
        }
      }
      const sideWins = side.wins.map((win) => {
        handSideStates[win.betType] = 'win';
        const label =
          win.betType === 'dealerSevens'
            ? `Dealer Sevens (${this.dealer.cards.filter((card) => card.rank === '7').length})`
            : win.betType === 'aceFlash'
              ? 'Ace Flash'
              : win.betType === 'dealerBust'
                ? 'Dealer Bust'
                : 'Match Push';
        return {
          betType: win.betType,
          label,
          returnedHalfUnits: win.returnedHalfUnits,
          profitHalfUnits: win.profitHalfUnits,
          returned: win.returnedHalfUnits / 2,
          profit: win.profitHalfUnits / 2,
        };
      });

      this.hands[handId] = { ...hand, result: main.result };
      returnedHalfUnits += handReturnedHalfUnits;
      sideStates[handId] = handSideStates;
      const stake = BeatTheHouseState.handStake(this.bets, handId);
      summaries.push({
        handId,
        mainResult: main.result,
        stake,
        returnedHalfUnits: handReturnedHalfUnits,
        profitHalfUnits: handProfitHalfUnits,
        returned: handReturnedHalfUnits / 2,
        profit: handProfitHalfUnits / 2,
        sideWins,
      });
    }

    const dealerThanksTotal = BeatTheHouseState.totalDealerTips(dealerTipRewards);
    this.creditBankroll(returnedHalfUnits / 2 + dealerThanksTotal);
    this.summaries = summaries;
    this.sideStates = sideStates;
    this.dealerTipRewards = dealerTipRewards;
    this.phase = 'roundOver';
    const totalProfitHalfUnits = asHalfUnits(summaries.reduce((total, summary) => total + summary.profitHalfUnits, 0));
    const totalProfit = totalProfitHalfUnits / 2;
    const events: GameEvent[] = [...previousEvents, { type: 'round-settled', summaries, totalProfitHalfUnits, totalProfit, dealerThanksTotal }];
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
