import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { RoundSummary } from '../../game/types/RoundSummary';
import { sideBetTypes } from '../../game/types/sideBetTypes';
import { asHalfUnits } from '../../game/beatTheHouse/asHalfUnits';
import { formatHalfUnits } from '../../shared/formatHalfUnitMoney';
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

    const totalProfitHalfUnits = roundSettled?.totalProfitHalfUnits ?? snapshot.summaries.reduce((sum, summary) => sum + summary.profitHalfUnits, 0);
    const key = `${snapshot.dealer.cards.map((card) => `${card.rank}-${card.suit}`).join('|')}:${totalProfitHalfUnits}`;
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

  protected settlementAnnouncementForSnapshot(snapshot: GameSnapshot): string {
    return snapshot.summaries
      .map((summary) => {
        const popup = PixiTableSettlement.settlementPopupForSummary(snapshot, summary, this.settlementMetadata);
        return [popup.mainLine, popup.sideLine, ...popup.detailLines].join('. ');
      })
      .join('. ');
  }

  protected static settlementPopupForSummary(snapshot: GameSnapshot, summary: RoundSummary, settlementMetadata: readonly PixiTableSettlementMetadata[] = []) {
    const sideStake = sideBetTypes.reduce((total, betType) => total + snapshot.bets[summary.handId][betType], 0);
    const dealerThanks = snapshot.dealerTipRewards[summary.handId];
    const houseAdvanceRepayment = Math.max(0, settlementMetadata.find((metadata) => metadata.handId === summary.handId)?.houseAdvanceRepayment ?? 0);
    const houseAdvanceRepaymentHalfUnits = asHalfUnits(houseAdvanceRepayment + houseAdvanceRepayment);
    const dealerThanksHalfUnits = asHalfUnits(dealerThanks + dealerThanks);
    const netProfitHalfUnits = asHalfUnits(summary.profitHalfUnits - houseAdvanceRepaymentHalfUnits + dealerThanksHalfUnits);
    return {
      mainLine: `Main ${summary.mainResult.toUpperCase()} ${formatHalfUnits(summary.mainProfitHalfUnits, true)}`,
      sideLine: `Side bets ${sideStake > 0 ? PixiTableSettlement.netLabel(summary.sideProfitHalfUnits, 'EVEN') : 'NONE'} ${formatHalfUnits(summary.sideProfitHalfUnits, true)}`,
      detailLines: PixiTableSettlement.settlementDetailLines(
        summary.profitHalfUnits,
        houseAdvanceRepaymentHalfUnits,
        dealerThanksHalfUnits,
        netProfitHalfUnits,
      ),
      result: PixiTableSettlement.resultForProfit(netProfitHalfUnits),
    };
  }

  private static settlementDetailLines(
    profitHalfUnits: number,
    houseAdvanceRepaymentHalfUnits: number,
    dealerThanksHalfUnits: number,
    netProfitHalfUnits: number,
  ): string[] {
    if (houseAdvanceRepaymentHalfUnits <= 0 && dealerThanksHalfUnits <= 0) {
      return [`Total ${PixiTableSettlement.netLabel(profitHalfUnits, 'PUSH')} ${formatHalfUnits(asHalfUnits(profitHalfUnits), true)}`];
    }

    const openingLabel = houseAdvanceRepaymentHalfUnits > 0 ? 'Gross' : 'Gameplay';
    const adjustmentLines = [
      ...(houseAdvanceRepaymentHalfUnits > 0 ? [`House Advance payment ${formatHalfUnits(asHalfUnits(-houseAdvanceRepaymentHalfUnits))}`] : []),
      ...(dealerThanksHalfUnits > 0 ? [`Dealer's Thanks ${formatHalfUnits(asHalfUnits(dealerThanksHalfUnits), true)}`] : []),
    ];
    return [
      `${openingLabel} ${PixiTableSettlement.netLabel(profitHalfUnits, 'PUSH')} ${formatHalfUnits(asHalfUnits(profitHalfUnits), true)}`,
      ...adjustmentLines,
      `Net ${PixiTableSettlement.netLabel(netProfitHalfUnits, 'PUSH')} ${formatHalfUnits(asHalfUnits(netProfitHalfUnits), true)}`,
    ];
  }

  private static netLabel(profitHalfUnits: number, zeroLabel: string): string {
    if (profitHalfUnits > 0) {
      return 'WIN';
    }
    if (profitHalfUnits < 0) {
      return 'LOSE';
    }
    return zeroLabel;
  }

  private static resultForProfit(profitHalfUnits: number): RoundSummary['mainResult'] {
    if (profitHalfUnits > 0) {
      return 'win';
    }
    if (profitHalfUnits < 0) {
      return 'lose';
    }
    return 'push';
  }

  private static sideLinesForSummary(snapshot: GameSnapshot, summary: RoundSummary): string[] {
    return sideBetTypes.flatMap((betType) => {
      const stake = snapshot.bets[summary.handId][betType];
      const sideWin = summary.sideWins.find((win) => win.betType === betType);
      if (sideWin) {
        return [`${sideWin.label} WIN ${formatHalfUnits(sideWin.profitHalfUnits, true)}`];
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
