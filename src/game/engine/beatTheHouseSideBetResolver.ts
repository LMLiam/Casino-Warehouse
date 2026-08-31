import { isBlackAce } from '../cards/isBlackAce';
import { rankValue } from '../cards/rankValue';
import type { Bets } from '../types/Bets';
import type { HandId } from '../types/HandId';
import type { PlayerHand } from '../types/PlayerHand';
import type { RoundSummary } from '../types/RoundSummary';
import type { SideStates } from '../types/SideStates';
import type { SideBetType } from '../types/SideBetType';
import type { GameSnapshot } from '../types/GameSnapshot';

export function resolveSideBets(
  bets: Bets[HandId],
  hand: PlayerHand,
  dealer: GameSnapshot['dealer'],
  mainResult: RoundSummary['mainResult'],
  sideBetMultipliers: {
    readonly aceFlashBoth: number;
    readonly aceFlashSingle: number;
    readonly dealerBust: number;
    readonly matchPush: number;
  },
): {
  readonly returned: number;
  readonly states: SideStates[HandId];
  readonly wins: RoundSummary['sideWins'];
} {
  const playerFirst = hand.cards[0];
  const dealerFirst = dealer.cards[0];
  const wins: RoundSummary['sideWins'] = [];
  const states: SideStates[HandId] = {
    aceFlash: bets.aceFlash > 0 ? 'lose' : 'idle',
    dealerBust: bets.dealerBust > 0 ? 'lose' : 'idle',
    matchPush: bets.matchPush > 0 ? 'lose' : 'idle',
    dealerSevens: bets.dealerSevens > 0 ? 'lose' : 'idle',
  };
  let returned = 0;

  const win = (betType: SideBetType, label: string, multiplier: number): void => {
    const stake = bets[betType];
    if (stake <= 0) {
      return;
    }

    const wholeStake = Math.floor(stake);
    const profit = Math.floor(wholeStake * multiplier);
    const amountReturned = wholeStake + profit;
    states[betType] = 'win';
    returned += amountReturned;
    wins.push({ betType, label, profit, returned: amountReturned });
  };

  if (bets.aceFlash > 0) {
    const playerAce = isBlackAce(playerFirst);
    const dealerAce = isBlackAce(dealerFirst);
    if (playerAce && dealerAce) {
      win('aceFlash', 'Ace Flash', sideBetMultipliers.aceFlashBoth);
    } else if (playerAce || dealerAce) {
      win('aceFlash', 'Ace Flash', sideBetMultipliers.aceFlashSingle);
    }
  }

  if (bets.dealerBust > 0 && dealer.bust) {
    win('dealerBust', 'Dealer Bust', sideBetMultipliers.dealerBust);
  }

  if (
    bets.matchPush > 0 &&
    mainResult !== 'lose' &&
    !dealer.bust &&
    !dealer.blackAce &&
    hand.finalCard &&
    dealer.finalCard &&
    rankValue(hand.finalCard.rank) === rankValue(dealer.finalCard.rank)
  ) {
    win('matchPush', 'Match Push', sideBetMultipliers.matchPush);
  }

  if (bets.dealerSevens > 0) {
    const sevenCount = dealer.cards.filter((card) => card.rank === '7').length;
    const multiplier = { 1: 3, 2: 18, 3: 150, 4: 1000 }[sevenCount] ?? 0; // casino-magic-number-allow: dealer sevens payout table
    if (multiplier > 0) {
      win('dealerSevens', `Dealer Sevens (${sevenCount})`, multiplier);
    }
  }

  return { returned, states, wins };
}
