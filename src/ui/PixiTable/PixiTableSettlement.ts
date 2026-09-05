import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { RoundSummary } from '../../game/types/RoundSummary';
import { sideBetTypes } from '../../game/types/sideBetTypes';
import { CARD_ANIMATION } from '../renderers/renderingConstants/CARD_ANIMATION';
import type { PixiTableSettlementMetadata } from './PixiTableSettlementMetadata';
import { PixiTableBase } from './PixiTableBase';

export abstract class PixiTableSettlement extends PixiTableBase {
  protected static readonly settlementRevealPauseSeconds = 0.2;
  protected static readonly millisecondsPerSecond = 1000;

  protected abstract render(snapshot: GameSnapshot | undefined, settlementMetadata?: readonly PixiTableSettlementMetadata[]): void;

  protected prepareSettlementVisibility(snapshot: GameSnapshot): void {
    const roundSettled = snapshot.lastEvents.find((event) => event.type === 'round-settled');
    if (snapshot.phase !== 'roundOver' || snapshot.summaries.length === 0) {
      return;
    }

    const totalProfit = roundSettled?.totalProfit ?? snapshot.summaries.reduce((sum, summary) => sum + summary.profit, 0);
    const key = `${snapshot.dealer.cards.map((card) => `${card.rank}-${card.suit}`).join('|')}:${totalProfit}`;
    if (this.settlementKey === key) {
      return;
    }

    this.settlementKey = key;
    this.settlementVisible = false;
    window.clearTimeout(this.settlementTimer);
    this.settlementTimer = window.setTimeout(
      () => {
        this.settlementVisible = true;
        this.render(this.snapshot);
      },
      PixiTableSettlement.prefersReducedMotion() ? 0 : PixiTableSettlement.settlementRevealDelay(this.cardAnimationQueue),
    );
  }

  protected shouldShowSettlement(snapshot: GameSnapshot): boolean {
    return snapshot.phase === 'roundOver' && this.settlementVisible;
  }

  protected settledSideBetLabels(snapshot: GameSnapshot): string[] {
    if (!this.shouldShowSettlement(snapshot)) {
      return [];
    }

    return snapshot.summaries.flatMap((summary) => PixiTableSettlement.sideLinesForSummary(snapshot, summary));
  }

  protected static formatProfit(profit: number): string {
    return `${profit >= 0 ? '+' : '-'}£${Math.abs(profit)}`;
  }

  protected static settlementPopupForSummary(snapshot: GameSnapshot, summary: RoundSummary, settlementMetadata: readonly PixiTableSettlementMetadata[] = []) {
    const sideStake = sideBetTypes.reduce((total, betType) => total + snapshot.bets[summary.handId][betType], 0);
    const dealerThanks = snapshot.dealerTipRewards[summary.handId];
    const mainProfit = PixiTableSettlement.mainProfitForSummary(snapshot, summary);
    const sideProfit = summary.profit - mainProfit;
    const houseAdvanceRepayment = Math.max(
      0,
      Math.floor(settlementMetadata.find((metadata) => metadata.handId === summary.handId)?.houseAdvanceRepayment ?? 0),
    );
    const netProfit = summary.profit - houseAdvanceRepayment + dealerThanks;
    return {
      mainLine: `Main ${summary.mainResult.toUpperCase()} ${PixiTableSettlement.formatProfit(mainProfit)}`,
      sideLine: `Side bets ${sideStake > 0 ? PixiTableSettlement.netLabel(sideProfit, 'EVEN') : 'NONE'} ${PixiTableSettlement.formatProfit(sideProfit)}`,
      detailLines: PixiTableSettlement.settlementDetailLines(summary.profit, houseAdvanceRepayment, dealerThanks, netProfit),
      result: PixiTableSettlement.resultForProfit(netProfit),
    };
  }

  private static settlementDetailLines(profit: number, houseAdvanceRepayment: number, dealerThanks: number, netProfit: number): string[] {
    if (houseAdvanceRepayment <= 0 && dealerThanks <= 0) {
      return [`Total ${PixiTableSettlement.netLabel(profit, 'PUSH')} ${PixiTableSettlement.formatProfit(profit)}`];
    }

    const openingLabel = houseAdvanceRepayment > 0 ? 'Gross' : 'Gameplay';
    const adjustmentLines = [
      ...(houseAdvanceRepayment > 0 ? [`House Advance payment -£${houseAdvanceRepayment}`] : []),
      ...(dealerThanks > 0 ? [`Dealer's Thanks +£${dealerThanks}`] : []),
    ];
    return [
      `${openingLabel} ${PixiTableSettlement.netLabel(profit, 'PUSH')} ${PixiTableSettlement.formatProfit(profit)}`,
      ...adjustmentLines,
      `Net ${PixiTableSettlement.netLabel(netProfit, 'PUSH')} ${PixiTableSettlement.formatProfit(netProfit)}`,
    ];
  }

  protected static mainProfitForSummary(snapshot: GameSnapshot, summary: RoundSummary): number {
    const sideStakeHalfUnits = sideBetTypes.reduce((total, betType) => total + snapshot.bets[summary.handId][betType] * 2, 0);
    const sideReturnedHalfUnits = summary.sideWins.reduce((total, win) => total + win.returnedHalfUnits, 0);
    return (summary.profitHalfUnits - (sideReturnedHalfUnits - sideStakeHalfUnits)) / 2;
  }

  private static netLabel(profit: number, zeroLabel: string): string {
    if (profit > 0) {
      return 'WIN';
    }
    if (profit < 0) {
      return 'LOSE';
    }
    return zeroLabel;
  }

  private static resultForProfit(profit: number): RoundSummary['mainResult'] {
    if (profit > 0) {
      return 'win';
    }
    if (profit < 0) {
      return 'lose';
    }
    return 'push';
  }

  private static sideLinesForSummary(snapshot: GameSnapshot, summary: RoundSummary): string[] {
    return sideBetTypes.flatMap((betType) => {
      const stake = snapshot.bets[summary.handId][betType];
      const sideWin = summary.sideWins.find((win) => win.betType === betType);
      if (sideWin) {
        return [`${sideWin.label} WIN +£${sideWin.profit}`];
      }
      return stake > 0 && snapshot.sideStates[summary.handId][betType] === 'lose' ? [`${PixiTableSettlement.betTypeLabel(betType)} LOSE -£${stake}`] : [];
    });
  }

  private static settlementRevealDelay(queue: ReadonlyMap<string, number>): number {
    const maxOrder = Math.max(0, ...queue.values());
    return (
      (maxOrder * CARD_ANIMATION.delayStep + CARD_ANIMATION.duration + PixiTableSettlement.settlementRevealPauseSeconds) *
      PixiTableSettlement.millisecondsPerSecond
    );
  }

  private static betTypeLabel(betType: (typeof sideBetTypes)[number]): string {
    return {
      aceFlash: 'Ace Flash',
      dealerBust: 'Dealer Bust',
      matchPush: 'Match Push',
      dealerSevens: 'Dealer Sevens',
    }[betType];
  }

  private static prefersReducedMotion(): boolean {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }
}
