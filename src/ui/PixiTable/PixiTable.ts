import 'pixi.js/unsafe-eval';
import { Assets, Rectangle, Sprite, Texture } from 'pixi.js';
import { beatTheHouseChipsUrl } from '../../assets/tableAssets/beatTheHouseChipsUrl';
import { beatTheHouseTableUrl } from '../../assets/tableAssets/beatTheHouseTableUrl';
import type { GameEvent } from '../../game/types/GameEvent';
import type { GameSnapshot } from '../../game/types/GameSnapshot';
import { chipCropByValue } from '../chips/chipCropByValue';
import type { ChipValue } from '../chips/ChipValue';
import { chipValues } from '../chips/chipValues';
import { handLayouts } from '../layout/handLayouts';
import { tableSize } from '../layout/tableSize';
import { roundStartAnimationKey } from './roundStartAnimationKey';
import type { PixiTableDependencies } from './PixiTableDependencies';
import type { PixiTableOptions } from './PixiTableOptions';
import type { PixiTableSettlementMetadata } from './PixiTableSettlementMetadata';
import { PixiTableDrawing } from './PixiTableDrawing';
import { PixiTableSettlement } from './PixiTableSettlement';

export class PixiTable extends PixiTableDrawing {
  public constructor(host: HTMLElement, options: PixiTableOptions, dependencies: PixiTableDependencies) {
    super(host, options, dependencies);
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
    this.createChipRenderer(PixiTable.createChipTextures(chipSheet));
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
            const popup = PixiTableSettlement.settlementPopupForSummary(snapshot, summary, this.settlementMetadata);
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
}
