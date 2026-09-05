import { Graphics } from 'pixi.js';
import type { BetType } from '../../game/types/BetType';
import { betTypes } from '../../game/types/betTypes';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { HandId } from '../../game/types/HandId';
import { dealerChipBank } from '../layout/dealerChipBank';
import { dealerSlots } from '../layout/dealerSlots';
import { handLayouts } from '../layout/handLayouts';
import { rectToPixels } from '../layout/rectToPixels';
import { toPixels } from '../layout/toPixels';
import { BET_RENDERING } from '../renderers/renderingConstants/BET_RENDERING';
import { COLORS } from '../renderers/renderingConstants/COLORS';
import { SIDE_WIN_EFFECT } from '../renderers/renderingConstants/SIDE_WIN_EFFECT';
import { shouldShowWagerIndicators } from './shouldShowWagerIndicators';
import { PixiTableSettlement } from './PixiTableSettlement';

export abstract class PixiTableDrawing extends PixiTableSettlement {
  protected static readonly sideWinTagVerticalScale = 0.14;
  protected static readonly liveBetChipRadius = 22;

  protected drawBettingZones(snapshot: GameSnapshot): void {
    const wagerAmounts: string[] = [];
    for (const hand of handLayouts) {
      for (const betType of betTypes) {
        const zone = hand.zones[betType];
        const px = rectToPixels(zone);
        const centerX = px.x + px.width / 2;
        const centerY = px.y + px.height / 2;
        this.drawBettingZone(snapshot, hand.id, betType, centerX, centerY, px.width, px.height);

        if (betType !== 'main' && snapshot.phase === 'roundOver' && this.shouldShowSettlement(snapshot)) {
          const sideWin = snapshot.summaries.find((summary) => summary.handId === hand.id)?.sideWins.find((win) => win.betType === betType);
          const isWagered = snapshot.bets[hand.id][betType] > 0;
          if (sideWin) {
            this.effectRenderer.drawSideBetWin(centerX, centerY, px.width, px.height, isWagered);
            this.tagRenderer.drawPayoutTag(
              sideWin.label,
              centerX,
              px.y + px.height * PixiTableDrawing.sideWinTagVerticalScale,
              'win',
              isWagered ? 1 : SIDE_WIN_EFFECT.unwageredTagAlpha,
            );
          }
        }

        if (snapshot.phase === 'roundOver' && this.shouldShowSettlement(snapshot)) {
          this.drawResolvedBet(snapshot, hand.id, betType, centerX, centerY);
          continue;
        }

        if (betType === 'main' && snapshot.phase !== 'roundOver' && snapshot.hands[hand.id].automaticWin) {
          const amount = snapshot.bets[hand.id].main;
          this.chipRenderer?.drawStack(amount, centerX + BET_RENDERING.mainWagerOffsetX, centerY, BET_RENDERING.mainChipRadius);
          this.drawDealerPayout(
            amount,
            centerX + BET_RENDERING.mainPayoutOffsetX,
            centerY,
            BET_RENDERING.mainChipRadius,
            `automatic-payout-${hand.id}-main-${amount}`,
          );
          this.tagRenderer.drawPayoutTag(`PAID +£${amount}`, centerX + BET_RENDERING.mainPayoutOffsetX, centerY + BET_RENDERING.sideLabelOffsetY, 'win');
          continue;
        }

        const amount = snapshot.bets[hand.id][betType];
        if (amount > 0 && this.shouldShowLiveBet(snapshot, hand.id, betType)) {
          this.chipRenderer?.drawStack(amount, centerX, centerY, PixiTableDrawing.liveBetChipRadius, `bet-${hand.id}-${betType}-${amount}`);
        }

        if (amount > 0 && shouldShowWagerIndicators(snapshot) && this.shouldShowLiveBet(snapshot, hand.id, betType)) {
          this.tagRenderer.drawMarker(`£${amount}`, centerX, centerY + BET_RENDERING.wagerAmountOffsetY);
          wagerAmounts.push(`${hand.id}:${betType}:${amount}`);
        }
      }
      const tipPx = rectToPixels(hand.tipZone);
      const tipX = tipPx.x + tipPx.width / 2;
      const tipY = tipPx.y + tipPx.height / 2;
      this.drawDealerTipZone(snapshot, hand.id, tipX, tipY, tipPx.width, tipPx.height);
      this.drawDealerThanksPayout(snapshot, hand.id, tipX, tipY);
    }
    this.host.dataset.wagerAmounts = JSON.stringify(wagerAmounts);
  }

