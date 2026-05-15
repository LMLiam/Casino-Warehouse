import 'pixi.js/unsafe-eval';
import { Application, Assets, Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { beatTheHouseChipsUrl } from '../../assets/tableAssets/beatTheHouseChipsUrl';
import { beatTheHouseTableUrl } from '../../assets/tableAssets/beatTheHouseTableUrl';
import type { BetType } from '../../game/types/BetType';
import { betTypes } from '../../game/types/betTypes';
import type { GameEvent } from '../../game/types/GameEvent';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import type { HandId } from '../../game/types/HandId';
import type { RoundSummary } from '../../game/types/RoundSummary';
import { chipCropByValue } from '../chips/chipCropByValue';
import type { ChipValue } from '../chips/ChipValue';
import { chipValues } from '../chips/chipValues';
import { dealerChipBank } from '../layout/dealerChipBank';
import { dealerSlots } from '../layout/dealerSlots';
import { handLayouts } from '../layout/handLayouts';
import { rectToPixels } from '../layout/rectToPixels';
import { tableSize } from '../layout/tableSize';
import { toPixels } from '../layout/toPixels';
import { CardRenderer } from '../renderers/CardRenderer';
import { ChipRenderer } from '../renderers/ChipRenderer';
import { EffectRenderer } from '../renderers/EffectRenderer';
import { BET_RENDERING } from '../renderers/renderingConstants/BET_RENDERING';
import { CARD_ANIMATION } from '../renderers/renderingConstants/CARD_ANIMATION';
import { COLORS } from '../renderers/renderingConstants/COLORS';
import { SIDE_WIN_EFFECT } from '../renderers/renderingConstants/SIDE_WIN_EFFECT';
import { TagRenderer } from '../renderers/TagRenderer';
import type { PixiTableDependencies } from './PixiTableDependencies';
import type { PixiTableOptions } from './PixiTableOptions';
import type { PixiTableSettlementMetadata } from './PixiTableSettlementMetadata';
import { roundStartAnimationKey } from './roundStartAnimationKey';

export class PixiTable {
  private static readonly sideWinTagVerticalScale = 0.14;
  private static readonly liveBetChipRadius = 22;
  private static readonly settlementRevealPauseSeconds = 0.2;
  private static readonly millisecondsPerSecond = 1000;

  private readonly app = new Application();
  private readonly root = new Container();
  private readonly dynamicLayer = new Container();
  private readonly zoneLayer = new Container();
  private readonly effectLayer = new Container();
  private readonly cardLayer = new Container();
  private readonly cardRenderer: CardRenderer;
  private readonly tagRenderer: TagRenderer;
  private readonly effectRenderer: EffectRenderer;
  private chipRenderer?: ChipRenderer;
  private selectedChip = 0;
  private snapshot?: GameSnapshot;
  private cardAnimationQueue = new Map<string, number>();
  private processedRoundStartKey = '';
  private settlementKey = '';
  private celebratedSettlementKey = '';
  private settlementMetadata: readonly PixiTableSettlementMetadata[] = [];
  private settlementVisible = false;
  private settlementTimer?: number;
  private initialized = false;

  public constructor(
    private readonly host: HTMLElement,
    private readonly options: PixiTableOptions,
    private readonly dependencies: PixiTableDependencies,
  ) {
    this.cardRenderer = dependencies.createCardRenderer(this.cardLayer);
    this.tagRenderer = dependencies.createTagRenderer(this.dynamicLayer);
    this.effectRenderer = dependencies.createEffectRenderer(this.effectLayer);
  }

  public async init(): Promise<void> {
    await this.app.init({
      resizeTo: this.host,
      background: '#050403',
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    this.host.append(this.app.canvas);
    this.app.stage.addChild(this.root);
    this.root.addChild(this.zoneLayer, this.effectLayer, this.cardLayer, this.dynamicLayer);

    const [tableTexture, chipSheet] = await Promise.all([Assets.load<Texture>(beatTheHouseTableUrl), Assets.load<Texture>(beatTheHouseChipsUrl)]);
    this.chipRenderer = this.dependencies.createChipRenderer(this.dynamicLayer, PixiTable.createChipTextures(chipSheet));
    const table = new Sprite(tableTexture);
    table.width = tableSize.width;
    table.height = tableSize.height;
    this.root.addChildAt(table, 0);
    this.app.renderer.on('resize', () => this.layout());
    this.layout();
    this.initialized = true;
  }

  public setSelectedChip(value: number): void {
    this.selectedChip = value;
    this.render(this.snapshot);
  }

  public resize(): void {
    if (!this.initialized) {
      return;
    }
    this.app.resize();
    this.layout();
  }

  public toggleDebugOverlay(): void {
    this.host.classList.toggle('layout-debug');
  }

  public render(snapshot: GameSnapshot | undefined, settlementMetadata: readonly PixiTableSettlementMetadata[] = this.settlementMetadata): void {
    this.settlementMetadata = settlementMetadata;
    if (!snapshot || !this.initialized || !this.chipRenderer) {
      return;
    }

    this.snapshot = snapshot;
    this.zoneLayer.removeChildren();
    this.dynamicLayer.removeChildren();
    this.effectLayer.removeChildren();
    this.cardRenderer.beginFrame();
    const roundStartKey = roundStartAnimationKey(snapshot);
    if (roundStartKey && roundStartKey !== this.processedRoundStartKey) {
      this.processedRoundStartKey = roundStartKey;
      this.cardRenderer.clearAnimations();
      this.chipRenderer.clearAnimations();
      this.settlementKey = '';
      this.celebratedSettlementKey = '';
      this.settlementVisible = false;
      window.clearTimeout(this.settlementTimer);
    }
    if (snapshot.phase === 'betting') {
      if (this.processedRoundStartKey) {
        this.chipRenderer.clearAnimations();
      }
      this.processedRoundStartKey = '';
      this.settlementKey = '';
      this.celebratedSettlementKey = '';
      this.settlementVisible = false;
      window.clearTimeout(this.settlementTimer);
    }
    this.cardAnimationQueue = PixiTable.createCardAnimationQueue(snapshot.lastEvents);
    this.prepareSettlementVisibility(snapshot);
    this.host.dataset.settlementVisible = String(this.shouldShowSettlement(snapshot));
    this.host.dataset.settlementHandCount = String(this.shouldShowSettlement(snapshot) ? snapshot.summaries.length : 0);
    this.host.dataset.dealerTipSeats = JSON.stringify(handLayouts.filter((hand) => snapshot.dealerTips[hand.id] > 0).map((hand) => hand.id));
    this.host.dataset.dealerThanksRewards = JSON.stringify(
      handLayouts.flatMap((hand) => (snapshot.dealerTipRewards[hand.id] > 0 ? [`${hand.id}:${snapshot.dealerTipRewards[hand.id]}`] : [])),
    );
    this.host.dataset.settlementResults = JSON.stringify(
      this.shouldShowSettlement(snapshot) ? snapshot.summaries.map((summary) => `${summary.handId}:${summary.mainResult}:${summary.profit}`) : [],
    );
    this.host.dataset.settlementPopupLines = JSON.stringify(
      this.shouldShowSettlement(snapshot)
        ? snapshot.summaries.map((summary) => {
            const popup = PixiTable.settlementPopupForSummary(snapshot, summary, this.settlementMetadata);
            return [popup.mainLine, popup.sideLine, ...popup.detailLines];
          })
        : [],
    );
    this.host.dataset.sideBetLabels = JSON.stringify(this.settledSideBetLabels(snapshot));
    this.host.dataset.activeMainBets = JSON.stringify(handLayouts.filter((hand) => snapshot.bets[hand.id].main > 0).map((hand) => hand.id));
    this.host.dataset.dealerCardCount = String(snapshot.dealer.cards.length + (snapshot.dealer.holeCard && !snapshot.dealer.holeRevealed ? 1 : 0));
    this.host.dataset.cardAnimationOrders = JSON.stringify([...this.cardAnimationQueue.entries()]);
    this.host.dataset.dealerAnimationOrders = JSON.stringify(
      [...this.cardAnimationQueue.entries()].filter(([key]) => key.startsWith('dealer-')).map(([, order]) => order),
    );

    this.drawBettingZones(snapshot);
    this.drawHands(snapshot);
    this.drawDealer(snapshot);
    if (this.shouldShowSettlement(snapshot)) {
      this.drawRoundSummaries(snapshot);
      this.host.dataset.profitableCelebration = String(snapshot.summaries.some((summary) => summary.profit > 0));
      if (this.celebratedSettlementKey !== this.settlementKey) {
        this.celebratedSettlementKey = this.settlementKey;
        this.effectRenderer.drawConfetti(snapshot.lastEvents);
      }
    } else {
      this.host.dataset.profitableCelebration = 'false';
    }
    this.cardRenderer.endFrame();
  }

  private layout(): void {
    const scale = Math.min(this.host.clientWidth / tableSize.width, this.host.clientHeight / tableSize.height);
    this.root.scale.set(scale);
    this.root.position.set((this.host.clientWidth - tableSize.width * scale) / 2, (this.host.clientHeight - tableSize.height * scale) / 2);
  }

  private drawBettingZones(snapshot: GameSnapshot): void {
    for (const hand of handLayouts) {
      for (const [betType, zone] of Object.entries(hand.zones) as [BetType, (typeof hand.zones)[BetType]][]) {
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
              px.y + px.height * PixiTable.sideWinTagVerticalScale,
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
          this.chipRenderer?.drawStack(amount, centerX, centerY, PixiTable.liveBetChipRadius, `bet-${hand.id}-${betType}-${amount}`);
        }
      }
      const tipPx = rectToPixels(hand.tipZone);
      const tipX = tipPx.x + tipPx.width / 2;
      const tipY = tipPx.y + tipPx.height / 2;
      this.drawDealerTipZone(snapshot, hand.id, tipX, tipY, tipPx.width, tipPx.height);
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
      this.chipRenderer?.drawStack(amount, x, y, PixiTable.liveBetChipRadius, `tip-${handId}-${amount}`);
    }
  }

  private drawHands(snapshot: GameSnapshot): void {
    for (const hand of handLayouts) {
      const playerHand = snapshot.hands[hand.id];
      playerHand.cards.forEach((card, index) => {
        const point = toPixels(hand.cards[index]);
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

  private drawDealer(snapshot: GameSnapshot): void {
    if (!snapshot.dealer.holeRevealed && snapshot.dealer.holeCard) {
      const point = toPixels(dealerSlots[0]);
      this.cardRenderer.drawBack(point.x, point.y, 'dealer-hole', this.cardAnimationQueue.get('dealer-hole'));
    }

    snapshot.dealer.cards.forEach((card, index) => {
      const point = toPixels(dealerSlots[index]);
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

  private drawRoundSummaries(snapshot: GameSnapshot): void {
    for (const summary of snapshot.summaries) {
      const layout = handLayouts.find((hand) => hand.id === summary.handId);
      if (!layout) {
        continue;
      }

      const point = toPixels(layout.popup);
      const popup = PixiTable.settlementPopupForSummary(snapshot, summary, this.settlementMetadata);
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
        this.drawDealerPayout(amount, x + BET_RENDERING.mainPayoutOffsetX, y, BET_RENDERING.mainChipRadius, `payout-${handId}-main-${amount}`);
        this.tagRenderer.drawPayoutTag(`PAID +£${amount}`, x + BET_RENDERING.mainPayoutOffsetX, y + BET_RENDERING.sideLabelOffsetY, 'win');
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

  private prepareSettlementVisibility(snapshot: GameSnapshot): void {
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
      PixiTable.prefersReducedMotion() ? 0 : PixiTable.settlementRevealDelay(this.cardAnimationQueue),
    );
  }

  private shouldShowSettlement(snapshot: GameSnapshot): boolean {
    return snapshot.phase === 'roundOver' && this.settlementVisible;
  }

  private settledSideBetLabels(snapshot: GameSnapshot): string[] {
    if (!this.shouldShowSettlement(snapshot)) {
      return [];
    }

    return snapshot.summaries.flatMap((summary) => PixiTable.sideLinesForSummary(snapshot, summary));
  }

  private static createChipTextures(sheetTexture: Texture): Map<ChipValue, Texture> {
    const textures = new Map<ChipValue, Texture>();

    chipValues.forEach((value) => {
      const crop = chipCropByValue.get(value);
      if (!crop) {
        return;
      }

      textures.set(
        value,
        new Texture({
          source: sheetTexture.source,
          frame: new Rectangle(crop.x, crop.y, crop.size, crop.size),
        }),
      );
    });

    return textures;
  }

  private static createCardAnimationQueue(events: readonly GameEvent[]): Map<string, number> {
    const queue = new Map<string, number>();
    let order = 0;

    for (const event of events) {
      if (event.type === 'player-card' && event.handId && event.cardIndex !== undefined) {
        queue.set(`player-${event.handId}-${event.cardIndex}`, order);
        order += 1;
      }

      if (event.type === 'dealer-hole') {
        queue.set('dealer-hole', order);
        order += 1;
      }

      if (event.type === 'dealer-card' && event.cardIndex === 0) {
        queue.set('dealer-hole-reveal', order);
        order += 1;
      } else if (event.type === 'dealer-card' && event.cardIndex !== undefined) {
        queue.set(`dealer-${event.cardIndex}`, order);
        order += 1;
      }
    }

    return queue;
  }

  private static formatProfit(profit: number): string {
    return `${profit >= 0 ? '+' : '-'}£${Math.abs(profit)}`;
  }

  private static settlementPopupForSummary(snapshot: GameSnapshot, summary: RoundSummary, settlementMetadata: readonly PixiTableSettlementMetadata[] = []) {
    const mainStake = snapshot.bets[summary.handId].main;
    const sideStake = (betTypes.filter((betType) => betType !== 'main') as Exclude<BetType, 'main'>[]).reduce(
      (total, betType) => total + snapshot.bets[summary.handId][betType],
      0,
    );
    const dealerThanks = snapshot.dealerTipRewards[summary.handId];
    const mainProfit = PixiTable.mainProfitForSummary(summary.mainResult, mainStake);
    const sideProfit = summary.profit - mainProfit;
    const houseAdvanceRepayment = Math.max(
      0,
      Math.floor(settlementMetadata.find((metadata) => metadata.handId === summary.handId)?.houseAdvanceRepayment ?? 0),
    );
    const netProfit = summary.profit - houseAdvanceRepayment;
    return {
      mainLine: `Main ${summary.mainResult.toUpperCase()} ${PixiTable.formatProfit(mainProfit)}`,
      sideLine: `Side bets ${sideStake > 0 ? PixiTable.netLabel(sideProfit, 'EVEN') : 'NONE'} ${PixiTable.formatProfit(sideProfit)}`,
      detailLines: PixiTable.settlementDetailLines(summary.profit, houseAdvanceRepayment, netProfit, dealerThanks),
      result: PixiTable.resultForProfit(netProfit),
    };
  }

  private static settlementDetailLines(profit: number, houseAdvanceRepayment: number, netProfit: number, dealerThanks: number): string[] {
    const dealerThanksLine = dealerThanks > 0 ? [`Dealer's Thanks +£${dealerThanks}`] : [];
    return houseAdvanceRepayment > 0
      ? [
          `Gross ${PixiTable.netLabel(profit, 'PUSH')} ${PixiTable.formatProfit(profit)}`,
          `House Advance payment -£${houseAdvanceRepayment}`,
          `Net ${PixiTable.netLabel(netProfit, 'PUSH')} ${PixiTable.formatProfit(netProfit)}`,
          ...dealerThanksLine,
        ]
      : [`Total ${PixiTable.netLabel(profit, 'PUSH')} ${PixiTable.formatProfit(profit)}`, ...dealerThanksLine];
  }

  private static mainProfitForSummary(result: RoundSummary['mainResult'], mainStake: number): number {
    if (result === 'win') {
      return mainStake;
    }
    if (result === 'lose') {
      return -mainStake;
    }
    return 0;
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
    return (betTypes.filter((betType) => betType !== 'main') as Exclude<BetType, 'main'>[]).flatMap((betType) => {
      const stake = snapshot.bets[summary.handId][betType];
      const sideWin = summary.sideWins.find((win) => win.betType === betType);
      if (sideWin) {
        return [`${sideWin.label} WIN +£${sideWin.profit}`];
      }
      return stake > 0 && snapshot.sideStates[summary.handId][betType] === 'lose' ? [`${PixiTable.betTypeLabel(betType)} LOSE -£${stake}`] : [];
    });
  }

  private static settlementRevealDelay(queue: ReadonlyMap<string, number>): number {
    const maxOrder = Math.max(0, ...queue.values());
    return (maxOrder * CARD_ANIMATION.delayStep + CARD_ANIMATION.duration + PixiTable.settlementRevealPauseSeconds) * PixiTable.millisecondsPerSecond;
  }

  private static betTypeLabel(betType: Exclude<BetType, 'main'>): string {
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