  protected drawHands(snapshot: GameSnapshot): void {
    for (const hand of handLayouts) {
      const playerHand = snapshot.hands[hand.id];
      if (!playerHand) {
        continue;
      }
      playerHand.cards.forEach((card, index) => {
        const layoutPoint = hand.cards[index];
        if (!layoutPoint) {
          return;
        }
        const point = toPixels(layoutPoint);
        this.cardRenderer.drawCard(
          card,
          point.x,
          point.y,
          playerHand.result === 'win' && snapshot.phase === 'roundOver',
          `player-${hand.id}-${index}`,
          this.cardAnimationQueue.get(`player-${hand.id}-${index}`),
        );
      });

      if (playerHand.cards.length > 0) {
        const point = toPixels(hand.marker);
        const label =
          playerHand.result === 'lose' && snapshot.phase !== 'roundOver'
            ? 'LOSE'
            : playerHand.automaticWin && snapshot.phase !== 'roundOver'
              ? 'BLACK ACE'
              : snapshot.activeHand === hand.id
                ? 'PLAYING'
                : '';
        this.tagRenderer.drawMarker(label, point.x, point.y, playerHand.result);
      }
    }
  }

  protected drawDealer(snapshot: GameSnapshot): void {
    if (!snapshot.dealer.holeRevealed && snapshot.phase !== 'betting') {
      const dealerHolePoint = dealerSlots[0];
      if (!dealerHolePoint) {
        return;
      }
      const point = toPixels(dealerHolePoint);
      this.cardRenderer.drawBack(point.x, point.y, 'dealer-hole', this.cardAnimationQueue.get('dealer-hole'));
    }

    snapshot.dealer.cards.forEach((card, index) => {
      const dealerPoint = dealerSlots[index];
      if (!dealerPoint) {
        return;
      }
      const point = toPixels(dealerPoint);
      if (index === 0 && snapshot.dealer.holeRevealed) {
        this.cardRenderer.drawRevealedCard(
          card,
          point.x,
          point.y,
          false,
          'dealer-hole',
          'dealer-hole-reveal',
          this.cardAnimationQueue.get('dealer-hole-reveal'),
        );
        return;
      }
      this.cardRenderer.drawCard(card, point.x, point.y, false, `dealer-${index}`, this.cardAnimationQueue.get(`dealer-${index}`));
    });
  }

  protected drawRoundSummaries(snapshot: GameSnapshot): void {
    for (const summary of snapshot.summaries) {
      const layout = handLayouts.find((hand) => hand.id === summary.handId);
      if (!layout) {
        continue;
      }

      const point = toPixels(layout.popup);
      const popup = PixiTableSettlement.settlementPopupForSummary(snapshot, summary, this.settlementMetadata);
      this.tagRenderer.drawResultPopup(
        popup.mainLine,
        popup.sideLine,
        popup.detailLines,
        point.x,
        point.y,
        popup.result,
        summary.sideWins.some((win) => win.betType === 'dealerSevens'),
      );
    }
  }

  private drawBettingZone(snapshot: GameSnapshot, handId: HandId, betType: BetType, x: number, y: number, width: number, height: number): void {
    const isActive = snapshot.activeHand === handId;
    const isBettable = snapshot.phase === 'betting' && this.selectedChip > 0 && (betType === 'main' || snapshot.bets[handId].main > 0);
    const graphics = new Graphics();
    graphics.ellipse(x, y, width / 2, height / 2);
    graphics.fill({
      color: COLORS.gold,
      alpha: isBettable ? BET_RENDERING.zoneBettableAlpha : snapshot.phase === 'betting' ? BET_RENDERING.zoneIdleAlpha : BET_RENDERING.zoneInvalidAlpha,
    });
    graphics.stroke({
      color: isActive ? COLORS.white : COLORS.gold,
      width: isActive ? BET_RENDERING.activeZoneStrokeWidth : BET_RENDERING.zoneStrokeWidth,
      alpha:
        isBettable || isActive
          ? BET_RENDERING.zoneBettableStrokeAlpha
          : snapshot.phase === 'betting'
            ? BET_RENDERING.zoneIdleStrokeAlpha
            : BET_RENDERING.zoneInvalidStrokeAlpha,
    });
    graphics.eventMode = isBettable ? 'static' : 'none';
    graphics.cursor = isBettable ? 'pointer' : 'default';
    graphics.on('pointertap', () => {
      if (isBettable) {
        this.options.onBet(handId, betType);
      }
    });
    graphics.on('pointerover', () => {
      if (isBettable) {
        graphics.alpha = BET_RENDERING.hoverAlpha;
      }
    });
    graphics.on('pointerout', () => {
      graphics.alpha = 1;
    });
    this.zoneLayer.addChild(graphics);
  }

  private drawDealerTipZone(snapshot: GameSnapshot, handId: HandId, x: number, y: number, width: number, height: number): void {
    const amount = snapshot.dealerTips[handId];
    const isBettable = snapshot.phase === 'betting' && this.selectedChip > 0;
    const graphics = new Graphics();
    graphics.ellipse(x, y, width / 2, height / 2);
    graphics.fill({
      color: COLORS.gold,
      alpha: isBettable ? BET_RENDERING.zoneBettableAlpha : snapshot.phase === 'betting' ? BET_RENDERING.zoneIdleAlpha : BET_RENDERING.zoneInvalidAlpha,
    });
    graphics.stroke({
      color: COLORS.gold,
      width: BET_RENDERING.zoneStrokeWidth,
      alpha: isBettable
        ? BET_RENDERING.zoneBettableStrokeAlpha
        : snapshot.phase === 'betting'
          ? BET_RENDERING.zoneIdleStrokeAlpha
          : BET_RENDERING.zoneInvalidStrokeAlpha,
    });
    graphics.eventMode = isBettable ? 'static' : 'none';
    graphics.cursor = isBettable ? 'pointer' : 'default';
    graphics.on('pointertap', () => {
      if (isBettable) {
        this.options.onBet(handId, 'dealerTip');
      }
    });
    graphics.on('pointerover', () => {
      if (isBettable) {
        graphics.alpha = BET_RENDERING.hoverAlpha;
      }
    });
    graphics.on('pointerout', () => {
      graphics.alpha = 1;
    });
    this.zoneLayer.addChild(graphics);

    if (amount > 0 && snapshot.phase === 'betting') {
      this.chipRenderer?.drawStack(amount, x, y, PixiTableDrawing.liveBetChipRadius, `tip-${handId}-${amount}`);
    }
  }

  private drawDealerThanksPayout(snapshot: GameSnapshot, handId: HandId, x: number, y: number): void {
    const amount = snapshot.dealerTipRewards[handId];
    if (amount <= 0 || !this.shouldShowSettlement(snapshot)) {
      return;
    }

    this.drawDealerPayout(amount, x, y, BET_RENDERING.sideChipRadius, `dealer-thanks-${handId}-${amount}`);
  }

  private drawResolvedBet(snapshot: GameSnapshot, handId: HandId, betType: BetType, x: number, y: number): void {
    const amount = snapshot.bets[handId][betType];
    if (amount <= 0 || !this.chipRenderer) {
      return;
    }

    const summary = snapshot.summaries.find((item) => item.handId === handId);
    if (!summary) {
      return;
    }

    if (betType === 'main') {
      if (summary.mainResult === 'lose') {
        this.drawDealerCollection(amount, x + BET_RENDERING.mainWagerOffsetX, y, BET_RENDERING.mainChipRadius, `loss-${handId}-main-${amount}`);
        return;
      }

      this.chipRenderer.drawStack(amount, x + BET_RENDERING.mainWagerOffsetX, y, BET_RENDERING.mainChipRadius);
      if (summary.mainResult === 'win') {
        const mainProfit = PixiTableSettlement.mainProfitForSummary(snapshot, summary);
        this.drawDealerPayout(mainProfit, x + BET_RENDERING.mainPayoutOffsetX, y, BET_RENDERING.mainChipRadius, `payout-${handId}-main-${mainProfit}`);
        this.tagRenderer.drawPayoutTag(`PAID +£${mainProfit}`, x + BET_RENDERING.mainPayoutOffsetX, y + BET_RENDERING.sideLabelOffsetY, 'win');
      } else {
        this.tagRenderer.drawPayoutTag('PUSH', x + BET_RENDERING.mainPayoutOffsetX / 2, y + BET_RENDERING.sideLabelOffsetY, 'push');
      }
      return;
    }

    const sideState = snapshot.sideStates[handId][betType];
    if (sideState === 'lose') {
      this.drawDealerCollection(amount, x + BET_RENDERING.sideWagerOffsetX, y, BET_RENDERING.sideChipRadius, `loss-${handId}-${betType}-${amount}`);
      this.tagRenderer.drawPayoutTag(`-£${amount}`, x, y, 'lose');
      this.tagRenderer.drawSideState('lose', x, y + BET_RENDERING.sideLabelOffsetY);
      return;
    }

    if (sideState === 'win') {
      const sideWin = summary.sideWins.find((win) => win.betType === betType);
      this.chipRenderer.drawStack(amount, x + BET_RENDERING.sideWagerOffsetX, y, BET_RENDERING.sideChipRadius);
      if (sideWin) {
        this.drawDealerPayout(
          sideWin.profit,
          x + BET_RENDERING.sidePayoutOffsetX,
          y,
          BET_RENDERING.sideChipRadius,
          `payout-${handId}-${betType}-${sideWin.profit}`,
        );
        this.tagRenderer.drawPayoutTag(`+£${sideWin.profit}`, x + BET_RENDERING.sidePayoutOffsetX, y + BET_RENDERING.sideLabelOffsetY, 'win');
      }
      this.tagRenderer.drawSideState('win', x + BET_RENDERING.sideWagerOffsetX, y + BET_RENDERING.sideLabelOffsetY);
    }
  }

  private drawDealerCollection(amount: number, x: number, y: number, radius: number, key: string): void {
    const bank = toPixels(dealerChipBank);
    this.chipRenderer?.drawStack(amount, x, y, radius, { key, to: bank });
  }

  private drawDealerPayout(amount: number, x: number, y: number, radius: number, key: string): void {
    const bank = toPixels(dealerChipBank);
    this.chipRenderer?.drawStack(amount, x, y, radius, { key, from: bank });
  }

  private shouldShowLiveBet(snapshot: GameSnapshot, handId: HandId, betType: BetType): boolean {
    if (betType === 'main' && snapshot.hands[handId].result === 'lose') {
      return false;
    }

    return true;
  }
}
